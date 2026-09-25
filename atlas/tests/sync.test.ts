import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeStates } from "../src/domain/sync";
import { emptyUserState, type ExpeditionAttempt, type StudyEvent } from "../src/domain/types";

const e = (id: string, at: string): StudyEvent => ({ id, at, conceptId: "c", kind: "seen", source: "quick" });

test("une eventos por id y los ordena", () => {
  const a = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events: [e("1", "2026-09-02T10:00:00.000Z"), e("2", "2026-09-03T10:00:00.000Z")] };
  const b = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events: [e("2", "2026-09-03T10:00:00.000Z"), e("0", "2026-09-01T10:00:00.000Z")] };
  assert.deepEqual(mergeStates(a, b).events.map((x) => x.id), ["0", "1", "2"]);
});
test("notas, asignaturas y ajustes: gana el más reciente", () => {
  const a = emptyUserState("2026-09-01T00:00:00.000Z");
  const b = emptyUserState("2026-09-01T00:00:00.000Z");
  a.notes.x = { text: "vieja", links: [], updatedAt: "2026-09-02T00:00:00.000Z" };
  b.notes.x = { text: "nueva", links: [], updatedAt: "2026-09-03T00:00:00.000Z" };
  a.subjects.calculo = { currentUnit: 3, assessments: [], updatedAt: "2026-09-05T00:00:00.000Z" };
  b.subjects.calculo = { currentUnit: 2, assessments: [], updatedAt: "2026-09-04T00:00:00.000Z" };
  b.settings = { ...b.settings, dailyMinutes: 200, updatedAt: "2026-09-06T00:00:00.000Z" };
  const m = mergeStates(a, b);
  assert.equal(m.notes.x.text, "nueva");
  assert.equal(m.subjects.calculo.currentUnit, 3);
  assert.equal(m.settings.dailyMinutes, 200);
});
test("sesiones por id, logros con la fecha más antigua, vistos unidos", () => {
  const a = emptyUserState("2026-09-01T00:00:00.000Z");
  const b = emptyUserState("2026-09-01T00:00:00.000Z");
  a.achievements["primer-paso"] = "2026-09-03T00:00:00.000Z";
  b.achievements["primer-paso"] = "2026-09-02T00:00:00.000Z";
  a.seen = { achievements: ["primer-paso"], levelShown: 3 };
  b.seen = { achievements: ["puente"], levelShown: 2 };
  const m = mergeStates(a, b);
  assert.equal(m.achievements["primer-paso"], "2026-09-02T00:00:00.000Z");
  assert.deepEqual(m.seen.achievements.sort(), ["primer-paso", "puente"]);
  assert.equal(m.seen.levelShown, 3);
});
test("expeditions: intentos por id, gana el más completo (endedAt o más puntuaciones)", () => {
  const a = emptyUserState("2026-09-01T00:00:00.000Z");
  const b = emptyUserState("2026-09-01T00:00:00.000Z");
  const inProgress: ExpeditionAttempt = { id: "att1", startedAt: "2026-09-05T10:00:00.000Z", scores: { "1": 1 } };
  const finished: ExpeditionAttempt = { id: "att1", startedAt: "2026-09-05T10:00:00.000Z", endedAt: "2026-09-05T11:00:00.000Z", scores: { "1": 1 } };
  a.expeditions = { exp1: [inProgress] };
  b.expeditions = { exp1: [finished] };
  const m = mergeStates(a, b);
  assert.deepEqual(m.expeditions, { exp1: [finished] });   // endedAt gana sobre en curso

  const fewerScores: ExpeditionAttempt = { id: "att2", startedAt: "2026-09-06T10:00:00.000Z", scores: { "1": 1 } };
  const moreScores: ExpeditionAttempt = { id: "att2", startedAt: "2026-09-06T10:00:00.000Z", scores: { "1": 1, "2": 0.5 } };
  const c = { ...emptyUserState("2026-09-01T00:00:00.000Z"), expeditions: { exp1: [fewerScores] } };
  const d = { ...emptyUserState("2026-09-01T00:00:00.000Z"), expeditions: { exp1: [moreScores] } };
  assert.deepEqual(mergeStates(c, d).expeditions, { exp1: [moreScores] });   // a igualdad de endedAt, gana más puntuaciones

  // Ninguno de los dos lados tiene expeditions: no aparece en el resultado.
  assert.equal(mergeStates(emptyUserState("2026-09-01T00:00:00.000Z"), emptyUserState("2026-09-01T00:00:00.000Z")).expeditions, undefined);
});
