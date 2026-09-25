import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, daysBetween, isoWeekKey, addDays, startOfDay } from "../src/domain/time";

test("dayKey usa la fecha local", () => {
  const d = new Date(2026, 8, 24, 13, 5);           // 24 sep 2026 13:05 local
  assert.equal(dayKey(d), "2026-09-24");
  assert.equal(dayKey(d.toISOString()), "2026-09-24");
});
test("daysBetween cuenta días naturales", () => {
  assert.equal(daysBetween("2026-09-24", "2026-09-24"), 0);
  assert.equal(daysBetween("2026-09-24", "2026-10-01"), 7);
  assert.equal(daysBetween("2026-10-01", "2026-09-24"), -7);
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);   // cruza el cambio de hora
});
test("isoWeekKey: la semana empieza en lunes", () => {
  assert.equal(isoWeekKey(new Date(2026, 8, 21, 12)), isoWeekKey(new Date(2026, 8, 27, 12))); // lun y dom
  assert.notEqual(isoWeekKey(new Date(2026, 8, 27, 12)), isoWeekKey(new Date(2026, 8, 28, 12)));
});
test("isoWeekKey: formato y año-semana ISO en el cambio de año", () => {
  assert.equal(isoWeekKey(new Date(2026, 8, 24, 12)), "2026-W39");
  assert.equal(isoWeekKey(new Date(2027, 0, 1, 12)), "2026-W53");   // semana 53 del año anterior
  assert.equal(isoWeekKey(new Date(2024, 11, 30, 12)), "2025-W01"); // ya es semana 1 del año siguiente
});
test("addDays y startOfDay", () => {
  assert.equal(dayKey(addDays(new Date(2026, 8, 30, 12), 1)), "2026-10-01");
  const s = startOfDay(new Date(2026, 8, 24, 18, 30));
  assert.equal(s.getHours(), 0);
  assert.equal(dayKey(s), "2026-09-24");
});
test("addDays conserva la hora local al cruzar el cambio de hora", () => {
  assert.equal(addDays(new Date(2026, 9, 24, 12), 2).getHours(), 12); // 24→26 oct 2026: fin de DST en Europe/Madrid
});
