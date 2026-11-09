// API de la aplicación (Hono). La usan la web y las apps móviles.
import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { prisma } from "./db";
import { appUrl, isProd } from "./env";
import { cors } from "hono/cors";
import { SESSION_COOKIE, SESSION_DAYS, currentUser, logout, requestLogin, verifyCode, verifyLogin } from "./auth";
import { asignacionSchema, entryInputSchema } from "../shared/events";
import { deriveActivities } from "../shared/derive";
import { appendEntry, loadRows, RuleError, stampPending, toLedger } from "./ledger/store";
import { checkIntegrity } from "./ledger/integrity";
import { buildMonthReport, isMonth } from "./report/data";
import { buildEvidence } from "./report/evidence";
import { tsaConfig } from "./tsa/config";
import { PERFIL_IDS, perfilDe } from "../shared/perfiles";

type User = NonNullable<Awaited<ReturnType<typeof currentUser>>>["user"];
type Env = { Variables: { user: User } };

export const app = new Hono<Env>().basePath("/api");

app.use("*", secureHeaders());

// Las apps de Android e iOS (Capacitor) llaman a la API desde su propio origen.
app.use(
  "*",
  cors({
    origin: ["capacitor://localhost", "https://localhost", "http://localhost"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Disposition"],
  }),
);

// Protección CSRF: toda petición que cambia algo debe ser JSON (un formulario de
// otra web no puede enviarlo sin permiso CORS) o venir con token de la app.
app.use("*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const ct = c.req.header("content-type") ?? "";
    const bearer = c.req.header("authorization")?.startsWith("Bearer ");
    if (!ct.includes("application/json") && !bearer && !c.req.path.startsWith("/api/cron/"))
      return c.json({ error: "Petición no admitida" }, 415);
  }
  await next();
});

const needUser = async (c: Context<Env>, next: () => Promise<void>) => {
  const s = await currentUser(c);
  if (!s) return c.json({ error: "Tienes que entrar de nuevo" }, 401);
  c.set("user", s.user);
  await next();
};

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const raw = await c.req.json().catch(() => null);
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, res: c.json({ error: r.error.issues[0]?.message ?? "Datos no válidos", issues: r.error.issues }, 400) };
}

// --- Acceso ---------------------------------------------------------------

app.post("/auth/request", async (c) => {
  const b = await body(c, z.object({ email: z.string().max(200) }));
  if (!b.ok) return b.res;
  const r = await requestLogin(b.data.email);
  if (r === "invalid") return c.json({ error: "Escribe un correo válido" }, 400);
  if (r === "limit") return c.json({ error: "Has pedido varios enlaces seguidos. Espera unos minutos." }, 429);
  if (r === "mail") return c.json({ error: "No se ha podido enviar el correo. Inténtalo más tarde o avisa a quien administra la app." }, 503);
  return c.json({ ok: true });
});

app.post("/auth/verify", async (c) => {
  const b = await body(
    c,
    z.union([
      z.object({ token: z.string().min(10).max(200) }),
      z.object({ email: z.string().max(200), code: z.string().trim().max(10) }),
    ]),
  );
  if (!b.ok) return b.res;
  const r = "token" in b.data ? await verifyLogin(b.data.token) : await verifyCode(b.data.email, b.data.code);
  if (!r)
    return c.json(
      { error: "token" in b.data ? "El enlace no es válido o ha caducado. Pide otro." : "Código incorrecto o caducado." },
      400,
    );
  setCookie(c, SESSION_COOKIE, r.sessionToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  // El token también se devuelve para la app móvil (que no usa cookies).
  return c.json({ ok: true, token: r.sessionToken });
});

app.post("/auth/logout", async (c) => {
  await logout(c);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// --- Cuenta -----------------------------------------------------------------

const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  nif: u.nif,
  perfil: u.perfil,
  centro: u.centro,
  apertura: u.apertura,
  cierre: u.cierre,
  inicioTarde: u.inicioTarde,
});

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida");

app.get("/me", needUser, (c) => c.json({ ...publicUser(c.var.user), tsa: tsaConfig().name }));

app.patch("/me", needUser, async (c) => {
  const b = await body(
    c,
    z.object({
      name: z.string().trim().max(120).optional(),
      nif: z.string().trim().max(20).optional(),
      perfil: z.enum(PERFIL_IDS).optional(),
      centro: z.string().trim().max(160).optional(),
      apertura: hora.or(z.literal("")).optional(),
      cierre: hora.or(z.literal("")).optional(),
      inicioTarde: hora.optional(),
    }),
  );
  if (!b.ok) return b.res;
  const d = b.data;
  if (d.apertura && d.cierre && d.apertura >= d.cierre) return c.json({ error: "El cierre debe ser posterior a la apertura" }, 400);
  const u = await prisma.user.update({
    where: { id: c.var.user.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.nif !== undefined ? { nif: d.nif ? d.nif.toUpperCase() : null } : {}),
      ...(d.perfil ? { perfil: d.perfil } : {}),
      ...(d.centro !== undefined ? { centro: d.centro } : {}),
      ...(d.apertura !== undefined ? { apertura: d.apertura || null } : {}),
      ...(d.cierre !== undefined ? { cierre: d.cierre || null } : {}),
      ...(d.inicioTarde ? { inicioTarde: d.inicioTarde } : {}),
    },
  });
  return c.json(publicUser(u));
});

/** Borra la cuenta y TODO su registro (derecho de supresión). Irreversible. */
app.delete("/me", needUser, async (c) => {
  const b = await body(c, z.object({ confirm: z.string() }));
  if (!b.ok) return b.res;
  if (b.data.confirm.trim().toLowerCase() !== c.var.user.email)
    return c.json({ error: "Escribe tu correo exacto para confirmar" }, 400);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL jornada.allow_delete = 'on'");
    await tx.user.delete({ where: { id: c.var.user.id } });
  });
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// --- Registro ---------------------------------------------------------------

