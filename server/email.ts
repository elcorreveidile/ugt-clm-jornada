// Envío de correo transaccional (Brevo). Sin clave, en desarrollo se escribe en el log.
import { isProd } from "./env";

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    if (isProd()) throw new Error("El correo no está configurado (BREVO_API_KEY)");
    console.log(`\n[correo de desarrollo] Para: ${to}\nAsunto: ${subject}\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: {
        email: process.env.MAIL_FROM_EMAIL || "jornada@ugtclmgranada.org",
        name: process.env.MAIL_FROM_NAME || "Registro de jornada",
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Brevo respondió ${res.status}: ${await res.text()}`);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
