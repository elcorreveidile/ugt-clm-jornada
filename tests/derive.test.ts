import { test } from "node:test";
import assert from "node:assert/strict";
import { activityMinutes, checkEntry, deriveActivities, type LedgerEntry } from "../shared/derive";
import { entryInputSchema, type EntryInput } from "../shared/events";

let seq = 0;
function e(type: LedgerEntry["type"], payload: Record<string, unknown>, extra: Partial<LedgerEntry> = {}): LedgerEntry {
  seq++;
  const at = extra.recordedAt ?? `2026-11-09T${String(7 + seq).padStart(2, "0")}:00:00.000Z`;
  return {
    id: `e${seq}`,
    seq,
    type,
    payload,
    start: null,
    end: null,
    recordedAt: at,
    mode: type === "INICIO" || type === "FIN" ? "MOMENTO" : "POSTERIOR",
    prevHash: "",
    hash: "",
    tsa: null,
    ...extra,
  };
}
const clase = { kind: "CLASE", grupo: "B1.2-M", aula: "12" };

test("inicio + fin = actividad cerrada en el momento", () => {
  seq = 0;
  const i = e("INICIO", { activity: clase }, { start: "2026-11-09T08:00:00.000Z" });
  const f = e("FIN", { ref: i.id }, { end: "2026-11-09T10:00:00.000Z" });
  const [a] = deriveActivities([i, f]);
  assert.equal(a.status, "CERRADA");
  assert.equal(a.mode, "MOMENTO");
  assert.equal(activityMinutes(a), 120);
  assert.deepEqual(a.seqs, [1, 2]);
});

test("una corrección cambia la versión vigente pero conserva el origen", () => {
  seq = 0;
  const r = e("REGISTRO", { activity: clase }, { start: "2026-11-09T08:00:00.000Z", end: "2026-11-09T09:00:00.000Z" });
  const c = e(
    "CORRECCION",
    { ref: r.id, activity: { ...clase, aula: "14" }, motivo: "Me equivoqué de hora" },
    { start: "2026-11-09T08:00:00.000Z", end: "2026-11-09T10:00:00.000Z" },
  );
  const [a] = deriveActivities([r, c]);
  assert.equal(a.corrected, true);
  assert.equal(a.aula, "14");
  assert.equal(activityMinutes(a), 120);
  assert.equal(a.mode, "POSTERIOR");
  assert.equal(a.motivo, "Me equivoqué de hora");
});

test("anulada no cuenta horas; no impartida tampoco", () => {
  seq = 0;
  const r = e("REGISTRO", { activity: clase }, { start: "2026-11-09T08:00:00.000Z", end: "2026-11-09T09:00:00.000Z" });
  const x = e("ANULACION", { ref: r.id, motivo: "Duplicada" });
  const n = e("NO_IMPARTIDA", { grupo: "A2", motivo: "Huelga" }, { start: "2026-11-09T10:00:00.000Z", end: "2026-11-09T12:00:00.000Z" });
  const acts = deriveActivities([r, x, n]);
  assert.equal(acts[0].status, "ANULADA");
  assert.equal(acts[1].status, "NO_IMPARTIDA");
  assert.equal(acts.reduce((s, a) => s + activityMinutes(a), 0), 0);
});

test("reglas: no se puede empezar con otra en curso ni terminar dos veces", () => {
  seq = 0;
  const now = new Date("2026-11-09T12:00:00.000Z");
  const i = e("INICIO", { activity: clase }, { start: "2026-11-09T08:00:00.000Z" });
  assert.match(checkEntry([i], { type: "INICIO", activity: clase } as EntryInput, now) ?? "", /en curso/);
  assert.equal(checkEntry([i], { type: "FIN", ref: i.id }, now), null);
  const f = e("FIN", { ref: i.id }, { end: "2026-11-09T10:00:00.000Z" });
  assert.match(checkEntry([i, f], { type: "FIN", ref: i.id }, now) ?? "", /ya no está/);
});

test("reglas: horas futuras, fin anterior al inicio y anulaciones repetidas", () => {
  seq = 0;
  const now = new Date("2026-11-09T12:00:00.000Z");
  const reg = (start: string, end?: string): EntryInput =>
    entryInputSchema.parse({ type: "REGISTRO", activity: clase, start, end });
  assert.match(checkEntry([], reg("2026-11-09T13:00:00Z", "2026-11-09T14:00:00Z"), now) ?? "", /futuras/);
  assert.match(checkEntry([], reg("2026-11-09T10:00:00Z", "2026-11-09T09:00:00Z"), now) ?? "", /posterior/);
  assert.match(checkEntry([], reg("2026-11-09T10:00:00Z"), now) ?? "", /fin/);
  const r = e("REGISTRO", { activity: clase }, { start: "2026-11-09T08:00:00.000Z", end: "2026-11-09T09:00:00.000Z" });
  const x = e("ANULACION", { ref: r.id, motivo: "x" });
  assert.match(checkEntry([r, x], { type: "ANULACION", ref: r.id, motivo: "y" }, now) ?? "", /ya está anulada/);
});

