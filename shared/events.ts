// Tipos y validación de las anotaciones del registro. Lo comparten la app
// (formularios) y el servidor (autoridad: todo lo que entra se valida aquí).
import { z } from "zod";

export const ACTIVITY_KINDS = ["CLASE", "SUSTITUCION", "PRUEBA_NIVEL", "JORNADA", "DESPLAZAMIENTO", "GUARDIA", "PAUSA", "INCIDENCIA"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const KIND_LABEL: Record<ActivityKind, string> = {
  CLASE: "Clase",
  SUSTITUCION: "Sustitución",
  PRUEBA_NIVEL: "Prueba de nivel",
  JORNADA: "Jornada",
  DESPLAZAMIENTO: "Desplazamiento",
  GUARDIA: "Guardia o disponibilidad",
  PAUSA: "Pausa",
  INCIDENCIA: "Otra actividad o incidencia",
};

/** Una pausa va dentro de otra actividad abierta y no suma tiempo efectivo. */
export const isPausa = (k: string) => k === "PAUSA";

export const INCIDENCIA_CATS = [
  "REUNION",
  "TUTORIA",
  "EVALUACION",
  "ACTIVIDAD_COMPLEMENTARIA",
  "FORMACION",
  "CAMBIO_AULA",
  "PROLONGACION",
  "PROBLEMA_TECNICO",
  "HORAS_EXTRA",
  "CAMBIO_TURNO",
  "DESCANSO_NO_DISFRUTADO",
  "LLAMADA_FUERA_TURNO",
  "HORAS_COMPLEMENTARIAS",
  "CARGA_EXCESIVA",
  "OTRA",
] as const;
export type IncidenciaCat = (typeof INCIDENCIA_CATS)[number];

export const CAT_LABEL: Record<IncidenciaCat, string> = {
  REUNION: "Reunión",
  TUTORIA: "Tutoría o atención al alumnado",
  EVALUACION: "Corrección o evaluación",
  ACTIVIDAD_COMPLEMENTARIA: "Actividad complementaria",
  FORMACION: "Formación",
  CAMBIO_AULA: "Cambio de aula o aula no disponible",
  PROLONGACION: "Prolongación de jornada",
  PROBLEMA_TECNICO: "Problema técnico",
  HORAS_EXTRA: "Horas extra",
  CAMBIO_TURNO: "Cambio de turno sin preaviso",
  DESCANSO_NO_DISFRUTADO: "Descanso no disfrutado",
  LLAMADA_FUERA_TURNO: "Me llamaron fuera de mi turno",
  HORAS_COMPLEMENTARIAS: "Horas complementarias (tiempo parcial)",
  CARGA_EXCESIVA: "Carga de trabajo excesiva",
  OTRA: "Otra",
};

/** Tipos de anotación del registro (lo que se encadena y se sella). */
export const ENTRY_TYPES = [
  "INICIO", // empiezo ahora (en el momento)
  "FIN", // termino ahora (en el momento), cierra un INICIO
  "REGISTRO", // actividad apuntada después, con sus horas
  "NO_IMPARTIDA", // clase prevista que no se dio, con motivo
  "CORRECCION", // sustituye los datos de una actividad anterior (la original queda)
  "ANULACION", // deja sin efecto una actividad anterior (la original queda)
  "HORARIO", // horario asignado (desde el acta), como constancia
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_LABEL: Record<EntryType, string> = {
  INICIO: "Inicio",
  FIN: "Fin",
  REGISTRO: "Registro posterior",
  NO_IMPARTIDA: "No realizada",
  CORRECCION: "Corrección",
  ANULACION: "Anulación",
  HORARIO: "Horario asignado",
};

const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : undefined))
    .optional();
const isoInstant = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v)), "Fecha no válida")
  .transform((v) => new Date(v).toISOString());

export const activitySchema = z
  .object({
    kind: z.enum(ACTIVITY_KINDS),
    grupo: optText(80),
    aula: optText(40),
    sustituye: optText(120),
    categoria: z.enum(INCIDENCIA_CATS).optional(),
    descripcion: optText(1000),
    asignacionId: optText(40),
    /** Cantidad opcional (habitaciones, domicilios, entregas…) según el colectivo. */
    cantidad: z.coerce.number().int().min(0).max(10000).optional(),
  })
  .superRefine((a, ctx) => {
    const need = (field: keyof typeof a, msg: string) => {
      if (!a[field]) ctx.addIssue({ code: "custom", path: [field], message: msg });
    };
    if (a.kind === "CLASE") {
      need("grupo", "Indica el grupo");
      need("aula", "Indica el aula");
    }
    if (a.kind === "SUSTITUCION") {
      need("grupo", "Indica el grupo");
      need("aula", "Indica el aula");
      need("sustituye", "Indica a quién sustituyes");
    }
    if (a.kind === "INCIDENCIA") {
      need("categoria", "Elige el tipo de incidencia");
      need("descripcion", "Describe la incidencia");
    }
  });
export type Activity = z.infer<typeof activitySchema>;

const refId = z.string().min(1).max(40);

export const entryInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INICIO"), activity: activitySchema }),
  z.object({ type: z.literal("FIN"), ref: refId }),
  z.object({
    type: z.literal("REGISTRO"),
    activity: activitySchema,
    start: isoInstant,
    end: isoInstant.optional(),
    nota: optText(500),
  }),
  z.object({
    type: z.literal("NO_IMPARTIDA"),
    grupo: text(80),
    aula: optText(40),
    start: isoInstant,
    end: isoInstant,
    motivo: text(500),
    asignacionId: optText(40),
  }),
  z.object({
    type: z.literal("CORRECCION"),
    ref: refId,
    activity: activitySchema,
    start: isoInstant,
    end: isoInstant.optional(),
    motivo: text(500),
  }),
  z.object({ type: z.literal("ANULACION"), ref: refId, motivo: text(500) }),
]);
export type EntryInput = z.infer<typeof entryInputSchema>;

/** Horario asignado (de las actas de la intranet). */
export const DIAS = ["L", "M", "X", "J", "V", "S", "D"] as const;
export const asignacionSchema = z
  .object({
    grupo: text(80),
    aula: optText(40),
    dias: z.array(z.enum(DIAS)).min(1, "Elige al menos un día"),
    horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
    horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    nota: optText(200),
  })
  // Si la hora de fin es anterior a la de inicio, es un turno de noche que acaba al día siguiente.
  .refine((a) => a.horaInicio !== a.horaFin, { path: ["horaFin"], message: "La hora de fin no puede ser igual a la de inicio" })
  .refine((a) => a.desde <= a.hasta, { path: ["hasta"], message: "El periodo termina antes de empezar" });
export type AsignacionInput = z.infer<typeof asignacionSchema>;

/** Zona horaria del centro: todas las horas se muestran y se calculan en ella. */
export const TZ = "Europe/Madrid";
