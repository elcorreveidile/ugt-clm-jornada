// Datos de un informe mensual: actividades del mes, anotaciones que las
// componen, totales e integridad. Lo usan el PDF y el paquete de evidencias.
import { activityMinutes, deriveActivities, tiempos, type DerivedActivity, type LedgerEntry } from "../../shared/derive";
import { avisosLegales, type Aviso } from "../../shared/avisos";
import { HORARIO_DEFECTO, fechaLocal, fueraDeHorario, type Horario } from "../../shared/centro";
import { ACTIVITY_KINDS, type ActivityKind } from "../../shared/events";
import type { ChainCheck } from "../ledger/chain";

export interface MonthReport {
  mes: string; // AAAA-MM
  activities: (DerivedActivity & { minutes: number; fuera: boolean })[];
  entries: LedgerEntry[];
  avisos: Aviso[];
  totals: {
    minutesByKind: Record<ActivityKind, number>;
    /** Presencia (sin pausas), pausas y tiempo efectivo. */
    presencia: number;
    pausas: number;
    efectivo: number;
    momento: number;
    posterior: number;
    corregidas: number;
    anuladas: number;
    noImpartidas: number;
    fuera: number;
    sinSello: number;
  };
  integrity: ChainCheck;
  head: LedgerEntry | null;
}

export function isMonth(v: string | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function buildMonthReport(
  all: LedgerEntry[],
  mes: string,
  integrity: ChainCheck,
  horario: Horario = HORARIO_DEFECTO,
): MonthReport {
  const acts = deriveActivities(all).filter((a) => fechaLocal(a.start).startsWith(mes));
  const seqs = new Set(acts.flatMap((a) => a.seqs));
  const entries = all.filter((e) => seqs.has(e.seq) || fechaLocal(e.recordedAt).startsWith(mes));
  const minutesByKind = Object.fromEntries(ACTIVITY_KINDS.map((k) => [k, 0])) as Record<ActivityKind, number>;
  const activities = acts
    .map((a) => ({ ...a, minutes: activityMinutes(a), fuera: a.status !== "ANULADA" && fueraDeHorario(a.start, a.end, horario) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  for (const a of activities) if (a.kind !== "NO_IMPARTIDA") minutesByKind[a.kind] += a.minutes;
  const live = activities.filter((a) => a.status !== "ANULADA");
  const t = tiempos(activities);
  return {
    mes,
    activities,
    entries,
    avisos: avisosLegales(activities),
    totals: {
      minutesByKind,
      ...t,
      momento: live.filter((a) => a.mode === "MOMENTO" && !a.corrected).length,
      posterior: live.filter((a) => a.mode === "POSTERIOR" || a.corrected).length,
      corregidas: activities.filter((a) => a.corrected).length,
      anuladas: activities.filter((a) => a.status === "ANULADA").length,
      noImpartidas: activities.filter((a) => a.status === "NO_IMPARTIDA").length,
      fuera: activities.filter((a) => a.fuera).length,
      sinSello: entries.filter((e) => !e.tsa).length,
    },
    integrity,
    head: all.at(-1) ?? null,
  };
}

export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}
