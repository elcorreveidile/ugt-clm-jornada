// Lee el horario de las actas de la intranet del CLM (texto copiado de la página
// o del PDF). Formato de ejemplo:
//
//   Curso Académico: Curso Académico 2026-2027
//   Curso: Curso Intensivo de Lengua Española
//   Período: del 4 de noviembre al 1 de diciembre
//   Asignatura: Español
//   Grupo: 0501
//   Profesores: …
//   Aula: B14
//   Horario: 10:30 - 12:30: L, M, X, J, V
//   Fecha de impresión: 9 de Noviembre de 2026
//
// Se pueden pegar varias actas seguidas. Los nombres de los profesores no se
// guardan (son datos de terceras personas).
import { asignacionSchema, DIAS, type AsignacionInput } from "./events";

const LABELS: [key: string, re: string][] = [
  ["cursoAcademico", "Curso\\s+Acad[ée]mico"],
  ["curso", "Curso(?!\\s+Acad)"],
  ["periodo", "Per[ií]odo"],
  ["asignatura", "Asignatura"],
  ["grupo", "Grupo"],
  ["profesores", "Profesor(?:es|a|as)?"],
  ["aula", "Aula"],
  ["horario", "Horario"],
  ["fechaImpresion", "Fecha\\s+de\\s+impresi[óo]n"],
  ["fin", "N[ºo°]\\s*Nombre"],
];

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const DIA_PALABRA: Record<string, string> = {
  lunes: "L", martes: "M", miercoles: "X", miércoles: "X", jueves: "J", viernes: "V", sabado: "S", sábado: "S", domingo: "D",
};

export interface ActaLeida {
  asignacion: AsignacionInput;
  /** Texto corto para la vista previa. */
  resumen: string;
}
export type ActaResultado = { ok: true; actas: ActaLeida[]; errores: string[] } | { ok: false; errores: string[] };

/** Separa el texto en campos «Etiqueta: valor» (valor en la misma línea o en la siguiente). */
function campos(bloque: string): Record<string, string> {
  const re = new RegExp(`(${LABELS.map(([, r]) => r).join("|")})\\s*:`, "gi");
  const marcas = [...bloque.matchAll(re)];
  const out: Record<string, string> = {};
  marcas.forEach((m, i) => {
    const etiqueta = m[1];
    const key = LABELS.find(([, r]) => new RegExp(`^${r}$`, "i").test(etiqueta))?.[0];
    const desde = (m.index ?? 0) + m[0].length;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].index : bloque.length;
    const valor = bloque.slice(desde, hasta).replace(/\s+/g, " ").trim();
    if (key && !(key in out)) out[key] = valor;
  });
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** AAAA-MM-DD → D/M/AAAA. */
export const fechaCorta = (iso: string) => iso.split("-").reverse().map((x, i) => (i < 2 ? String(Number(x)) : x)).join("/");

/** «del 4 de noviembre al 1 de diciembre» → fechas ISO, con el año del curso académico. */
export function leerPeriodo(texto: string, cursoAcademico?: string, fechaImpresion?: string): { desde: string; hasta: string } | null {
  const t = texto.toLowerCase();
  // «del 4 de noviembre al 1 de diciembre» o, en algunas actas, «del 1 octubre al 22 diciembre».
  const m = t.match(/(\d{1,2})\s+(?:de\s+)?([a-zé]+)(?:\s+(?:de\s+)?(\d{4}))?\s+(?:al|a|hasta(?:\s+el)?)\s+(\d{1,2})\s+(?:de\s+)?([a-zé]+)(?:\s+(?:de\s+)?(\d{4}))?/);
  if (!m) return null;
  const m1 = MESES[m[2]];
  const m2 = MESES[m[5]];
  if (!m1 || !m2) return null;
  const anios = cursoAcademico?.match(/(\d{4})\s*[-/]\s*(\d{4})/);
  const anioImp = fechaImpresion?.match(/(\d{4})/)?.[1];
  // En un curso académico 2026-2027, de septiembre a diciembre es 2026 y de enero a agosto, 2027.
  const anioDe = (mes: number, explicito?: string): number | null => {
    if (explicito) return Number(explicito);
    if (anios) return mes >= 9 ? Number(anios[1]) : Number(anios[2]);
    if (anioImp) return Number(anioImp);
    return null;
  };
  const a1 = anioDe(m1, m[3]);
  let a2 = anioDe(m2, m[6]);
  if (!a1 || !a2) return null;
  if (!m[6] && !anios && (a2 < a1 || (a2 === a1 && m2 < m1))) a2 = a1 + 1;
  const desde = `${a1}-${pad(m1)}-${pad(Number(m[1]))}`;
  const hasta = `${a2}-${pad(m2)}-${pad(Number(m[4]))}`;
  return desde <= hasta ? { desde, hasta } : null;
}

