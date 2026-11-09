// A partir de las anotaciones (que nunca se tocan) se reconstruye el estado de
// cada actividad: su versión vigente, si sigue en curso, si se corrigió o se
// anuló. Es puro: lo usan el servidor (reglas, informes) y la app (pantallas).
import { isPausa, type Activity, type ActivityKind, type EntryInput, type EntryType } from "./events";

export type Mode = "MOMENTO" | "POSTERIOR";

export interface LedgerEntry {
  id: string;
  seq: number;
  type: EntryType;
  payload: Record<string, unknown>;
  start: string | null;
  end: string | null;
  recordedAt: string;
  mode: Mode;
  prevHash: string;
  hash: string;
  tsa: { genTime: string; provider: string; qualified: boolean } | null;
}

export type ActivityStatus = "EN_CURSO" | "CERRADA" | "ANULADA" | "NO_IMPARTIDA";

export interface DerivedActivity {
  rootId: string;
  rootSeq: number;
  /** Tipo de actividad; NO_IMPARTIDA cuando se apuntó una clase que no se dio. */
  kind: ActivityKind | "NO_IMPARTIDA";
  activity: Activity | null;
  grupo: string | null;
  aula: string | null;
  start: string;
  end: string | null;
  /** Cómo se apuntó la versión original. */
  mode: Mode;
  status: ActivityStatus;
  corrected: boolean;
  /** Motivo de la última corrección, de la anulación o de la clase no impartida. */
  motivo: string | null;
  nota: string | null;
  /** Números de las anotaciones que la componen, en orden. */
  seqs: number[];
}

export function deriveActivities(entries: LedgerEntry[]): DerivedActivity[] {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const byRoot = new Map<string, DerivedActivity>();
  const rootOf = new Map<string, string>(); // id de anotación → id de la raíz
  const order: string[] = [];

  const add = (e: LedgerEntry, a: DerivedActivity) => {
    byRoot.set(e.id, a);
    rootOf.set(e.id, e.id);
    order.push(e.id);
  };

  for (const e of sorted) {
    const p = e.payload;
    switch (e.type) {
      case "INICIO":
      case "REGISTRO": {
        const act = p.activity as Activity;
        add(e, {
          rootId: e.id,
          rootSeq: e.seq,
          kind: act.kind,
          activity: act,
          grupo: act.grupo ?? null,
          aula: act.aula ?? null,
          start: e.start ?? e.recordedAt,
          end: e.type === "INICIO" ? null : e.end,
          mode: e.mode,
          status: e.type === "INICIO" ? "EN_CURSO" : "CERRADA",
          corrected: false,
          motivo: null,
          nota: (p.nota as string | undefined) ?? null,
          seqs: [e.seq],
        });
        break;
      }
      case "NO_IMPARTIDA":
        add(e, {
          rootId: e.id,
          rootSeq: e.seq,
          kind: "NO_IMPARTIDA",
          activity: null,
          grupo: (p.grupo as string) ?? null,
          aula: (p.aula as string | undefined) ?? null,
          start: e.start ?? e.recordedAt,
          end: e.end,
          mode: e.mode,
          status: "NO_IMPARTIDA",
          corrected: false,
          motivo: (p.motivo as string) ?? null,
          nota: null,
          seqs: [e.seq],
        });
        break;
      case "FIN":
      case "CORRECCION":
      case "ANULACION": {
        const root = rootOf.get(p.ref as string);
        const a = root ? byRoot.get(root) : undefined;
        if (!a) break; // las reglas impiden esto; si ocurre, se ignora
        rootOf.set(e.id, a.rootId);
        a.seqs.push(e.seq);
        if (e.type === "FIN") {
          a.end = e.end ?? e.recordedAt;
          if (a.status === "EN_CURSO") a.status = "CERRADA";
        } else if (e.type === "CORRECCION") {
          const act = p.activity as Activity;
          a.kind = act.kind;
          a.activity = act;
          a.grupo = act.grupo ?? null;
          a.aula = act.aula ?? null;
          a.start = e.start ?? a.start;
          a.end = e.end;
          a.corrected = true;
          a.motivo = (p.motivo as string) ?? null;
          if (a.status === "EN_CURSO" || a.status === "NO_IMPARTIDA") a.status = a.end ? "CERRADA" : "EN_CURSO";
        } else {
          a.status = "ANULADA";
          a.motivo = (p.motivo as string) ?? null;
        }
        break;
      }
      default:
        break; // HORARIO no es una actividad
    }
  }
  return order.map((id) => byRoot.get(id)!);
}

