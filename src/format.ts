import { TZ } from "../shared/events";
import { fechaLocal, horaLocal } from "../shared/centro";

export { fechaLocal, horaLocal };

export const hoy = () => fechaLocal(new Date().toISOString());
export const mesActual = () => hoy().slice(0, 7);

export function fechaLarga(fechaOrIso: string): string {
  const d = fechaOrIso.length === 10 ? new Date(`${fechaOrIso}T12:00:00Z`) : new Date(fechaOrIso);
  return new Intl.DateTimeFormat("es-ES", { timeZone: fechaOrIso.length === 10 ? "UTC" : TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
}

export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
}

export function nombreMes(mes: string): string {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}-15T12:00:00Z`));
}

export function sumarMes(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function duracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m ? `${m} min` : ""}`.trim() : `${m} min`;
}
