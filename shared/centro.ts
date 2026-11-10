// Centro de trabajo y su horario. Cada persona configura el suyo en Ajustes
// (la app se ofrece a distintos colectivos); estos son los valores por defecto.
import { TZ } from "./events";

export interface Horario {
  /** Hora de apertura del centro (HH:MM) o null si no se quiere avisar. */
  apertura: string | null;
  cierre: string | null;
  /** Hora a partir de la cual una actividad cuenta como turno de tarde. */
  inicioTarde: string;
}

export const HORARIO_DEFECTO: Horario = { apertura: "08:30", cierre: "22:00", inicioTarde: "15:00" };

/** Crédito discreto de quien desarrolla la herramienta. */
export const CREDITO = "Desarrollada por la Sección Sindical de UGT en el CLM (Universidad de Granada)";

/** Hora local (HH:MM) de un instante. */
export function horaLocal(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

/** Fecha local (AAAA-MM-DD) de un instante. */
export function fechaLocal(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

export function turno(startIso: string, h: Horario = HORARIO_DEFECTO): "Mañana" | "Tarde" | "Noche" {
  const hora = horaLocal(startIso);
  if (hora >= "22:00" || hora < "06:00") return "Noche";
  return hora < h.inicioTarde ? "Mañana" : "Tarde";
}

/** ¿Empieza antes de la apertura o termina después del cierre (hora local)? */
export function fueraDeHorario(startIso: string, endIso: string | null, h: Horario = HORARIO_DEFECTO): boolean {
  if (h.apertura && horaLocal(startIso) < h.apertura) return true;
  if (endIso && h.cierre) {
    if (fechaLocal(endIso) !== fechaLocal(startIso)) return true;
    if (horaLocal(endIso) > h.cierre) return true;
  }
  return false;
}

/**
 * Instante UTC (ISO) de una fecha y hora locales. Resuelve el cambio de hora
 * probando el desfase real de ese día.
 */
export function localToIso(fecha: string, hora: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
    guess += Date.UTC(y, m - 1, d, hh, mm) - shown;
  }
  return new Date(guess).toISOString();
}