/** «10:30 - 12:30: L, M, X, J, V» (puede haber varias franjas) → franjas con sus días. */
export function leerHorario(texto: string): { horaInicio: string; horaFin: string; dias: string[] }[] {
  const out: { horaInicio: string; horaFin: string; dias: string[] }[] = [];
  const re = /(\d{1,2})[:.h](\d{2})\s*(?:-|–|a|hasta)\s*(\d{1,2})[:.h](\d{2})\s*:?\s*([^0-9]*)/gi;
  for (const m of texto.matchAll(re)) {
    const dias = new Set<string>();
    for (const w of m[5].toLowerCase().split(/[\s,;/y]+/).filter(Boolean)) {
      const letra = DIA_PALABRA[w] ?? (w.length === 1 ? w.toUpperCase() : "");
      if ((DIAS as readonly string[]).includes(letra)) dias.add(letra);
    }
    if (dias.size === 0) continue;
    out.push({
      horaInicio: `${pad(Number(m[1]))}:${m[2]}`,
      horaFin: `${pad(Number(m[3]))}:${m[4]}`,
      dias: DIAS.filter((d) => dias.has(d)),
    });
  }
  return out;
}

/** Lee una o varias actas pegadas. Cada franja horaria distinta es una entrada del horario. */
export function leerActas(texto: string): ActaResultado {
  const limpio = texto.replace(/\r/g, "").replace(/ /g, " ");
  // Cada acta empieza en «Curso Académico:»; si no aparece, se trata todo como una sola.
  const inicios = [...limpio.matchAll(/Curso\s+Acad[ée]mico\s*:/gi)].map((m) => m.index ?? 0);
  const bloques = inicios.length ? inicios.map((ini, i) => limpio.slice(ini, inicios[i + 1] ?? limpio.length)) : [limpio];
  const actas: ActaLeida[] = [];
  const errores: string[] = [];
  bloques.forEach((b, i) => {
    const n = bloques.length > 1 ? `Acta ${i + 1}: ` : "";
    const c = campos(b);
    if (!c.grupo) return errores.push(`${n}no encuentro el grupo.`);
    const periodo = c.periodo ? leerPeriodo(c.periodo, c.cursoAcademico, c.fechaImpresion) : null;
    if (!periodo) return errores.push(`${n}no entiendo el período («${c.periodo ?? "falta"}»).`);
    const franjas = c.horario ? leerHorario(c.horario) : [];
    if (!franjas.length) return errores.push(`${n}no entiendo el horario («${c.horario ?? "falta"}»).`);
    const nota = [c.curso, c.asignatura].filter(Boolean).join(" · ").slice(0, 200) || undefined;
    for (const f of franjas) {
      const r = asignacionSchema.safeParse({ grupo: c.grupo, aula: c.aula, ...f, ...periodo, nota });
      if (!r.success) {
        errores.push(`${n}${r.error.issues[0]?.message ?? "datos no válidos"}.`);
        continue;
      }
      actas.push({
        asignacion: r.data,
        resumen: `Grupo ${r.data.grupo}${r.data.aula ? ` · Aula ${r.data.aula}` : ""} · ${f.dias.join(", ")} ${f.horaInicio}–${f.horaFin} · del ${fechaCorta(periodo.desde)} al ${fechaCorta(periodo.hasta)}`,
      });
    }
  });
  return actas.length ? { ok: true, actas, errores } : { ok: false, errores: errores.length ? errores : ["No he encontrado ningún acta en el texto."] };
}
