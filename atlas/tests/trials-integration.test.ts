// Integración de las pruebas con logros, cola y fusión de estados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { evaluateAchievements, ACHIEVEMENT_BY_ID } from "../src/domain/game/achievements";
import { mergeStates } from "../src/domain/sync";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { buildQueue } from "../src/domain/tutor/queue";
import { emptyUserState, type Expedition, type StudyEvent, type Trial, type TrialAttempt, type UserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `i${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});
const trial = (id: string, kind: Trial["kind"], level: Trial["level"], unitIds: string[], title = id): Trial => ({
  id, subjectId: "calculo", kind, level, title, unitIds, durationMin: 60,
  problems: [{ n: "1", points: 10, difficulty: 2, concepts: ["calculus.functions"], statement: "e", solution: "s", rubric: [{ text: "r", points: 10 }] }],
});
const TRIALS: Trial[] = [
  trial("calculo.control.t1", "control", 2, ["calculo.t1"], "Control · Funciones"),
  trial("calculo.control.t2", "control", 2, ["calculo.t2"]),
  trial("calculo.final.n2", "final", 2, ["calculo.t1", "calculo.t2"]),
  trial("calculo.final.n4", "final", 4, ["calculo.t1", "calculo.t2"]),
];
const done = (id: string, score: number, day = "2026-10-08"): TrialAttempt => ({
  id, startedAt: new Date(`${day}T09:00:00`).toISOString(), endedAt: new Date(`${day}T10:00:00`).toISOString(), earned: { "1": score },
});
const base = (patch: Partial<UserState> = {}): UserState => ({ ...emptyUserState("2026-09-01T00:00:00.000Z"), ...patch });
const now = new Date("2026-10-10T12:00:00");
const achievements = (s: UserState, expeditions?: Expedition[]) =>
  evaluateAchievements({ index, state: s, progress: deriveProgress(s.events, sch, now), trials: TRIALS, expeditions });
const TRIAL_BADGES = ["primera-prueba", "control-perfecto", "tema-a-tema", "simulacro-superado", "nivel-maximo", "cumbre"];

test("insignias de pruebas: definidas con título, XP e icono", () => {
  for (const id of TRIAL_BADGES) {
    const a = ACHIEVEMENT_BY_ID.get(id);
    assert.ok(a, id);
    assert.ok(a!.title && a!.description && a!.icon);
    assert.ok(a!.xp >= 100 && a!.xp <= 500);
  }
});

test("insignias de pruebas: primera, control perfecto, tema a tema, simulacro superado y nivel máximo", () => {
  const s = base({ trials: {
    "calculo.control.t1": [done("a", 10)],
    "calculo.control.t2": [done("b", 6), done("c", 7.5)],
    "calculo.final.n2": [done("d", 7)],
    "calculo.final.n4": [done("e", 9.2)],
  } });
  const got = achievements(s).filter((id) => TRIAL_BADGES.includes(id));
  assert.deepEqual(got, ["primera-prueba", "control-perfecto", "tema-a-tema", "simulacro-superado", "nivel-maximo"]);
  const little = base({ trials: { "calculo.control.t1": [done("a", 6)], "calculo.final.n4": [done("e", 8.9)] } });
  // 8,9 en el simulacro de nivel 4: supera el simulacro (≥ 7) pero no llega al nivel máximo (≥ 9)
  assert.deepEqual(achievements(little).filter((id) => TRIAL_BADGES.includes(id)), ["primera-prueba", "simulacro-superado"]);
  const open = base({ trials: { "calculo.control.t1": [{ id: "o", startedAt: "2026-10-08T09:00:00.000Z", earned: { "1": 10 } }] } });
  assert.deepEqual(achievements(open).filter((id) => TRIAL_BADGES.includes(id)), []);
});

test("insignia cumbre: superar el último peldaño de una campaña de élite", () => {
  const e = (id: string, kind: Expedition["kind"], difficulty: Expedition["difficulty"]): Expedition => ({
    id, university: "U", course: id, courseName: id, term: "T", title: id, kind, durationMin: 60, url: "u", solutionsUrl: "s",
    license: "CC", subjects: ["calculo"], level: "grado", whyThisOne: "…", difficulty,
    problems: [{ n: "1", topic: "t", concepts: ["calculus.functions"] }],
  });
  const exps = [e("easy", "quiz", 1), e("top", "final", 4)];
  const at = { startedAt: "2026-10-01T09:00:00.000Z", endedAt: "2026-10-01T10:00:00.000Z" };
  assert.ok(!achievements(base({ expeditions: { easy: [{ id: "1", ...at, scores: { "1": 1 } }] } }), exps).includes("cumbre"));
  assert.ok(achievements(base({ expeditions: { top: [{ id: "2", ...at, scores: { "1": 1 } }] } }), exps).includes("cumbre"));
});

test("cola: un concepto flojo en una prueba reciente vuelve a la cola con su motivo", () => {
  const events = [ev("calculus.functions", "2026-10-01", "seen"), ev("calculus.functions", "2026-10-02", "review")];
  const s = base({ events, trials: { "calculo.control.t1": [done("x", 2)] } });
  const q = buildQueue({ index, state: s, progress: deriveProgress(events, sch, now), scheduler: sch, now, trials: TRIALS });
  const item = q.items.find((i) => i.conceptId === "calculus.functions");
  assert.ok(item, "debería estar en la cola");
  assert.equal(item!.type, "review");
  assert.ok(item!.reasons.includes("Reforzar tras la prueba «Control · Funciones»"));
});

test("mergeStates: intentos de prueba por id, gana el terminado o el que tiene más puntuaciones", () => {
  const a = base({ trials: { t: [{ id: "1", startedAt: "2026-10-01T09:00:00.000Z", earned: { "1": 3 } }] } });
  const b = base({ trials: { t: [{ id: "1", startedAt: "2026-10-01T09:00:00.000Z", endedAt: "2026-10-01T10:00:00.000Z", earned: { "1": 3 } }, done("2", 5)] } });
  const m = mergeStates(a, b);
  assert.deepEqual(m.trials!.t.map((x) => [x.id, Boolean(x.endedAt)]), [["1", true], ["2", true]]);
  const c = base({ trials: { t: [{ id: "1", startedAt: "2026-10-01T09:00:00.000Z", earned: { "1": 3, "2": 1 } }] } });
  assert.deepEqual(mergeStates(a, c).trials!.t[0].earned, { "1": 3, "2": 1 });
  assert.equal(mergeStates(base(), base()).trials, undefined);
});

/* ───────── Casos límite (revisión) ───────── */

test("cola: un concepto que ya no está en el catálogo (renombrado) en una prueba reciente no rompe la cola", () => {
  const renamed: Trial = {
    ...trial("calculo.control.t1", "control", 2, ["calculo.t1"]),
    problems: [{ n: "1", points: 10, difficulty: 2, concepts: ["calculus.renombrado"], statement: "e", solution: "s", rubric: [{ text: "r", points: 10 }] }],
  };
  const s = base({ trials: { "calculo.control.t1": [done("x", 1)] } });
  const progress = deriveProgress([], sch, now);
  for (const subjectId of [undefined, "calculo"]) {
    const q = buildQueue({ index, state: s, progress, scheduler: sch, now, trials: [renamed], subjectId });
    assert.ok(!q.items.some((i) => i.conceptId === "calculus.renombrado"));
  }
});

test("insignia nivel máximo: solo un simulacro de nivel 4 (no un control) con 9 o más", () => {
  const hardControl = trial("calculo.control.t1", "control", 4, ["calculo.t1"]);
  const got = evaluateAchievements({
    index, state: base({ trials: { [hardControl.id]: [done("a", 9.5)] } }), progress: deriveProgress([], sch, now), trials: [hardControl],
  });
  assert.ok(!got.includes("nivel-maximo"));
  assert.ok(got.includes("control-perfecto") === false && got.includes("primera-prueba"));
});

test("mergeStates: dos intentos abiertos iguales conservan el borrador de corrección más avanzado", () => {
  const open = (checked: Record<string, number[]>): TrialAttempt => ({ id: "1", startedAt: "2026-10-01T09:00:00.000Z", earned: {}, checked });
  const a = base({ trials: { t: [open({ "1": [0] })] } });
  const b = base({ trials: { t: [open({ "1": [0, 1], "2": [0] })] } });
  assert.deepEqual(mergeStates(a, b).trials!.t[0].checked, { "1": [0, 1], "2": [0] });
  assert.deepEqual(mergeStates(b, a).trials!.t[0].checked, { "1": [0, 1], "2": [0] });
});
