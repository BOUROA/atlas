import { test } from "node:test";
import assert from "node:assert/strict";
import { territory, readiness, scoreOf, eventsFromGrading, reinforceFrom } from "../src/domain/expeditions";
import { legendProgress, profileProgress } from "../src/domain/legends";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type Expedition, type ExpeditionAttempt, type Legend, type Profile, type StudyEvent } from "../src/domain/types";

const sch = createScheduler(0.9);
let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `x${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});
/** Nivel 2: visto y acertado al día siguiente. */
const level2 = (conceptId: string) => [ev(conceptId, "2026-08-01", "seen"), ev(conceptId, "2026-08-02", "review")];
/** Nivel 3: nivel 2 y un acierto de ejercicio al menos 7 días después. */
const level3 = (conceptId: string) => [
  ...level2(conceptId),
  ev(conceptId, "2026-08-09", "review", { questionKind: "exercise" }),
];

// Conceptos de tests/fixtures/catalog.ts (asignatura "calculo").
const testExpedition: Expedition = {
  id: "ficticia.calculo.final-2025", university: "Universidad Ficticia", course: "Cálculo I", courseName: "Cálculo I",
  term: "2025-S1", title: "Examen final", kind: "final", durationMin: 120,
  url: "https://example.org/examen.pdf", solutionsUrl: "https://example.org/soluciones.pdf", license: "CC-BY-SA",
  subjects: ["calculo"], level: "grado", whyThisOne: "Cubre bien la regla de la cadena y su aplicación práctica.",
  problems: [
    { n: "1", topic: "Funciones", concepts: ["calculus.functions"] },
    { n: "2", topic: "Derivadas", concepts: ["calculus.derivative"], points: 2 },
    { n: "3", topic: "Regla de la cadena", concepts: ["calculus.chain_rule", "calculus.derivative"], points: 1 },
  ],
};

test("territory: conceptos únicos de la misión, en orden de aparición", () => {
  assert.deepEqual(territory(testExpedition), ["calculus.functions", "calculus.derivative", "calculus.chain_rule"]);
});

test("readiness: proporción del territorio a nivel ≥ 2, lista a partir del 70 %", () => {
  const now = new Date("2026-08-10T10:00:00");
  const notReady = readiness(testExpedition, deriveProgress([...level2("calculus.functions"), ...level2("calculus.derivative")], sch, now));
  assert.equal(notReady.ratio, 2 / 3);
  assert.equal(notReady.ready, false);
  assert.deepEqual(notReady.missing, ["calculus.chain_rule"]);

  const allEvs = [...level2("calculus.functions"), ...level2("calculus.derivative"), ...level2("calculus.chain_rule")];
  const ready = readiness(testExpedition, deriveProgress(allEvs, sch, now));
  assert.equal(ready.ratio, 1);
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.missing, []);
});

test("scoreOf: nota sobre 10 ponderada por points (1 si no hay)", () => {
  const attempt: ExpeditionAttempt = { id: "att1", startedAt: "2026-09-08T09:00:00.000Z", scores: { "1": 1, "2": 0.5, "3": 0 } };
  // pesos: 1 (por defecto) + 2 + 1 = 4; ganado: 1·1 + 0.5·2 + 0·1 = 2 → 2/4·10 = 5
  assert.equal(scoreOf(testExpedition, attempt), 5);
  const perfect: ExpeditionAttempt = { id: "att2", startedAt: "2026-09-08T09:00:00.000Z", scores: { "1": 1, "2": 1, "3": 1 } };
  assert.equal(scoreOf(testExpedition, perfect), 10);
});

test("eventsFromGrading: un evento por concepto con la mejor nota, 0 no genera evento", () => {
  const attempt: ExpeditionAttempt = { id: "att1", startedAt: "2026-09-08T09:00:00.000Z", endedAt: "2026-09-08T10:00:00.000Z", scores: { "1": 1, "2": 0.5, "3": 0 } };
  const events = eventsFromGrading(testExpedition, attempt, attempt.endedAt!);
  assert.deepEqual(events.map((e) => [e.conceptId, e.grade, e.kind, e.source, e.questionKind]), [
    ["calculus.functions", 3, "review", "challenge", "exercise"],
    ["calculus.derivative", 2, "review", "challenge", "exercise"],
  ]);
  assert.equal(events[0].id, "att1~calculus.functions");
});

test("reinforceFrom: conceptos con 0 en un intento de los últimos 7 días", () => {
  const now = new Date("2026-09-10T09:00:00.000Z");
  const recent: ExpeditionAttempt = { id: "att1", startedAt: "2026-09-08T09:00:00.000Z", endedAt: "2026-09-08T10:00:00.000Z", scores: { "1": 1, "2": 0.5, "3": 0 } };
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), expeditions: { [testExpedition.id]: [recent] } };
  assert.deepEqual(reinforceFrom([testExpedition], s, now), ["calculus.chain_rule"]);

  const stale: ExpeditionAttempt = { ...recent, id: "att0", endedAt: "2026-08-01T10:00:00.000Z" };
  const old = { ...emptyUserState("2026-09-01T00:00:00.000Z"), expeditions: { [testExpedition.id]: [stale] } };
  assert.deepEqual(reinforceFrom([testExpedition], old, now), []);
});

const testLegend: Legend = {
  id: "leg1", name: "Ada Lovelace", years: "1815–1852", origin: "Reino Unido", tagline: "La primera programadora",
  story: "Trabajó junto a Babbage en la máquina analítica.",
  milestones: [{ year: 1843, text: "Publica las notas sobre la máquina analítica." }],
  route: ["algebra.vectors", "algebra.matrices", "algebra.eigen"],
  studyLesson: { title: "Piensa en abstracto", text: "...", atlasFeature: "mapa" },
  sources: [{ title: "Nota G", url: "https://example.org/nota-g" }],
};
const testProfile: Profile = {
  id: "prof1", name: "Grace Hopper", origin: "Estados Unidos", field: "Computación", tagline: "El primer compilador",
  story: "Impulsó los lenguajes de programación de alto nivel.",
  path: [{ year: 1952, text: "Crea el primer compilador." }],
  stamps: [{ title: "Compilador A-0", year: 1952, kind: "hito" }],
  territory: ["calculus.functions", "calculus.derivative"],
  studyLesson: { title: "De la idea a la máquina", text: "..." },
  sources: [{ title: "Biografía", url: "https://example.org/hopper" }],
};

test("legendProgress: constelación de una leyenda sobre su ruta", () => {
  const now = new Date("2026-08-20T10:00:00");
  const empty = legendProgress(testLegend, deriveProgress([], sch, now));
  assert.deepEqual(empty, { done: 0, total: 3, ratio: 0, completed: false, golden: false });

  const partialEvs = [...level2("algebra.vectors"), ...level2("algebra.matrices")];
  const partial = legendProgress(testLegend, deriveProgress(partialEvs, sch, now));
  assert.equal(partial.done, 2);
  assert.equal(partial.completed, false);

  const litEvs = [...level2("algebra.vectors"), ...level2("algebra.matrices"), ...level2("algebra.eigen")];
  const lit = legendProgress(testLegend, deriveProgress(litEvs, sch, now));
  assert.equal(lit.completed, true);
  assert.equal(lit.golden, false);        // nivel 2, no 3

  const now2 = new Date("2026-08-11T10:00:00");
  const masteredEvs = [...level3("algebra.vectors"), ...level3("algebra.matrices"), ...level3("algebra.eigen")];
  const mastered = legendProgress(testLegend, deriveProgress(masteredEvs, sch, now2));
  assert.equal(mastered.completed, true);
  assert.equal(mastered.golden, true);
});

test("profileProgress: constelación de un perfil destacado sobre su territorio", () => {
  const now = new Date("2026-08-20T10:00:00");
  const litEvs = [...level2("calculus.functions"), ...level2("calculus.derivative")];
  const p = profileProgress(testProfile, deriveProgress(litEvs, sch, now));
  assert.deepEqual(p, { done: 2, total: 2, ratio: 1, completed: true, golden: false });
});