/** Minutos de una actividad cerrada (0 si está anulada, no realizada o abierta). Las pausas
 * también devuelven su duración: el tiempo efectivo se calcula con `tiempos`. */
export function activityMinutes(a: DerivedActivity): number {
  if (a.status !== "CERRADA" || !a.end) return 0;
  const ms = Date.parse(a.end) - Date.parse(a.start);
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

/** Presencia (todo menos pausas), pausas y tiempo efectivo (presencia − pausas). */
export function tiempos(acts: DerivedActivity[]): { presencia: number; pausas: number; efectivo: number } {
  let presencia = 0;
  let pausas = 0;
  for (const a of acts) {
    const m = activityMinutes(a);
    if (a.kind !== "NO_IMPARTIDA" && isPausa(a.kind)) pausas += m;
    else presencia += m;
  }
  return { presencia, pausas, efectivo: Math.max(0, presencia - pausas) };
}

/** Margen admitido para relojes ligeramente adelantados del dispositivo. */
const CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * Reglas de negocio antes de añadir una anotación. Devuelve el mensaje de error
 * o null si se puede añadir. `now` es la hora del servidor.
 */
export function checkEntry(entries: LedgerEntry[], input: EntryInput, now: Date): string | null {
  const acts = deriveActivities(entries);
  const abiertas = acts.filter((a) => a.status === "EN_CURSO");
  const open = abiertas.find((a) => a.kind === "NO_IMPARTIDA" || !isPausa(a.kind));
  const pausaAbierta = abiertas.find((a) => a.kind !== "NO_IMPARTIDA" && isPausa(a.kind));
  const future = (iso: string) => Date.parse(iso) > now.getTime() + CLOCK_SKEW_MS;
  const findRoot = (ref: string): DerivedActivity | undefined => {
    const e = entries.find((x) => x.id === ref);
    if (!e) return undefined;
    return acts.find((a) => a.seqs.includes(e.seq));
  };

  switch (input.type) {
    case "INICIO":
      if (isPausa(input.activity.kind)) {
        if (!open) return "La pausa se ficha dentro de una jornada, turno o clase en curso.";
        if (pausaAbierta) return "Ya tienes una pausa en curso.";
        return null;
      }
      if (open) return "Ya tienes una actividad en curso: termínala antes de empezar otra.";
      return null;
    case "FIN": {
      const a = findRoot(input.ref);
      if (!a || a.rootId !== input.ref) return "No se encuentra la actividad que quieres terminar.";
      if (a.status !== "EN_CURSO") return "Esa actividad ya no está en curso.";
      if (pausaAbierta && a.rootId !== pausaAbierta.rootId) return "Termina antes la pausa.";
      return null;
    }
    case "REGISTRO":
    case "CORRECCION": {
      if (future(input.start) || (input.end && future(input.end))) return "No se pueden apuntar horas futuras.";
      if (input.end && input.end <= input.start) return "La hora de fin debe ser posterior a la de inicio.";
      if (input.end && Date.parse(input.end) - Date.parse(input.start) > 16 * 3600 * 1000)
        return "Una actividad no puede durar más de 16 horas.";
      if (input.type === "REGISTRO" && !input.end && input.activity.kind !== "INCIDENCIA")
        return "Indica la hora de fin.";
      if (input.type === "CORRECCION") {
        const a = findRoot(input.ref);
        if (!a) return "No se encuentra la actividad que quieres corregir.";
        if (a.status === "ANULADA") return "Esa actividad está anulada.";
        if (!input.end && input.activity.kind !== "INCIDENCIA") return "Indica la hora de fin.";
      }
      return null;
    }
    case "NO_IMPARTIDA":
      if (input.end <= input.start) return "La hora de fin debe ser posterior a la de inicio.";
      return null;
    case "ANULACION": {
      const a = findRoot(input.ref);
      if (!a) return "No se encuentra la actividad que quieres anular.";
      if (a.status === "ANULADA") return "Esa actividad ya está anulada.";
      return null;
    }
  }
}