test("validación: clase sin aula y sustitución sin a quién se rechazan", () => {
  assert.equal(entryInputSchema.safeParse({ type: "INICIO", activity: { kind: "CLASE", grupo: "A1" } }).success, false);
  assert.equal(
    entryInputSchema.safeParse({ type: "INICIO", activity: { kind: "SUSTITUCION", grupo: "A1", aula: "3" } }).success,
    false,
  );
  assert.equal(entryInputSchema.safeParse({ type: "INICIO", activity: { kind: "PRUEBA_NIVEL" } }).success, true);
});

test("planificador: clases del día según días y periodo", async () => {
  const { clasesDelDia, diaDe } = await import("../shared/planner");
  assert.equal(diaDe("2026-11-09"), "L");
  assert.equal(diaDe("2026-11-15"), "D");
  const a = [
    { id: "1", grupo: "B1", aula: "3", dias: ["L", "X"], horaInicio: "10:30", horaFin: "12:30", desde: "2026-10-01", hasta: "2026-12-20" },
    { id: "2", grupo: "A2", aula: "5", dias: ["L"], horaInicio: "08:30", horaFin: "10:30", desde: "2026-10-01", hasta: "2026-12-20" },
    { id: "3", grupo: "C1", aula: "1", dias: ["L"], horaInicio: "17:00", horaFin: "19:00", desde: "2027-01-10", hasta: "2027-03-20" },
  ];
  assert.deepEqual(clasesDelDia(a, "2026-11-09").map((c) => c.grupo), ["A2", "B1"]);
  assert.deepEqual(clasesDelDia(a, "2026-11-10"), []);
});

test("pausas: dentro de un turno, no sueltas, una a la vez y antes de salir", async () => {
  const { tiempos } = await import("../shared/derive");
  seq = 0;
  const now = new Date("2026-11-09T20:00:00.000Z");
  const turnoAct = { kind: "JORNADA" as const, grupo: "Cocina" };
  const pausa = { type: "INICIO" as const, activity: { kind: "PAUSA" as const } };
  assert.match(checkEntry([], pausa, now) ?? "", /dentro de una jornada/);
  const t = e("INICIO", { activity: turnoAct }, { start: "2026-11-09T10:00:00.000Z" });
  assert.equal(checkEntry([t], pausa, now), null);
  const p = e("INICIO", { activity: { kind: "PAUSA" } }, { start: "2026-11-09T13:00:00.000Z" });
  assert.match(checkEntry([t, p], pausa, now) ?? "", /Ya tienes una pausa/);
  assert.match(checkEntry([t, p], { type: "FIN", ref: t.id }, now) ?? "", /Termina antes la pausa/);
  const pf = e("FIN", { ref: p.id }, { end: "2026-11-09T13:30:00.000Z" });
  assert.equal(checkEntry([t, p, pf], { type: "FIN", ref: t.id }, now), null);
  const tf = e("FIN", { ref: t.id }, { end: "2026-11-09T18:00:00.000Z" });
  assert.deepEqual(tiempos(deriveActivities([t, p, pf, tf])), { presencia: 480, pausas: 30, efectivo: 450 });
});

test("avisos: más de 9 h, más de 6 h sin pausa y menos de 12 h entre jornadas", async () => {
  const { avisosLegales } = await import("../shared/avisos");
  seq = 0;
  const j = { kind: "JORNADA" as const };
  const reg = (s: string, en: string, kind: string = "JORNADA") =>
    e("REGISTRO", { activity: kind === "PAUSA" ? { kind: "PAUSA" } : j }, { start: s, end: en });
  const acts = deriveActivities([
    // Día 1: 10:00–21:00 (11 h) con pausa de 30 min → 10 h 30 efectivas; termina a las 21:00 UTC.
    reg("2026-11-02T10:00:00.000Z", "2026-11-02T21:00:00.000Z"),
    reg("2026-11-02T14:00:00.000Z", "2026-11-02T14:30:00.000Z", "PAUSA"),
    // Día 2: empieza a las 06:00 UTC (9 h de descanso) y dura 7 h sin pausa.
    reg("2026-11-03T06:00:00.000Z", "2026-11-03T13:00:00.000Z"),
  ]);
  const tipos = avisosLegales(acts).map((a) => `${a.fecha} ${a.tipo}`);
  assert.deepEqual(tipos, ["2026-11-02 JORNADA_9H", "2026-11-03 SIN_PAUSA_6H", "2026-11-03 DESCANSO_12H"]);
});

test("horario: un turno de noche (fin anterior al inicio) es válido; igual no", async () => {
  const { asignacionSchema } = await import("../shared/events");
  const base = { grupo: "Recepción", dias: ["V"], desde: "2026-11-01", hasta: "2026-11-30" };
  assert.equal(asignacionSchema.safeParse({ ...base, horaInicio: "22:00", horaFin: "06:00" }).success, true);
  assert.equal(asignacionSchema.safeParse({ ...base, horaInicio: "22:00", horaFin: "22:00" }).success, false);
});
