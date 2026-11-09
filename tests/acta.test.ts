import { test } from "node:test";
import assert from "node:assert/strict";
import { leerActas, leerHorario, leerPeriodo } from "../shared/acta";

// Acta real del CLM (texto tal como se copia de la intranet o del PDF).
const ACTA = `Curso Académico:\tCurso Académico 2026-2027
Curso:\tCurso Intensivo de Lengua Española
Período:\tdel 4 de noviembre al 1 de diciembre
Asignatura:\tEspañol
Grupo:\t0501
Profesores:\tGARCÍA GARCÍA, AGUSTINA / BENÍTEZ LAÍNEZ, JAVIER
Aula:\tB14
Horario:\t10:30 - 12:30: L, M, X, J, V
Fecha de impresión:\t9 de Noviembre de 2026
NºNombre\tObservaciones
1 ALUMNO, UNO`;

test("acta del CLM: grupo, aula, días, horas y período", () => {
  const r = leerActas(ACTA);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.actas.length, 1);
  assert.deepEqual(r.actas[0].asignacion, {
    grupo: "0501",
    aula: "B14",
    dias: ["L", "M", "X", "J", "V"],
    horaInicio: "10:30",
    horaFin: "12:30",
    desde: "2026-11-04",
    hasta: "2026-12-01",
    nota: "Curso Intensivo de Lengua Española · Español",
  });
  // No se guardan los nombres de otros profesores ni del alumnado.
  assert.doesNotMatch(JSON.stringify(r.actas), /GARCÍA|ALUMNO/);
});

test("también con la etiqueta y el valor en líneas distintas (copiado de un PDF)", () => {
  const pdf = ACTA.replace(/:\t/g, ":\n");
  const r = leerActas(pdf);
  assert.equal(r.ok && r.actas[0].asignacion.grupo, "0501");
});

test("varias actas pegadas seguidas", () => {
  const otra = ACTA.replace("0501", "0702").replace("B14", "A3").replace("10:30 - 12:30", "17:00 - 19:00").replace("L, M, X, J, V", "M, J");
  const r = leerActas(`${ACTA}\n\n${otra}`);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.actas.map((a) => [a.asignacion.grupo, a.asignacion.dias.join("")]), [["0501", "LMXJV"], ["0702", "MJ"]]);
});

test("período: año del curso académico (de enero a agosto, el segundo año)", () => {
  assert.deepEqual(leerPeriodo("del 8 de enero al 2 de febrero", "Curso Académico 2026-2027"), { desde: "2027-01-08", hasta: "2027-02-02" });
  assert.deepEqual(leerPeriodo("del 14 de diciembre al 20 de enero", "Curso Académico 2026-2027"), { desde: "2026-12-14", hasta: "2027-01-20" });
  assert.deepEqual(leerPeriodo("del 3 de marzo al 1 de abril", undefined, "9 de Noviembre de 2026"), { desde: "2026-03-03", hasta: "2026-04-01" });
  assert.equal(leerPeriodo("cuando sea"), null);
});

test("horario con varias franjas y días escritos enteros", () => {
  assert.deepEqual(leerHorario("10:30 - 12:30: L, X / 16:00 - 18:00: martes y jueves"), [
    { horaInicio: "10:30", horaFin: "12:30", dias: ["L", "X"] },
    { horaInicio: "16:00", horaFin: "18:00", dias: ["M", "J"] },
  ]);
});

test("un texto que no es un acta da un error claro", () => {
  const r = leerActas("hola, esto no es un acta");
  assert.equal(r.ok, false);
  assert.match(r.errores[0], /grupo/);
});

test("fecha corta para mostrar", async () => {
  const { fechaCorta } = await import("../shared/acta");
  assert.equal(fechaCorta("2026-11-04"), "4/11/2026");
});

test("acta trimestral: período sin «de» y profesor en singular", () => {
  const r = leerActas(`Curso Académico:\tCurso Académico 2026-2027
Curso:\tCurso de Lengua y Cultura Españolas
Período:\tdel 1 octubre al 22 diciembre
Asignatura:\tProducción Oral y Escrita
Grupo:\t0403
Profesor:\tBENÍTEZ LAÍNEZ, JAVIER
Aula:\tB16
Horario:\t12:30 - 14:30: M, J
Fecha de impresión:\t9 de Noviembre de 2026
NºNombre\tObservaciones`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.actas[0].asignacion, {
    grupo: "0403",
    aula: "B16",
    dias: ["M", "J"],
    horaInicio: "12:30",
    horaFin: "14:30",
    desde: "2026-10-01",
    hasta: "2026-12-22",
    nota: "Curso de Lengua y Cultura Españolas · Producción Oral y Escrita",
  });
});
