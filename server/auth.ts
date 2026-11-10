// Acceso con enlace al correo, sin contraseñas. La sesión es un token aleatorio
// del que solo se guarda la huella: en la web va en una cookie httpOnly y en la
// app móvil en la cabecera Authorization.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { prisma } from "./db";
import { appUrl } from "./env";
import { escapeHtml, sendEmail } from "./email";
import { CREDITO } from "../shared/centro";

export const SESSION_COOKIE = "jornada_session";
export const SESSION_DAYS = 90;
const LOGIN_TTL_MS = 20 * 60 * 1000;
const LOGIN_MAX_PER_10_MIN = 3;
const CODE_MAX_ATTEMPTS = 5;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200 ? e : null;
}

/** Envía el enlace de acceso. Responde igual exista o no la cuenta. */
export async function requestLogin(rawEmail: string): Promise<"ok" | "invalid" | "limit" | "mail"> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "invalid";
  const recent = await prisma.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= LOGIN_MAX_PER_10_MIN) return "limit";
  const token = newToken();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.loginToken.create({
    data: { email, tokenHash: sha(token), codeHash: sha(`${email}:${code}`), expiresAt: new Date(Date.now() + LOGIN_TTL_MS) },
  });
  const link = `${appUrl()}/entrar?token=${encodeURIComponent(token)}`;
  const enviado = sendEmail(
    email,
    "Tu enlace para entrar en el registro de jornada",
    `<p>Pulsa el botón para entrar en tu registro de jornada. El enlace caduca en 20 minutos y solo sirve una vez.</p>
     <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#E30613;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Entrar</a></p>
     <p>En la app del móvil, escribe este código:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace">${code}</p>
     <p style="color:#666;font-size:13px">Si no lo has pedido tú, ignora este correo.</p>
     <p style="color:#999;font-size:11px">${escapeHtml(CREDITO)}</p>`,
    `Entra en tu registro de jornada con este enlace (caduca en 20 minutos):\n${link}\n\nEn la app del móvil, escribe este código: ${code}\n\nSi no lo has pedido tú, ignora este correo.`,
  );
  try {
    await enviado;
  } catch (e) {
    console.error("[correo]", e instanceof Error ? e.message : e);
    return "mail";
  }
  return "ok";
}

/** Canjea el código de 6 cifras (app móvil). Como mucho 5 intentos por correo enviado. */
export async function verifyCode(rawEmail: string, code: string): Promise<{ sessionToken: string; userId: string } | null> {
  const email = normalizeEmail(rawEmail);
  if (!email || !/^\d{6}$/.test(code)) return null;
  const row = await prisma.loginToken.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= CODE_MAX_ATTEMPTS) return null;
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(sha(`${email}:${code}`), "hex");
  if (!timingSafeEqual(a, b)) {
    await prisma.loginToken.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  return consume(row);
}

/** Canjea el enlace por una sesión. Crea la cuenta la primera vez. */
export async function verifyLogin(token: string): Promise<{ sessionToken: string; userId: string } | null> {
  const row = await prisma.loginToken.findUnique({ where: { tokenHash: sha(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return consume(row);
}

async function consume(row: { id: string; email: string }): Promise<{ sessionToken: string; userId: string } | null> {
  // Marca el acceso como usado solo si nadie lo ha usado antes (dos peticiones a la vez).
  const used = await prisma.loginToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) return null;
  const user =
    (await prisma.user.findUnique({ where: { email: row.email } })) ??
    (await prisma.user.create({ data: { email: row.email } }));
  const sessionToken = newToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
    },
  });
  return { sessionToken, userId: user.id };
}

function tokenFrom(c: Context): string | null {
  const auth = c.req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return getCookie(c, SESSION_COOKIE) ?? null;
}

export async function currentUser(c: Context) {
  const token = tokenFrom(c);
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  if (Date.now() - s.lastSeenAt.getTime() > 3600_000)
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return { user: s.user, sessionId: s.id };
}

export async function logout(c: Context): Promise<void> {
  const token = tokenFrom(c);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha(token) } });
}