app.get("/registro", needUser, async (c) => {
  const entries = (await loadRows(c.var.user.id)).map(toLedger);
  return c.json({ entries, activities: deriveActivities(entries) });
});

app.post("/registro", needUser, async (c) => {
  const b = await body(c, entryInputSchema);
  if (!b.ok) return b.res;
  try {
    const entry = await appendEntry(c.var.user.id, b.data);
    return c.json({ entry }, 201);
  } catch (e) {
    if (e instanceof RuleError) return c.json({ error: e.message }, 409);
    throw e;
  }
});

app.get("/integridad", needUser, async (c) => c.json(await checkIntegrity(c.var.user.id)));

app.post("/sellar", needUser, async (c) => c.json(await stampPending({ userId: c.var.user.id }, 100)));

// --- Horario asignado (actas) -----------------------------------------------

app.get("/asignaciones", needUser, async (c) => {
  const list = await prisma.asignacion.findMany({
    where: { userId: c.var.user.id, archivedAt: null },
    orderBy: [{ desde: "desc" }, { horaInicio: "asc" }],
  });
  return c.json({ asignaciones: list });
});

app.post("/asignaciones", needUser, async (c) => {
  const b = await body(c, asignacionSchema);
  if (!b.ok) return b.res;
  const a = await prisma.asignacion.create({ data: { ...b.data, aula: b.data.aula ?? "", userId: c.var.user.id } });
  // Constancia en el registro de qué horario se tenía asignado y desde cuándo.
  await appendEntry(c.var.user.id, { type: "HORARIO", payload: { accion: "alta", asignacionId: a.id, ...b.data } });
  return c.json({ asignacion: a }, 201);
});

app.delete("/asignaciones/:id", needUser, async (c) => {
  const a = await prisma.asignacion.findFirst({ where: { id: c.req.param("id"), userId: c.var.user.id, archivedAt: null } });
  if (!a) return c.json({ error: "No encontrada" }, 404);
  await prisma.asignacion.update({ where: { id: a.id }, data: { archivedAt: new Date() } });
  await appendEntry(c.var.user.id, { type: "HORARIO", payload: { accion: "baja", asignacionId: a.id, grupo: a.grupo } });
  return c.json({ ok: true });
});

// --- Exportación ------------------------------------------------------------

app.get("/export/pdf", needUser, async (c) => {
  const mes = c.req.query("mes");
  if (!isMonth(mes)) return c.json({ error: "Mes no válido" }, 400);
  const u = c.var.user;
  const [rows, integrity] = await Promise.all([loadRows(u.id), checkIntegrity(u.id)]);
  const horario = { apertura: u.apertura, cierre: u.cierre, inicioTarde: u.inicioTarde };
  const report = buildMonthReport(rows.map(toLedger), mes, integrity, horario);
  const { renderMonthPdf } = await import("./report/pdf");
  const pdf = await renderMonthPdf(
    report,
    { name: u.name, email: u.email, nif: u.nif, centro: u.centro, horario, perfil: perfilDe(u.perfil) },
    { generatedAt: new Date().toISOString(), verifyUrl: `${appUrl()}/verificar`, tsaName: tsaConfig().name },
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="registro-jornada-${mes}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});

app.get("/export/evidencia", needUser, async (c) => {
  const mes = c.req.query("mes");
  if (mes && !isMonth(mes)) return c.json({ error: "Mes no válido" }, 400);
  const u = c.var.user;
  const pkg = buildEvidence(await loadRows(u.id), u, mes ?? null);
  return new Response(JSON.stringify(pkg, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="evidencias-jornada-${mes ?? "completo"}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

// --- Público: datos legales -------------------------------------------------

/** Responsable del tratamiento y autoridad de sellado (para el aviso legal). */
app.get("/info", (c) =>
  c.json({
    responsable: {
      nombre: process.env.RESPONSABLE_NOMBRE || "Sección Sindical de UGT en el Centro de Lenguas Modernas (Universidad de Granada)",
      nif: process.env.RESPONSABLE_NIF || null,
      direccion: process.env.RESPONSABLE_DIRECCION || null,
      contacto: process.env.RESPONSABLE_CONTACTO || null,
    },
    tsa: tsaConfig().name,
  }),
);

// --- Público: consulta de una huella ------------------------------------------

app.get("/verificar/:hash", async (c) => {
  const hash = c.req.param("hash").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return c.json({ error: "Una huella tiene 64 caracteres hexadecimales" }, 400);
  const e = await prisma.entry.findUnique({ where: { hash }, include: { stamp: true } });
  if (!e) return c.json({ existe: false });
  // Sin contenido ni identidad: solo que existe, cuándo se anotó y su sello.
  return c.json({
    existe: true,
    numero: e.seq,
    anotada: e.recordedAt.toISOString(),
    sello: e.stamp
      ? { fecha: e.stamp.genTime.toISOString(), proveedor: e.stamp.provider, cualificado: e.stamp.qualified }
      : null,
  });
});

// --- Cron: sellar lo pendiente ----------------------------------------------

app.get("/cron/sellar", async (c) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return c.json({ error: "CRON_SECRET sin configurar" }, 503);
  if (c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "No autorizado" }, 401);
  return c.json(await stampPending({}, 200));
});

app.onError((err, c) => {
  console.error("[api]", err);
  return c.json({ error: "Error interno. Inténtalo de nuevo." }, 500);
});

export default app;
