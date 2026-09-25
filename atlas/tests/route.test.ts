import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { buildRoutes, DEFAULT_COURSE_START, DEFAULT_FINAL_DAY, nextObjectives, subjectRoute, thisWeek, type RouteInput } from "../src/domain/route";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type Assessment, type StudyEvent, type Trial, type TrialAttempt, type UserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `r${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});
const level2 = (conceptId: string) => [ev(conceptId, "2026-08-01", "seen"), ev(conceptId, "2026-08-02", "review")];

// Pruebas de "calculo" (fixture: t1 = 1 concepto, t2 = 2 conceptos; primera mitad = [t1]).
const trial = (id: string, kind: Trial["kind"], level: Trial["level"], unitIds: string[]): Trial => ({
  id, subjectId: "calculo", kind, level, title: id, unitIds, durationMin: 60,
  problems: [{ n: "1", points: 10, difficulty: 2, concepts: ["calculus.functions"], statement: "e", solution: "s", rubric: [{ text: "r", points: 10 }] }],
});
const TRIALS: Trial[] = [
  trial("calculo.control.t1", "control", 2, ["calculo.t1"]),
  trial("calculo.control.t2", "control", 2, ["calculo.t2"]),
  trial("calculo.parcial.n3", "parcial", 3, ["calculo.t1"]),     // desordenadas a propósito: se ordenan por nivel
  trial("calculo.parcial.n2", "parcial", 2, ["calculo.t1"]),
  trial("calculo.final.n2", "final", 2, ["calculo.t1", "calculo.t2"]),
  trial("calculo.final.n4", "final", 4, ["calculo.t1", "calculo.t2"]),
];
const done = (id: string, score: number, day: string): TrialAttempt => ({
  id, startedAt: new Date(`${day}T09:00:00`).toISOString(), endedAt: new Date(`${day}T10:00:00`).toISOString(), earned: { "1": score },
});
const input = (state: UserState, day: string, events: StudyEvent[] = state.events): RouteInput => {
  const now = new Date(`${day}T12:00:00`);
  return { index, state, progress: deriveProgress(events, sch, now), trials: TRIALS, now };
};
const base = (patch: Partial<UserState> = {}): UserState => ({ ...emptyUserState("2026-09-01T00:00:00.000Z"), ...patch });
const withAssessments = (subjectId: string, assessments: Assessment[], patch: Partial<UserState> = {}): UserState =>
  base({ subjects: { [subjectId]: { currentUnit: 1, updatedAt: "", assessments } }, ...patch });
const brief = (r: ReturnType<typeof subjectRoute>) => r.steps.map((s) => [s.kind, s.trialId ?? s.unitIds.join("+"), s.due, s.status]);

test("constantes: inicio de curso online el 21-oct-2026 y final supuesto el 08-feb-2027", () => {
  assert.equal(DEFAULT_COURSE_START, "2026-10-21");
  assert.equal(DEFAULT_FINAL_DAY, "2027-02-08");
});

test("sin evaluaciones: controles repartidos por conceptos hasta F−21, simulacros y final supuesto", () => {
  // C = 2026-10-21, F = 2027-02-08, fin de controles = 2027-01-18 (89 días).
  // t1: 1/3 → +30 días = 2026-11-20. t2: 3/3 → 2027-01-18.
  // Parcial virtual = último control de la primera mitad + 10 = 2026-11-30 → A = 11-23, B = 11-27.
  const r = subjectRoute(input(base(), "2026-09-24"), "calculo");
  assert.deepEqual(brief(r), [
    ["control", "calculo.control.t1", "2026-11-20", "next"],
    ["sim-parcial", "calculo.parcial.n2", "2026-11-23", "upcoming"],
    ["sim-parcial", "calculo.parcial.n3", "2026-11-27", "upcoming"],
    ["control", "calculo.control.t2", "2027-01-18", "upcoming"],
    ["sim-final", "calculo.final.n2", "2027-01-25", "upcoming"],
    ["sim-final", "calculo.final.n4", "2027-02-03", "upcoming"],
    ["exam", "calculo.t1+calculo.t2", "2027-02-08", "upcoming"],
  ]);
  const exam = r.steps[6];
  assert.equal(exam.assumed, true);
  assert.equal(r.boss?.key, exam.key);
  assert.equal(r.steps[0].daysLeft, 57);
  assert.equal(r.onTrack, true);
  assert.equal(r.done, 0);
  assert.equal(r.total, 6);   // los exámenes no cuentan en el progreso de preparación
});

test("estados: hecho con nota ≥ 7, atrasado si pasó su fecha, y 'next' el primero pendiente no atrasado", () => {
  const s = base({ trials: { "calculo.control.t1": [done("a1", 8, "2026-11-19")] } });
  const r = subjectRoute(input(s, "2026-11-25"), "calculo");
  assert.deepEqual(r.steps.slice(0, 4).map((x) => [x.trialId, x.status, x.daysLeft]), [
    ["calculo.control.t1", "done", -5],
    ["calculo.parcial.n2", "late", -2],
    ["calculo.parcial.n3", "next", 2],
    ["calculo.control.t2", "upcoming", 54],
  ]);
  assert.equal(r.steps[0].best, 8);
  assert.equal(r.steps[0].first, 8);
  assert.equal(r.steps[0].stars, 1);
  assert.equal(r.onTrack, false);
  assert.equal(r.done, 1);
  // una prueba con nota < 7 no cuenta como hecha
  const failed = subjectRoute(input(base({ trials: { "calculo.control.t1": [done("a1", 6.5, "2026-11-19")] } }), "2026-11-10"), "calculo");
  assert.equal(failed.steps[0].status, "next");
  assert.equal(failed.steps[0].best, 6.5);
});

test("parcial y final reales: controles de la primera parte hasta P−10, el resto entre P y F−21", () => {
  const s = withAssessments("calculo", [
    { id: "p", title: "Parcial 1", kind: "parcial", date: "2026-12-10", weight: 40, unitIds: ["calculo.t1"] },
    { id: "f", title: "Final", kind: "final", date: "2027-01-20", weight: 60, unitIds: [] },
  ]);
  const r = subjectRoute(input(s, "2026-09-24"), "calculo");
  assert.deepEqual(r.steps.map((x) => [x.kind, x.trialId ?? x.assessmentId, x.due]), [
    ["control", "calculo.control.t1", "2026-11-30"],
    ["sim-parcial", "calculo.parcial.n2", "2026-12-03"],
    ["sim-parcial", "calculo.parcial.n3", "2026-12-07"],
    ["exam", "p", "2026-12-10"],
    ["control", "calculo.control.t2", "2026-12-30"],
    ["sim-final", "calculo.final.n2", "2027-01-05"],   // F−14 = 06-ene (Reyes) → día anterior
    ["sim-final", "calculo.final.n4", "2027-01-15"],
    ["exam", "f", "2027-01-20"],
  ]);
  assert.equal(r.steps[3].title, "Parcial 1");
  assert.equal(r.steps[3].assumed, false);
  assert.deepEqual(r.steps[7].unitIds, ["calculo.t1", "calculo.t2"]);   // final sin temas = todos
  assert.equal(r.boss?.assessmentId, "p");
});

test("examen real: hecho si tiene nota o si ya pasó su fecha; nunca atrasado", () => {
  const assessments: Assessment[] = [
    { id: "p", title: "Parcial 1", kind: "parcial", date: "2026-12-10", weight: 40, unitIds: ["calculo.t1"] },
    { id: "f", title: "Final", kind: "final", date: "2027-01-20", weight: 60, unitIds: [] },
  ];
  const r = subjectRoute(input(withAssessments("calculo", assessments), "2026-12-12"), "calculo");
  const exam = r.steps.find((x) => x.assessmentId === "p")!;
  assert.equal(exam.status, "done");
  assert.equal(exam.best, null);
  assert.equal(r.boss?.assessmentId, "f");
  assert.equal(r.steps[0].status, "skipped");                            // control t1 (30-nov) sin hacer, pero su parcial ya pasó
  assert.equal(r.steps.find((x) => x.trialId === "calculo.control.t2")!.status, "next");
  const graded = assessments.map((a) => (a.id === "p" ? { ...a, grade: 8.5 } : a));
  const r2 = subjectRoute(input(withAssessments("calculo", graded), "2026-12-01"), "calculo");
  const exam2 = r2.steps.find((x) => x.assessmentId === "p")!;
  assert.equal(exam2.status, "done");
  assert.equal(exam2.best, 8.5);
});

test("plantilla: el examen de plantilla cuenta como supuesto", () => {
  const s = withAssessments("calculo", [
    { id: "calculo.plantilla.final", title: "Examen final", kind: "final", date: "2027-02-09", weight: 60, unitIds: ["calculo.t1", "calculo.t2"], template: true },
  ]);
  const r = subjectRoute(input(s, "2026-09-24"), "calculo");
  const exam = r.steps[r.steps.length - 1];
  assert.equal(exam.due, "2027-02-09");
  assert.equal(exam.assumed, true);
  assert.equal(exam.title, "Examen final");
});

test("asignatura sin pruebas: un paso por tema, hecho cuando el 70 % de sus conceptos está a nivel ≥ 2", () => {
  // álgebra: t1 = 2 conceptos, t2 = 1. t1: 2/3 de 89 días = 59 → 2026-12-19.
  const events = [...level2("algebra.vectors"), ...level2("algebra.matrices")];
  const s = base({ events });
  const r = subjectRoute(input(s, "2026-09-24"), "algebra");
  assert.deepEqual(r.steps.map((x) => [x.kind, x.key, x.due, x.status]), [
    ["unit", "algebra.t1", "2026-12-19", "done"],
    ["unit", "algebra.t2", "2027-01-18", "next"],
    ["exam", "algebra:exam:supuesto", "2027-02-08", "upcoming"],
  ]);
  assert.equal(r.steps[0].title, "Tema 1 · Vectores y matrices");
  assert.equal(r.steps[0].readiness, 1);
  assert.equal(r.steps[1].readiness, 0);
});

test("courseStart de ajustes desplaza el reparto de los controles", () => {
  // C = 2026-10-01 → fin de controles 2027-01-18 = 109 días; t1: 109/3 = 36,3 → 36 → 2026-11-06.
  const s = base({ settings: { ...emptyUserState("2026-09-01T00:00:00.000Z").settings, courseStart: "2026-10-01" } });
  assert.equal(subjectRoute(input(s, "2026-09-24"), "calculo").steps[0].due, "2026-11-06");
});

test("buildRoutes, nextObjectives y thisWeek: rumbo global ordenado por fecha", () => {
  const s = base({ trials: { "calculo.control.t1": [done("a1", 8, "2026-11-19")] } });
  const inp = input(s, "2026-11-25");
  const routes = buildRoutes(inp);
  assert.deepEqual(routes.map((r) => r.subjectId), ["algebra", "calculo", "prepro"]);
  assert.deepEqual(nextObjectives(routes, 4).map((x) => x.key), [
    "calculo.parcial.n2",      // atrasado (23-nov)
    "calculo.parcial.n3",      // 27-nov
    "prepro.t1",               // 2/4 de 89 días = 44,5 → 45 → 05-dic
    "algebra.t1",              // 19-dic
  ]);
  // a igualdad de fecha, gana el orden de la asignatura (álgebra y prepro cierran sus temas el 18-ene)
  const late = nextObjectives(buildRoutes(input(s, "2026-12-20")), 20).filter((x) => x.due === "2027-01-18").map((x) => x.key);
  assert.deepEqual(late, ["algebra.t2", "calculo.control.t2", "prepro.t2"]);
  assert.deepEqual(thisWeek(routes).map((x) => x.key), ["calculo.parcial.n2", "calculo.parcial.n3"]);
});

test("festivos: ningún paso de preparación cae el 24, 25 o 31 de diciembre, el 1 o el 6 de enero", () => {
  // Final real el 2027-01-08: simulacro de final B = F−5 = 03-ene; A = F−14 = 25-dic → 24-dic también es festivo → 23-dic.
  const s = withAssessments("calculo", [{ id: "f", title: "Final", kind: "final", date: "2027-01-08", weight: 100, unitIds: [] }]);
  const r = subjectRoute(input(s, "2026-09-24"), "calculo");
  assert.equal(r.steps.find((x) => x.trialId === "calculo.final.n2")!.due, "2026-12-23");
  assert.equal(r.steps.find((x) => x.trialId === "calculo.final.n4")!.due, "2027-01-03");
  // los exámenes reales conservan su fecha aunque sea festivo
  const s2 = withAssessments("calculo", [{ id: "f", title: "Final", kind: "final", date: "2027-01-06", weight: 100, unitIds: [] }]);
  assert.equal(subjectRoute(input(s2, "2026-09-24"), "calculo").steps.at(-1)!.due, "2027-01-06");
});

test("buildRoutes reparte los simulacros: como mucho uno por día entre todas las asignaturas", () => {
  const prepro = (id: string, kind: Trial["kind"], level: Trial["level"], unitIds: string[]): Trial => ({ ...trial(id, kind, level, unitIds), subjectId: "prepro" });
  const trials = [
    ...TRIALS,
    prepro("prepro.parcial.n2", "parcial", 2, ["prepro.t1"]),
    prepro("prepro.parcial.n3", "parcial", 3, ["prepro.t1"]),
    prepro("prepro.final.n2", "final", 2, ["prepro.t1", "prepro.t2"]),
    prepro("prepro.final.n4", "final", 4, ["prepro.t1", "prepro.t2"]),
  ];
  const exams = (sid: string): Assessment[] => [
    { id: "p", title: "Parcial", kind: "parcial", date: "2026-12-10", weight: 40, unitIds: [`${sid}.t1`] },
    { id: "f", title: "Final", kind: "final", date: "2027-01-20", weight: 60, unitIds: [] },
  ];
  const s = base({ subjects: {
    calculo: { currentUnit: 1, updatedAt: "", assessments: exams("calculo") },
    prepro: { currentUnit: 1, updatedAt: "", assessments: exams("prepro") },
  } });
  const now = new Date("2026-09-24T12:00:00");
  const routes = buildRoutes({ index, state: s, progress: deriveProgress([], sch, now), trials, now });
  const sims = (sid: string) => routes.find((r) => r.subjectId === sid)!.steps.filter((x) => x.kind.startsWith("sim")).map((x) => x.due);
  // cálculo (antes en el orden de asignaturas) conserva sus fechas; prepro se desplaza:
  // A 03-dic ocupado → 04-dic; B 07-dic ocupado → 08-dic (≤ P−1); final A 05-ene ocupado → 06-ene es festivo → 04-ene; final B 15-ene → 16-ene.
  assert.deepEqual(sims("calculo"), ["2026-12-03", "2026-12-07", "2027-01-05", "2027-01-15"]);
  assert.deepEqual(sims("prepro"), ["2026-12-04", "2026-12-08", "2027-01-04", "2027-01-16"]);
  // subjectRoute por separado no reparte (no conoce las demás asignaturas)
  const alone = subjectRoute({ index, state: s, progress: deriveProgress([], sch, now), trials, now }, "prepro");
  assert.deepEqual(alone.steps.filter((x) => x.kind.startsWith("sim")).map((x) => x.due), ["2026-12-03", "2026-12-07", "2027-01-05", "2027-01-15"]);
});

test("con parcial real pero sin final con fecha, el rumbo termina igualmente en el final supuesto", () => {
  const s = withAssessments("calculo", [{ id: "p", title: "Parcial 1", kind: "parcial", date: "2026-12-10", weight: 40, unitIds: ["calculo.t1"] }]);
  const r = subjectRoute(input(s, "2026-12-12"), "calculo");
  const last = r.steps.at(-1)!;
  assert.equal(last.key, "calculo:exam:supuesto");
  assert.equal(last.due, "2027-02-08");
  assert.equal(last.assumed, true);
  assert.equal(r.boss?.key, "calculo:exam:supuesto");   // el parcial ya pasó: la misión principal es el final
});

/* ───────── Casos límite (revisión) ───────── */

test("ventana invertida: con el examen antes de C + 21, los controles no se invierten ni caen después del examen", () => {
  // Final real el 2026-11-01 con C = 2026-10-21: F−21 = 2026-10-11 < C. Los controles se
  // agrupan en el cierre de la ventana (F−21) en vez de repartirse "hacia atrás".
  const s = withAssessments("calculo", [{ id: "f", title: "Final", kind: "final", date: "2026-11-01", weight: 100, unitIds: [] }]);
  const r = subjectRoute(input(s, "2026-09-24"), "calculo");
  const controls = r.steps.filter((x) => x.kind === "control").map((x) => [x.trialId, x.due]);
  assert.deepEqual(controls, [["calculo.control.t1", "2026-10-11"], ["calculo.control.t2", "2026-10-11"]]);
  // examen anterior al inicio de curso: ningún paso de preparación queda después del examen
  const early = withAssessments("calculo", [{ id: "f", title: "Final", kind: "final", date: "2026-09-30", weight: 100, unitIds: [] }]);
  const r2 = subjectRoute(input(early, "2026-09-24"), "calculo");
  for (const step of r2.steps) if (step.kind !== "exam") assert.ok(step.due < "2026-09-30", `${step.key} (${step.due}) debería ser anterior al examen`);
});

test("parcial real sin temas: cubre la primera mitad, como el parcial virtual", () => {
  // Parcial sin unitIds (lo habitual al crearlo): sus controles van entre C y P−10 como si cubriera
  // ceil(n/2) temas; antes, todos los controles caían después del parcial y de sus simulacros.
  const s = withAssessments("calculo", [
    { id: "p", title: "Parcial 1", kind: "parcial", date: "2026-12-10", weight: 40, unitIds: [] },
    { id: "f", title: "Final", kind: "final", date: "2027-01-20", weight: 60, unitIds: [] },
  ]);
  const r = subjectRoute(input(s, "2026-09-24"), "calculo");
  assert.deepEqual(r.steps.map((x) => [x.kind, x.trialId ?? x.assessmentId, x.due]).slice(0, 4), [
    ["control", "calculo.control.t1", "2026-11-30"],
    ["sim-parcial", "calculo.parcial.n2", "2026-12-03"],
    ["sim-parcial", "calculo.parcial.n3", "2026-12-07"],
    ["exam", "p", "2026-12-10"],
  ]);
  assert.deepEqual(r.steps.find((x) => x.assessmentId === "p")!.unitIds, ["calculo.t1"]);
});

test("temas sin conceptos: se reparten por tema en vez de caer todos en el inicio de curso", () => {
  const subjects = [{ ...fixtureSubjects[0], id: "vacia", file: "vacia.json" }];
  const files = [{
    subjectId: "vacia", concepts: [], relations: [],
    units: [1, 2, 3].map((k) => ({ id: `vacia.t${k}`, number: k, title: `T${k}`, summary: "" })),
  }];
  const idx = new CatalogIndex(buildCatalog(subjects, files));
  const now = new Date("2026-09-24T12:00:00");
  const r = subjectRoute({ index: idx, state: base(), progress: deriveProgress([], sch, now), trials: [], now }, "vacia");
  // C = 2026-10-21, F−21 = 2027-01-18 (89 días): 1/3 → +30, 2/3 → +59, 3/3 → +89.
  assert.deepEqual(r.steps.filter((x) => x.kind === "unit").map((x) => x.due), ["2026-11-20", "2026-12-19", "2027-01-18"]);
  // una asignatura sin temas no rompe nada
  const none = new CatalogIndex(buildCatalog(subjects, [{ ...files[0], units: [] }]));
  const r2 = subjectRoute({ index: none, state: base(), progress: new Map(), trials: [], now }, "vacia");
  assert.deepEqual(r2.steps.map((x) => x.key), ["vacia:exam:supuesto"]);
});

test("reparto de simulacros: nunca se pasa del final supuesto", () => {
  // Muchos simulacros de final por asignatura y ningún examen con fecha: el reparto no puede
  // llevar ninguno al 08-feb (el final supuesto) ni después.
  const many = (sid: string): Trial[] => Array.from({ length: 10 }, (_, i) => ({ ...trial(`${sid}.final.x${i}`, "final", 2, [`${sid}.t1`]), subjectId: sid }));
  const trials = [...many("algebra"), ...many("calculo"), ...many("prepro")];
  const now = new Date("2026-09-24T12:00:00");
  const routes = buildRoutes({ index, state: base(), progress: new Map(), trials, now });
  for (const r of routes) {
    for (const step of r.steps) if (step.kind === "sim-final") assert.ok(step.due < DEFAULT_FINAL_DAY, `${step.key}: ${step.due}`);
    assert.equal(r.steps.at(-1)!.key, `${r.subjectId}:exam:supuesto`);
  }
});

test("courseStart vacío o mal formado: se usa el inicio de curso por defecto", () => {
  const empty = emptyUserState("2026-09-01T00:00:00.000Z").settings;
  for (const courseStart of ["", "21/10/2026", "no"]) {
    const s = base({ settings: { ...empty, courseStart } });
    assert.equal(subjectRoute(input(s, "2026-09-24"), "calculo").steps[0].due, "2026-11-20", JSON.stringify(courseStart));
  }
});

test("reparto de simulacros: un simulacro desplazado a un día con otro paso respeta el orden de construcción", () => {
  // Cálculo: parcial 10-dic (t1) y final 25-dic → control t2 = F−21 = 04-dic. Álgebra ocupa el
  // 03-dic con su simulacro de parcial A, así que el de cálculo pasa al 04-dic: el control
  // (construido antes) va primero.
  const alg = (id: string, kind: Trial["kind"], level: Trial["level"]): Trial => ({ ...trial(id, kind, level, ["algebra.t1"]), subjectId: "algebra" });
  const trials = [...TRIALS, alg("algebra.parcial.n2", "parcial", 2), alg("algebra.parcial.n3", "parcial", 3)];
  const exams = (sid: string): Assessment[] => [
    { id: "p", title: "Parcial", kind: "parcial", date: "2026-12-10", weight: 40, unitIds: [`${sid}.t1`] },
    { id: "f", title: "Final", kind: "final", date: "2026-12-25", weight: 60, unitIds: [] },
  ];
  const s = base({ subjects: {
    algebra: { currentUnit: 1, updatedAt: "", assessments: exams("algebra") },
    calculo: { currentUnit: 1, updatedAt: "", assessments: exams("calculo") },
  } });
  const now = new Date("2026-09-24T12:00:00");
  const calc = buildRoutes({ index, state: s, progress: new Map(), trials, now }).find((r) => r.subjectId === "calculo")!;
  assert.deepEqual(calc.steps.filter((x) => x.due === "2026-12-04").map((x) => x.key), ["calculo.control.t2", "calculo.parcial.n2"]);
});

test("fechas de evaluación con hora: se usan por su día local", () => {
  const withTime = withAssessments("calculo", [
    { id: "f", title: "Final", kind: "final", date: new Date("2027-01-20T09:30:00").toISOString(), weight: 100, unitIds: [] },
  ]);
  const plain = withAssessments("calculo", [{ id: "f", title: "Final", kind: "final", date: "2027-01-20", weight: 100, unitIds: [] }]);
  const a = subjectRoute(input(withTime, "2026-09-24"), "calculo");
  assert.deepEqual(brief(a), brief(subjectRoute(input(plain, "2026-09-24"), "calculo")));
  assert.equal(a.steps.at(-1)!.due, "2027-01-20");
});

test("un parcial anterior al inicio de curso no reparte los controles (se usa el parcial virtual)", () => {
  // C = 21-oct, F = 20-ene → fin de controles 30-dic (70 días). t1: 70/3 = 23,3 → 23 → 13-nov; parcial virtual = 23-nov.
  const s = withAssessments("calculo", [
    { id: "p", title: "Test previo", kind: "parcial", date: "2026-10-10", weight: 10, unitIds: ["calculo.t1"] },
    { id: "f", title: "Final", kind: "final", date: "2027-01-20", weight: 90, unitIds: [] },
  ]);
  const r = subjectRoute(input(s, "2026-09-24"), "calculo");
  assert.deepEqual(r.steps.map((x) => [x.kind, x.trialId ?? x.assessmentId, x.due]), [
    ["exam", "p", "2026-10-10"],
    ["control", "calculo.control.t1", "2026-11-13"],
    ["sim-parcial", "calculo.parcial.n2", "2026-11-16"],
    ["sim-parcial", "calculo.parcial.n3", "2026-11-20"],
    ["control", "calculo.control.t2", "2026-12-30"],
    ["sim-final", "calculo.final.n2", "2027-01-05"],
    ["sim-final", "calculo.final.n4", "2027-01-15"],
    ["exam", "f", "2027-01-20"],
  ]);
});

test("pasos cuyo examen ya pasó: 'skipped' (ya no aplica), no cuentan como atrasados ni en el total", () => {
  const s = withAssessments("calculo", [
    { id: "p", title: "Parcial 1", kind: "parcial", date: "2026-12-10", weight: 40, unitIds: ["calculo.t1"] },
    { id: "f", title: "Final", kind: "final", date: "2027-01-20", weight: 60, unitIds: [] },
  ]);
  const r = subjectRoute(input(s, "2026-12-12"), "calculo");
  assert.deepEqual(r.steps.map((x) => [x.trialId ?? x.assessmentId, x.status]), [
    ["calculo.control.t1", "skipped"],
    ["calculo.parcial.n2", "skipped"],
    ["calculo.parcial.n3", "skipped"],
    ["p", "done"],
    ["calculo.control.t2", "next"],
    ["calculo.final.n2", "upcoming"],
    ["calculo.final.n4", "upcoming"],
    ["f", "upcoming"],
  ]);
  assert.equal(r.onTrack, true);
  assert.equal(r.skipped, 3);
  assert.equal(r.total, 3);       // 6 pasos de preparación − 3 que ya no aplican
  const routes = buildRoutes(input(s, "2026-12-12"));
  assert.ok(!nextObjectives(routes, 50).some((x) => x.status === "skipped"));
  assert.ok(!thisWeek(routes).some((x) => x.status === "skipped"));
  // un paso hecho sigue contando como hecho aunque su examen haya pasado
  const withDone = { ...s, trials: { "calculo.control.t1": [done("a", 8, "2026-11-29")] } };
  const r2 = subjectRoute(input(withDone, "2026-12-12"), "calculo");
  assert.equal(r2.steps[0].status, "done");
  assert.equal(r2.done, 1);
  assert.equal(r2.total, 4);
});
