// Perfiles por colectivo. La herramienta es la misma para todos (anotaciones
// encadenadas y selladas); lo que cambia es qué se registra y cómo se llama.
// Añadir un colectivo nuevo = añadir un perfil aquí.
import { KIND_LABEL, type ActivityKind, type IncidenciaCat } from "./events";
import type { Horario } from "./centro";

export const PERFIL_IDS = [
  "DOCENCIA",
  "HOSTELERIA",
  "COMERCIO",
  "LIMPIEZA",
  "CUIDADOS",
  "SANIDAD",
  "TRANSPORTE",
  "SEGURIDAD",
  "AGRO",
  "GENERAL",
] as const;
export type PerfilId = (typeof PERFIL_IDS)[number];

export interface Perfil {
  id: PerfilId;
  nombre: string;
  descripcion: string;
  /** Tipos de actividad que se ofrecen, en este orden. */
  kinds: ActivityKind[];
  /** Tipo de lo que se planifica en el horario (clase, turno…). */
  planificado: ActivityKind;
  /** Nombres de los dos campos de lugar/puesto (internamente: grupo y aula). */
  campos: { grupo: string; aula: string; grupoEj: string; aulaEj: string };
  /** Si se muestra, nombre del campo de cantidad (habitaciones, domicilios…). */
  cantidad?: string;
  /** Etiquetas propias de este colectivo para algunos tipos. */
  etiquetas: Partial<Record<ActivityKind | "NO_IMPARTIDA", string>>;
  incidencias: IncidenciaCat[];
  horario: Horario;
  textos: {
    previstosHoy: string;
    empezar: string;
    terminar: string;
    noHecho: string;
    noHechoMotivo: string;
    horarioTitulo: string;
    horarioIntro: string;
    horarioAnadir: string;
  };
}

const SIN_HORARIO: Horario = { apertura: null, cierre: null, inicioTarde: "15:00" };

const INC_TURNOS: IncidenciaCat[] = [
  "HORAS_EXTRA",
  "PROLONGACION",
  "CAMBIO_TURNO",
  "DESCANSO_NO_DISFRUTADO",
  "LLAMADA_FUERA_TURNO",
  "CARGA_EXCESIVA",
  "FORMACION",
  "REUNION",
  "OTRA",
];

const TEXTOS_TURNOS: Perfil["textos"] = {
  previstosHoy: "Turnos previstos hoy",
  empezar: "Fichar entrada",
  terminar: "Fichar salida",
  noHecho: "No lo trabajé",
  noHechoMotivo: "Motivo (p. ej.: me cambiaron el turno, me mandaron a casa, libranza)",
  horarioTitulo: "Mi cuadrante",
  horarioIntro:
    "Apunta los turnos de tu cuadrante (días, horas y periodo). Cada día la app te propondrá fichar el turno que toca. Un turno partido son dos turnos el mismo día; uno de noche puede terminar al día siguiente.",
  horarioAnadir: "Añadir un turno",
};

/** Perfil basado en turnos, el caso más común. */
function turnos(
  id: PerfilId,
  nombre: string,
  descripcion: string,
  extra: Partial<Omit<Perfil, "id" | "nombre" | "descripcion">> = {},
): Perfil {
  return {
    id,
    nombre,
    descripcion,
    kinds: ["JORNADA", "PAUSA", "INCIDENCIA"],
    planificado: "JORNADA",
    campos: { grupo: "Puesto o sección", aula: "Centro o local", grupoEj: "Ej.: caja, almacén", aulaEj: "Ej.: tienda Centro" },
    etiquetas: { JORNADA: "Turno", NO_IMPARTIDA: "Turno no trabajado" },
    incidencias: INC_TURNOS,
    horario: SIN_HORARIO,
    textos: TEXTOS_TURNOS,
    ...extra,
  };
}

