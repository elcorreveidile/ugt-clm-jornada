import { test } from "node:test";
import assert from "node:assert/strict";
import { fueraDeHorario, horaLocal, localToIso, turno } from "../shared/centro";

test("hora local de Madrid con cambio de hora", () => {
  assert.equal(localToIso("2026-11-09", "08:30"), "2026-11-09T07:30:00.000Z"); // invierno, UTC+1
  assert.equal(localToIso("2026-06-09", "08:30"), "2026-06-09T06:30:00.000Z"); // verano, UTC+2
  assert.equal(horaLocal("2026-11-09T07:30:00.000Z"), "08:30");
});

test("turno y fuera de horario (por defecto 8:30–22:00; configurable)", () => {
  assert.equal(turno(localToIso("2026-11-09", "08:30")), "Mañana");
  assert.equal(turno(localToIso("2026-11-09", "16:00")), "Tarde");
  assert.equal(fueraDeHorario(localToIso("2026-11-09", "08:30"), localToIso("2026-11-09", "22:00")), false);
  assert.equal(fueraDeHorario(localToIso("2026-11-09", "08:00"), localToIso("2026-11-09", "09:00")), true);
  assert.equal(fueraDeHorario(localToIso("2026-11-09", "21:00"), localToIso("2026-11-09", "22:30")), true);
});

test("sin horario de apertura no se marca nada como fuera de horario", () => {
  const h = { apertura: null, cierre: null, inicioTarde: "14:00" };
  assert.equal(fueraDeHorario(localToIso("2026-11-09", "06:00"), localToIso("2026-11-09", "23:00"), h), false);
  assert.equal(turno(localToIso("2026-11-09", "14:30"), h), "Tarde");
});

test("turno de noche: empieza entre las 22:00 y las 06:00", () => {
  assert.equal(turno(localToIso("2026-11-07", "22:00")), "Noche");
  assert.equal(turno(localToIso("2026-11-07", "05:30")), "Noche");
  assert.equal(turno(localToIso("2026-11-07", "06:00")), "Mañana");
});
