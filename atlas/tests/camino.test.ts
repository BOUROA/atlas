// Camino hasta el máximo (spec 2026-09-25-mision-del-dia-camino §4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { PATH_LEVELS, subjectPath, subjectPathLevel, type PathInput } from "../src/domain/camino";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type Expedition, type StudyEvent, type Trial, type TrialAttempt, type UserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"]): StudyEvent => ({
  id: `c${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}),
});
const level2 = (conceptId: string) => [ev(conceptId, "2026-10-01", "seen"), ev(conceptId, "2026-10-02", "review")];
const trial = (id: string, kind: Trial["kind"], level: Trial["level"], unitIds: string[]): Trial => ({
  id, subjectId: "calculo", kind, level, title: id, unitIds, durationMin: 60,
  problems: [{ n: "1", points: 10, difficulty: 2, concepts: ["calculus.functions"], statement: "e", solution: "s", rubric: [{ text: "r", points: 10 }] }],
});
const TRIALS: Trial[] = [
  trial("calculo.control.t1", "control", 2, ["calculo.t1"]),
  trial("calculo.control.t2", "control", 2, ["calculo.t2"]),
  trial("calculo.parcial.n2", "parcial", 2, ["calculo.t1"]),
  trial("calculo.parcial.n3", "parcial", 3, ["calculo.t1"]),
  trial("calculo.final.n2", "final", 2, ["calculo.t1", "calculo.t2"]),
  trial("calculo.final.n4", "final", 4, ["calculo.t1", "calculo.t2"]),
];
const EXPS: Expedition[] = [
  { id: "c-quiz", university: "U", course: "Q", courseName: "Q", term: "T", title: "Quiz", kind: "quiz", durationMin: 30, url: "u", solutionsUrl: "s",
    license: "CC", subjects: ["calculo"], level: "grado", whyThisOne: "…", difficulty: 1, problems: [{ n: "1", topic: "t", concepts: ["calculus.functions"] }] },
  { id: "c-final", university: "U", course: "F", courseName: "F", term: "T", title: "Final", kind: "final", durationMin: 120, url: "u", solutionsUrl: "s",
    license: "CC", subjects: ["calculo"], level: "grado", whyThisOne: "…", difficulty: 4, problems: [{ n: "1", topic: "t", concepts: ["calculus.derivative"] }] },
];
const passed = (id: string, score = 8): TrialAttempt => ({ id, startedAt: "2026-10-05T09:00:00.000Z", endedAt: "2026-10-05T10:00:00.000Z", earned: { "1": score } });
const now = new Date("2026-10-10T12:00:00");
const input = (state: UserState, trials: Trial[] = TRIALS): PathInput => ({
  index, state, progress: deriveProgress(state.events, sch, now), trials, expeditions: EXPS, now,
});
const base = (patch: Partial<UserState> = {}): UserState => ({ ...emptyUserState("2026-09-01T00:00:00.000Z"), ...patch });
const allConcepts = ["calculus.functions", "calculus.derivative", "calculus.chain_rule"].flatMap(level2);

test("niveles: nombres del 0 al 7", () => {
  assert.deepEqual(PATH_LEVELS.map((l) => l.label), ["Sin empezar", "Base", "Controles", "Parcial", "Parcial exigente", "Final", "Máximo", "Élite"]);
});

test("nivel 0 sin nada; nivel 1 · Base con ≥ 50 % de los temas preparados", () => {
  assert.equal(subjectPathLevel(input(base()), "calculo").level, 0);
  const s = base({ events: level2("calculus.functions") });   // t1 (1 concepto) listo; t2 no: 1 de 2 temas
  const l = subjectPathLevel(input(s), "calculo");
  assert.equal(l.level, 1);
  assert.equal(l.label, "Base");
  assert.equal(l.next, "Controles");
});

test("escalera completa: controles → parciales → finales → élite, en orden", () => {
  // Primera mitad del fixture = [t1] (como en el Rumbo): su control da el nivel 2; el de t2 cuenta para el nivel 5.
  const steps: [string, number, string][] = [
    ["calculo.control.t1", 2, "Controles"],
    ["calculo.parcial.n2", 3, "Parcial"],
    ["calculo.parcial.n3", 4, "Parcial exigente"],
    ["calculo.final.n2", 4, "Parcial exigente"],    // falta el control t2 para el nivel Final
    ["calculo.control.t2", 5, "Final"],
    ["calculo.final.n4", 6, "Máximo"],
  ];
  const trials: Record<string, TrialAttempt[]> = {};
  for (const [id, level, label] of steps) {
    trials[id] = [passed(`a-${id}`)];
    const l = subjectPathLevel(input(base({ events: allConcepts, trials: { ...trials } })), "calculo");
    assert.deepEqual([l.level, l.label], [level, label], id);
  }
  // la cumbre de la campaña de élite (el último peldaño) → nivel 7
  const at = { startedAt: "2026-10-06T09:00:00.000Z", endedAt: "2026-10-06T10:00:00.000Z" };
  const elite = base({ events: allConcepts, trials, expeditions: { "c-final": [{ id: "e", ...at, scores: { "1": 1 } }] } });
  const top = subjectPathLevel(input(elite), "calculo");
  assert.deepEqual([top.level, top.label, top.next], [7, "Élite", null]);
});

test("los niveles son consecutivos: superar el final sin los controles no salta la escalera", () => {
  const s = base({ events: allConcepts, trials: { "calculo.final.n4": [passed("x", 9)] } });
  assert.equal(subjectPathLevel(input(s), "calculo").level, 1);   // Base: todos los temas listos, pero sin los controles superados
});

test("asignatura sin pruebas: como mucho nivel 2 (los temas de la primera mitad preparados)", () => {
  const s = base({ events: ["algebra.vectors", "algebra.matrices", "algebra.eigen"].flatMap(level2) });
  const l = subjectPathLevel(input(s, []), "algebra");
  assert.deepEqual([l.level, l.label], [2, "Controles"]);
  assert.equal(l.next, null);   // sin pruebas no hay siguiente hito alcanzable todavía
});

test("camino: nodos del rumbo sin exámenes reales + peldaños de élite; 'current' = primero sin hacer", () => {
  const s = base({ events: level2("calculus.functions"), trials: { "calculo.control.t1": [passed("a")] } });
  const path = subjectPath(input(s), "calculo");
  assert.deepEqual(path.nodes.map((x) => [x.kind, x.id, x.done]), [
    ["control", "calculo.control.t1", true],
    ["sim-parcial", "calculo.parcial.n2", false],
    ["sim-parcial", "calculo.parcial.n3", false],
    ["control", "calculo.control.t2", false],
    ["sim-final", "calculo.final.n2", false],
    ["sim-final", "calculo.final.n4", false],
    ["elite", "c-quiz", false],
    ["elite", "c-final", false],
  ]);
  assert.equal(path.current, 1);
  assert.equal(path.nodes[0].stars, 1);
  assert.equal(path.nodes.at(-1)!.summit, true);
});
