import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import {
  earnedFromChecked, eventsFromTrial, gradedAttempt, starsFor, TRIAL_PASS, trialReadiness, trialReinforceHits, trialResult, trialScore,
} from "../src/domain/trials";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type StudyEvent, type Trial, type TrialAttempt, type UserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `t${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});
const level2 = (conceptId: string) => [ev(conceptId, "2026-08-01", "seen"), ev(conceptId, "2026-08-02", "review")];

const control1: Trial = {
  id: "calculo.control.t1", subjectId: "calculo", kind: "control", level: 2, title: "Control · Funciones",
  unitIds: ["calculo.t1"], durationMin: 30, rules: "Sin calculadora.",
  problems: [
    { n: "1", points: 4, difficulty: 1, concepts: ["calculus.functions"], statement: "Enunciado 1", solution: "Solución 1",
      rubric: [{ text: "a", points: 1 }, { text: "b", points: 3 }] },
    { n: "2", points: 6, difficulty: 2, concepts: ["calculus.functions", "calculus.derivative"], statement: "Enunciado 2", solution: "Solución 2",
      rubric: [{ text: "a", points: 2 }, { text: "b", points: 2 }, { text: "c", points: 2 }] },
  ],
};
const simulacro: Trial = { ...control1, id: "calculo.final.n2", kind: "final", unitIds: ["calculo.t1", "calculo.t2"], title: "Simulacro de final A" };

const attempt = (id: string, earned: Record<string, number>, endedDay?: string): TrialAttempt => ({
  id, startedAt: new Date(`${endedDay ?? "2026-10-01"}T09:00:00`).toISOString(),
  ...(endedDay ? { endedAt: new Date(`${endedDay}T10:00:00`).toISOString() } : {}), earned,
});
const withAttempts = (attempts: Record<string, TrialAttempt[]>, events: StudyEvent[] = []): UserState =>
  ({ ...emptyUserState("2026-09-01T00:00:00.000Z"), events, trials: attempts });

test("trialScore: puntos obtenidos sobre el total, a escala 10 y con 2 decimales", () => {
  assert.equal(trialScore(control1, attempt("a", { "1": 3, "2": 4.5 }, "2026-10-01")), 7.5);
  assert.equal(trialScore(control1, attempt("a", { "2": 6 }, "2026-10-01")), 6);          // lo que falta vale 0
  assert.equal(trialScore(control1, attempt("a", { "1": 9, "2": -1 }, "2026-10-01")), 4);  // acotado a [0, points]
  assert.equal(trialScore(control1, attempt("a", { "1": 1, "2": 1 / 3 }, "2026-10-01")), 1.33);
});

test("earnedFromChecked: suma los criterios marcados, sin duplicados ni índices fuera de rango", () => {
  assert.equal(earnedFromChecked(control1.problems[1], [0, 2, 2, 7]), 4);
  assert.equal(earnedFromChecked(control1.problems[1], []), 0);
  assert.equal(earnedFromChecked(control1.problems[0], [0, 1]), 4);
});

test("starsFor: 1 desde 7, 2 desde 8,5, 3 desde 9,5", () => {
  assert.equal(TRIAL_PASS, 7);
  assert.deepEqual([null, 6.99, 7, 8.49, 8.5, 9.49, 9.5, 10].map(starsFor), [0, 0, 1, 1, 2, 2, 3, 3]);
});

test("trialResult: primer intento honesto, mejor nota, estrellas y superada; ignora intentos sin terminar", () => {
  const s = withAttempts({ [control1.id]: [
    attempt("a2", { "1": 4, "2": 5 }, "2026-10-05"),        // 9
    attempt("a1", { "1": 2, "2": 4 }, "2026-10-01"),        // 6 (el primero por fecha de fin)
    attempt("a3", { "1": 4, "2": 6 }),                      // sin terminar
  ] });
  assert.deepEqual(trialResult(control1, s), { attempts: 2, first: 6, best: 9, last: 9, stars: 2, passed: true });
  assert.deepEqual(trialResult(simulacro, s), { attempts: 0, first: null, best: null, last: null, stars: 0, passed: false });
});

test("eventsFromTrial: por concepto la mejor fracción (≥ 0,8 → 3; ≥ 0,5 → 2) como ejercicio de reto", () => {
  const a = attempt("x1", { "1": 4, "2": 3 }, "2026-10-01");
  const progress = deriveProgress([], sch, new Date("2026-10-01T12:00:00"));
  const at = "2026-10-01T10:00:00.000Z";
  assert.deepEqual(eventsFromTrial(control1, a, progress, at), [
    { id: "x1~calculus.functions", at, conceptId: "calculus.functions", kind: "review", grade: 3, questionKind: "exercise", source: "challenge" },
    { id: "x1~calculus.derivative", at, conceptId: "calculus.derivative", kind: "review", grade: 2, questionKind: "exercise", source: "challenge" },
  ]);
  // 0,8 exacto cuenta como 3; 0,79 como 2
  const edge = eventsFromTrial(control1, attempt("x2", { "1": 3.2, "2": 4.74 }, "2026-10-01"), progress, at);
  assert.deepEqual(edge.map((e) => [e.conceptId, e.grade]), [["calculus.functions", 3], ["calculus.derivative", 2]]);
});

test("eventsFromTrial: por debajo de 0,5 es un fallo (nota 1) solo si el concepto ya se había visto", () => {
  const now = new Date("2026-10-01T12:00:00");
  const progress = deriveProgress([ev("calculus.functions", "2026-09-20", "seen")], sch, now);
  const a = attempt("x3", { "1": 1, "2": 1 }, "2026-10-01");   // functions 0,25 y derivative 1/6
  const events = eventsFromTrial(control1, a, progress, "2026-10-01T10:00:00.000Z");
  assert.deepEqual(events.map((e) => [e.conceptId, e.grade]), [["calculus.functions", 1]]);
});

test("trialReinforceHits: conceptos por debajo de 0,5 en intentos terminados de los últimos 7 días", () => {
  const now = new Date("2026-10-10T12:00:00");
  const s = withAttempts({
    [control1.id]: [
      attempt("old", { "1": 0, "2": 0 }, "2026-10-01"),     // hace 9 días: fuera de la ventana
      attempt("new", { "1": 4, "2": 1 }, "2026-10-08"),     // functions 1 (bien), derivative 1/6 (mal)
      attempt("open", { "1": 0, "2": 0 }),                  // sin terminar
    ],
  });
  const hits = trialReinforceHits([control1, simulacro], s, now);
  assert.deepEqual(hits.map((h) => [h.conceptId, h.trial.id, h.attempt.id]), [["calculus.derivative", control1.id, "new"]]);
});

test("trialReadiness: proporción de los conceptos de sus temas a nivel ≥ 2, lista desde el 70 %", () => {
  const now = new Date("2026-10-01T12:00:00");
  const progress = deriveProgress([...level2("calculus.functions"), ...level2("calculus.derivative")], sch, now);
  const r1 = trialReadiness(control1, index, progress);
  assert.deepEqual(r1, { ratio: 1, ready: true, missing: [] });
  const r2 = trialReadiness(simulacro, index, progress);
  assert.equal(r2.ratio, 2 / 3);
  assert.equal(r2.ready, false);
  assert.deepEqual(r2.missing, ["calculus.chain_rule"]);
});

/* ───────── Casos límite (revisión) ───────── */

test("trialScore y eventsFromTrial: una puntuación no numérica (NaN, null de JSON) vale 0, no envenena la nota", () => {
  const bad = attempt("n", { "1": Number.NaN, "2": 6 }, "2026-10-01");
  assert.equal(trialScore(control1, bad), 6);
  const fromJson = attempt("j", JSON.parse('{"1": null, "2": 6}'), "2026-10-01");
  assert.equal(trialScore(control1, fromJson), 6);
  const progress = deriveProgress([], sch, new Date("2026-10-01T12:00:00"));
  // problema 1 (NaN → 0) y problema 2 completo: functions se queda con la mejor fracción (1 → nota 3)
  assert.deepEqual(eventsFromTrial(control1, bad, progress, "2026-10-01T10:00:00.000Z").map((e) => [e.conceptId, e.grade]), [
    ["calculus.functions", 3], ["calculus.derivative", 3],
  ]);
  const s = withAttempts({ [control1.id]: [bad] });
  assert.equal(trialResult(control1, s).best, 6);
});

test("gradedAttempt: puntos por rúbrica o puntuación manual acotada; no repite una corrección", () => {
  const at = "2026-10-02T10:00:00.000Z";
  const open: TrialAttempt = { id: "o", startedAt: "2026-10-02T09:00:00.000Z", earned: {}, checked: { "1": [0] } };
  const checked = { "1": [0, 1], "2": [0] };
  assert.deepEqual(gradedAttempt(control1, open, "o", checked, {}, at), {
    id: "o", startedAt: "2026-10-02T09:00:00.000Z", endedAt: at, earned: { "1": 4, "2": 2 }, checked,
  });
  // la puntuación manual sustituye a la rúbrica, acotada a [0, points]; lo que no es un número se ignora
  assert.deepEqual(gradedAttempt(control1, open, "o", checked, { "2": 5 }, at)!.earned, { "1": 4, "2": 5 });
  assert.deepEqual(gradedAttempt(control1, open, "o", checked, { "1": Number.NaN, "2": 99 }, at)!.earned, { "1": 4, "2": 6 });
  assert.deepEqual(gradedAttempt(control1, open, "o", checked, { "1": -3, "2": Number.POSITIVE_INFINITY }, at)!.earned, { "1": 0, "2": 2 });
  // sin intento previo (p. ej. descartado en otro dispositivo): empieza y acaba ahora
  assert.equal(gradedAttempt(control1, undefined, "nuevo", {}, {}, at)!.startedAt, at);
  // ya corregido (doble clic en «Guardar»): null, para no duplicar sus eventos ni moverle la fecha
  const graded = gradedAttempt(control1, open, "o", checked, {}, at)!;
  assert.equal(gradedAttempt(control1, graded, "o", checked, { "1": 4, "2": 6 }, "2026-10-03T10:00:00.000Z"), null);
});
