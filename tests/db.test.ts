// Prueba de integración contra un Postgres real (con el SQL de solo anotación
// aplicado) y, si hay red, contra FreeTSA. Se salta si no hay base de datos:
//   JORNADA_TEST_DATABASE_URL=postgresql://… pnpm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const url = process.env.JORNADA_TEST_DATABASE_URL;
const skip = !url ? "sin JORNADA_TEST_DATABASE_URL" : false;
if (url) process.env.JORNADA_DATABASE_URL = url;

type Mods = {
  prisma: typeof import("../server/db").prisma;
  store: typeof import("../server/ledger/store");
  integrity: typeof import("../server/ledger/integrity");
};
let m: Mods;
let userId = "";

before(async () => {
  if (skip) return;
  m = {
    prisma: (await import("../server/db")).prisma,
    store: await import("../server/ledger/store"),
    integrity: await import("../server/ledger/integrity"),
  };
  const u = await m.prisma.user.create({ data: { email: `prueba-${Date.now()}@example.org`, name: "Profe de Prueba" } });
  userId = u.id;
});

after(async () => {
  if (skip || !userId) return;
  await m.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL jornada.allow_delete = 'on'");
    await tx.user.deleteMany({ where: { id: userId } });
  });
  await m.prisma.$disconnect();
});

test("flujo completo: fichar, registrar, corregir, anular, sellar y verificar", { skip }, async () => {
  const { appendEntry, loadRows, RuleError } = m.store;
  const clase = { kind: "CLASE" as const, grupo: "B1.2 Mañana", aula: "12" };

  const inicio = await appendEntry(userId, { type: "INICIO", activity: clase });
  assert.equal(inicio.seq, 1);
  assert.equal(inicio.mode, "MOMENTO");
  await assert.rejects(appendEntry(userId, { type: "INICIO", activity: clase }), RuleError);
  await appendEntry(userId, { type: "FIN", ref: inicio.id });

  const reg = await appendEntry(userId, {
    type: "REGISTRO",
    activity: { kind: "SUSTITUCION", grupo: "A2", aula: "5", sustituye: "Compañera X" },
    start: "2026-11-02T08:30:00.000Z",
    end: "2026-11-02T10:30:00.000Z",
  });
  await appendEntry(userId, {
    type: "CORRECCION",
    ref: reg.id,
    activity: { kind: "SUSTITUCION", grupo: "A2", aula: "7", sustituye: "Compañera X" },
    start: "2026-11-02T08:30:00.000Z",
    end: "2026-11-02T10:30:00.000Z",
    motivo: "El aula era la 7",
  });
  await appendEntry(userId, { type: "ANULACION", ref: inicio.id, motivo: "Prueba" });

  const rows = await loadRows(userId);
  assert.deepEqual(rows.map((r) => r.seq), [1, 2, 3, 4, 5]);
  const check = await m.integrity.checkIntegrity(userId);
  assert.equal(check.ok, true);
});

test("la base de datos impide modificar o borrar anotaciones", { skip }, async () => {
  const [first] = await m.store.loadRows(userId);
  await assert.rejects(
    m.prisma.entry.update({ where: { id: first.id }, data: { mode: "MOMENTO", type: "REGISTRO" } }),
    /solo anotación/,
  );
  await assert.rejects(m.prisma.entry.delete({ where: { id: first.id } }), /solo anotación/);
  await assert.rejects(m.prisma.$executeRawUnsafe('TRUNCATE "Entry" CASCADE'), /solo anotación/);
  if (first.stamp)
    await assert.rejects(
      m.prisma.stamp.update({ where: { entryId: first.id }, data: { provider: "x" } }),
      /solo anotación/,
    );
});

test("si alguien salta el disparador y cambia una anotación, la verificación lo detecta", { skip }, async () => {
  const rows = await m.store.loadRows(userId);
  const target = rows[1];
  const pg = await import("pg");
  const c = new pg.default.Client({ connectionString: url });
  await c.connect();
  const tamper = async (sql: string) => {
    await c.query('ALTER TABLE "Entry" DISABLE TRIGGER entry_append_only');
    await c.query(sql, [target.id]);
    await c.query('ALTER TABLE "Entry" ENABLE TRIGGER entry_append_only');
  };
  try {
    // Simula a quien administra la base de datos alargando una clase una hora.
    await tamper(`UPDATE "Entry" SET "end" = "end" + interval '1 hour' WHERE id = $1`);
    const check = await m.integrity.checkIntegrity(userId);
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.seq, target.seq);
  } finally {
    await tamper(`UPDATE "Entry" SET "end" = "end" - interval '1 hour' WHERE id = $1`);
    await c.end();
  }
  assert.equal((await m.integrity.checkIntegrity(userId)).ok, true);
});

test("paquete de evidencias verificable y PDF", { skip }, async () => {
  const { buildEvidence } = await import("../server/report/evidence");
  const { verifyPackage } = await import("../server/report/verify-package");
  const { trustedTsaPem } = await import("../server/tsa/config");
  const { buildMonthReport } = await import("../server/report/data");
  const { renderMonthPdf } = await import("../server/report/pdf");
  const rows = await m.store.loadRows(userId);
  const user = await m.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const pkg = buildEvidence(rows, user, null);
  const ok = await verifyPackage(pkg, trustedTsaPem());
  assert.equal(ok.ok, true, ok.errores.join("; "));
  console.log(`  sellos válidos: ${ok.selladas}/${ok.entradas}`);

  const roto = structuredClone(pkg);
  roto.entradas[2].material = roto.entradas[2].material.replace('"aula":"5"', '"aula":"9"');
  const bad = await verifyPackage(roto, trustedTsaPem());
  assert.equal(bad.ok, false);

  const report = buildMonthReport(rows.map(m.store.toLedger), "2026-11", await m.integrity.checkIntegrity(userId));
  const pdf = await renderMonthPdf(
    report,
    { name: user.name, email: user.email, nif: null, centro: "CLM · Universidad de Granada", horario: { apertura: "08:30", cierre: "22:00", inicioTarde: "15:00" }, perfil: (await import("../shared/perfiles")).PERFILES.DOCENCIA },
    { generatedAt: new Date().toISOString(), verifyUrl: "https://jornada.example/verificar", tsaName: "FreeTSA" },
  );
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  const { writeFileSync } = await import("node:fs");
  if (process.env.JORNADA_TEST_PDF_OUT) writeFileSync(process.env.JORNADA_TEST_PDF_OUT, pdf);
});
