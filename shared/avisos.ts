// Indicios de posibles incumplimientos de los límites del Estatuto de los
// Trabajadores. Son avisos para revisar con el convenio (que puede fijar otra
// distribución), no conclusiones.
import { activityMinutes, type DerivedActivity } from "./derive";
import { fechaLocal } from "./centro";

export interface Aviso {
  fecha: string; // AAAA-MM-DD (día de inicio)
  tipo: "JORNADA_9H" | "SIN_PAUSA_6H" | "DESCANSO_12H";
  texto: string;
}

const H = 60;

/** Actividades que cuentan como trabajo para los límites (no pausas ni guardias). */
const esTrabajo = (a: DerivedActivity) =>
  a.status === "CERRADA" && !!a.end && a.kind !== "NO_IMPARTIDA" && a.kind !== "PAUSA" && a.kind !== "GUARDIA";

export function avisosLegales(acts: DerivedActivity[]): Aviso[] {
  const out: Aviso[] = [];
  const trabajo = acts.filter(esTrabajo).sort((a, b) => a.start.localeCompare(b.start));
  const pausas = acts.filter((a) => a.status === "CERRADA" && a.kind === "PAUSA" && a.end);

  // Por día: trabajo efectivo (trabajo − pausas dentro de él).
  const porDia = new Map<string, DerivedActivity[]>();
  for (const a of trabajo) porDia.set(fechaLocal(a.start), [...(porDia.get(fechaLocal(a.start)) ?? []), a]);
  for (const [fecha, list] of porDia) {
    const bruto = list.reduce((s, a) => s + activityMinutes(a), 0);
    const p = pausas
      .filter((x) => list.some((a) => x.start >= a.start && x.end! <= a.end!))
      .reduce((s, x) => s + activityMinutes(x), 0);
    if (bruto - p > 9 * H)
      out.push({ fecha, tipo: "JORNADA_9H", texto: `Más de 9 h de trabajo efectivo (${Math.floor((bruto - p) / H)} h ${(bruto - p) % H} min). Art. 34.3 ET, salvo otra distribución por convenio.` });
  }

  // Más de 6 h seguidas sin ninguna pausa dentro.
  for (const a of trabajo) {
    const tienePausa = pausas.some((x) => x.start >= a.start && x.end! <= a.end!);
    if (!tienePausa && activityMinutes(a) > 6 * H)
      out.push({ fecha: fechaLocal(a.start), tipo: "SIN_PAUSA_6H", texto: "Más de 6 h seguidas sin pausa registrada. Art. 34.4 ET: al menos 15 minutos." });
  }

  // Menos de 12 h entre el final de una jornada y el comienzo de la siguiente.
  const dias = [...porDia.keys()].sort();
  for (let i = 1; i < dias.length; i++) {
    const fin = porDia.get(dias[i - 1])!.reduce((m, a) => (a.end! > m ? a.end! : m), "");
    const inicio = porDia.get(dias[i])![0].start;
    const horas = (Date.parse(inicio) - Date.parse(fin)) / 3600_000;
    if (horas >= 0 && horas < 12)
      out.push({ fecha: dias[i], tipo: "DESCANSO_12H", texto: `Solo ${horas.toFixed(1).replace(".", ",")} h de descanso desde la jornada anterior. Art. 34.3 ET: mínimo 12 h.` });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