export const PERFILES: Record<PerfilId, Perfil> = {
  DOCENCIA: {
    id: "DOCENCIA",
    nombre: "Docencia",
    descripcion: "Profesorado y formación: clases, sustituciones, pruebas de nivel e incidencias.",
    kinds: ["CLASE", "SUSTITUCION", "PRUEBA_NIVEL", "INCIDENCIA", "PAUSA"],
    planificado: "CLASE",
    campos: { grupo: "Grupo", aula: "Aula", grupoEj: "Ej.: B1.2 · 3", aulaEj: "Ej.: 12" },
    etiquetas: { NO_IMPARTIDA: "Clase no impartida" },
    incidencias: ["REUNION", "TUTORIA", "EVALUACION", "ACTIVIDAD_COMPLEMENTARIA", "FORMACION", "CAMBIO_AULA", "PROLONGACION", "PROBLEMA_TECNICO", "OTRA"],
    horario: { apertura: "08:30", cierre: "22:00", inicioTarde: "15:00" },
    textos: {
      previstosHoy: "Clases previstas hoy",
      empezar: "Empezar clase",
      terminar: "Terminar ahora",
      noHecho: "No se dio",
      noHechoMotivo: "Motivo (p. ej.: festivo, huelga, el grupo no vino, me mandaron a otra tarea)",
      horarioTitulo: "Mi horario",
      horarioIntro:
        "Copia aquí los grupos de tus actas (grupo, aula y horario) para el mes o el trimestre. Cada día la app te propondrá las clases que tocan. Puedes tener grupos de mañana y de tarde.",
      horarioAnadir: "Añadir un grupo",
    },
  },
  HOSTELERIA: turnos("HOSTELERIA", "Hostelería", "Restaurantes, bares, hoteles y catering: turnos (también partidos o de noche), pausas e incidencias.", {
    campos: { grupo: "Puesto o sección", aula: "Local u hotel", grupoEj: "Ej.: cocina, sala, barra, pisos", aulaEj: "Ej.: Hotel Centro" },
    cantidad: "Habitaciones o servicios (opcional)",
  }),
  COMERCIO: turnos("COMERCIO", "Comercio", "Tiendas y grandes superficies: turnos, domingos y festivos, horas complementarias.", {
    incidencias: ["HORAS_COMPLEMENTARIAS", ...INC_TURNOS],
  }),
  LIMPIEZA: turnos("LIMPIEZA", "Limpieza", "Limpieza de edificios y locales: varios centros al día y desplazamientos entre ellos.", {
    kinds: ["JORNADA", "DESPLAZAMIENTO", "PAUSA", "INCIDENCIA"],
    campos: { grupo: "Tarea", aula: "Centro que limpias", grupoEj: "Ej.: oficinas, cristales", aulaEj: "Ej.: Edificio Norte" },
    etiquetas: { JORNADA: "Servicio", NO_IMPARTIDA: "Servicio no realizado" },
    incidencias: ["HORAS_COMPLEMENTARIAS", ...INC_TURNOS],
  }),
  CUIDADOS: turnos("CUIDADOS", "Cuidados", "Ayuda a domicilio y residencias: servicios por domicilio y desplazamientos entre ellos.", {
    kinds: ["JORNADA", "DESPLAZAMIENTO", "PAUSA", "INCIDENCIA"],
    campos: { grupo: "Servicio", aula: "Domicilio o centro", grupoEj: "Ej.: aseo, comida", aulaEj: "Ej.: usuario/a 12 (sin datos personales)" },
    cantidad: "Domicilios atendidos (opcional)",
    etiquetas: { JORNADA: "Servicio", NO_IMPARTIDA: "Servicio no realizado" },
    incidencias: ["HORAS_COMPLEMENTARIAS", ...INC_TURNOS],
  }),
  SANIDAD: turnos("SANIDAD", "Sanidad y sociosanitario", "Hospitales, clínicas y residencias: turnos de noche, guardias y doblajes.", {
    kinds: ["JORNADA", "GUARDIA", "PAUSA", "INCIDENCIA"],
    campos: { grupo: "Unidad o servicio", aula: "Centro", grupoEj: "Ej.: urgencias, planta 3", aulaEj: "Ej.: Hospital X" },
  }),
  TRANSPORTE: turnos("TRANSPORTE", "Transporte y reparto", "Conducción, reparto y logística: conducción, carga, esperas y descansos.", {
    kinds: ["JORNADA", "DESPLAZAMIENTO", "GUARDIA", "PAUSA", "INCIDENCIA"],
    campos: { grupo: "Tarea o ruta", aula: "Base o almacén", grupoEj: "Ej.: ruta 4, carga", aulaEj: "Ej.: nave Polígono Sur" },
    cantidad: "Entregas o paradas (opcional)",
    etiquetas: { JORNADA: "Jornada", DESPLAZAMIENTO: "Conducción", GUARDIA: "Espera o disponibilidad", NO_IMPARTIDA: "Jornada no trabajada" },
  }),
  SEGURIDAD: turnos("SEGURIDAD", "Seguridad privada", "Vigilancia y control de accesos: servicios por puesto, noches y horas extra.", {
    campos: { grupo: "Servicio o puesto", aula: "Instalación", grupoEj: "Ej.: control de accesos", aulaEj: "Ej.: Centro comercial X" },
    etiquetas: { JORNADA: "Servicio", NO_IMPARTIDA: "Servicio no realizado" },
  }),
  AGRO: turnos("AGRO", "Campo y manipulado", "Campo, almacenes y manipulado de fruta y hortaliza: jornadas de campaña.", {
    campos: { grupo: "Tarea", aula: "Finca o almacén", grupoEj: "Ej.: recolección, envasado", aulaEj: "Ej.: Almacén Motril" },
    cantidad: "Cajas o kilos (opcional)",
    etiquetas: { JORNADA: "Jornada", NO_IMPARTIDA: "Jornada no trabajada" },
  }),
  GENERAL: turnos("GENERAL", "Otro colectivo", "Cualquier otro trabajo: jornada, pausas, desplazamientos e incidencias.", {
    kinds: ["JORNADA", "DESPLAZAMIENTO", "GUARDIA", "PAUSA", "INCIDENCIA"],
    campos: { grupo: "Puesto o tarea", aula: "Lugar", grupoEj: "Ej.: administración", aulaEj: "Ej.: sede central" },
    etiquetas: { JORNADA: "Jornada", NO_IMPARTIDA: "Jornada no trabajada" },
    textos: {
      ...TEXTOS_TURNOS,
      previstosHoy: "Previsto para hoy",
      horarioTitulo: "Mi horario",
      horarioIntro: "Apunta tu horario previsto (días, horas y periodo). Cada día la app te propondrá fichar lo que toca.",
      horarioAnadir: "Añadir un horario",
    },
  }),
};

/** Nombre de un tipo de actividad en este colectivo. */
export function etiqueta(p: Perfil, kind: ActivityKind | "NO_IMPARTIDA"): string {
  return p.etiquetas[kind] ?? (kind === "NO_IMPARTIDA" ? "No realizada" : KIND_LABEL[kind]);
}

export function perfilDe(id: string | null | undefined): Perfil {
  return PERFILES[(id ?? "") as PerfilId] ?? PERFILES.GENERAL;
}
