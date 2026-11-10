// Clases previstas a partir del horario asignado (actas de la intranet).
import { DIAS } from "./events";

export interface AsignacionLite {
  id: string;
  grupo: string;
  aula: string;
  dias: string[];
  horaInicio: string;
  horaFin: string;
  desde: string;
  hasta: string;
}

export interface ClasePrevista {
  asignacionId: string;
  grupo: string;
  aula: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

/** Letra del día (L, M, X, J, V, S, D) de una fecha AAAA-MM-DD. */
export function diaDe(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return DIAS[(dow + 6) % 7];
}

export function clasesDelDia(asignaciones: AsignacionLite[], fecha: string): ClasePrevista[] {
  const dia = diaDe(fecha);
  return asignaciones
    .filter((a) => a.desde <= fecha && fecha <= a.hasta && a.dias.includes(dia))
    .map((a) => ({ asignacionId: a.id, grupo: a.grupo, aula: a.aula, fecha, horaInicio: a.horaInicio, horaFin: a.horaFin }))
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}
