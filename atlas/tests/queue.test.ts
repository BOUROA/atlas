import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { buildQueue } from "../src/domain/tutor/queue";
import { implicitEvents } from "../src/domain/tutor/implicit";
import { examReadiness } from "../src/domain/tutor/forecast";
import { emptyUserState, type Expedition, type ExpeditionAttempt, type StudyEvent, type UserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
const now = new Date("2026-09-10T10:00:00");
let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `q${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});
const stateWith = (events: StudyEvent[], patch: Partial<UserState> = {}): UserState => ({ ...emptyUserState("2026-09-01T00:00:00.000Z"), events, ...patch });
const run = (s: UserState, opts = {}) => buildQueue({ index, state: s, progress: deriveProgress(s.events, sch, now), scheduler: sch, now, ...opts });

test("sin actividad: propone los conceptos del tema 1 respetando requisitos", () => {
  const q = run(stateWith([]));
  assert.deepEqual(q.planned.map((i) => i.conceptId).sort(),
    ["algebra.matrices", "algebra.vectors", "calculus.functions", "stats.covariance", "stats.variance"]);
  assert.ok(q.planned.every((i) => i.type === "new"));
  const order = q.planned.map((i) => i.conceptId);
  assert.ok(order.indexOf("algebra.vectors") < order.indexOf("algebra.matrices"));
  assert.ok(order.indexOf("algebra.matrices") < order.indexOf("stats.covariance"));
  assert.equal(q.totals.minutes, 30);
});
test("el presupuesto limita el plan", () => {
  const s = stateWith([]);
  s.settings = { ...s.settings, dailyMinutes: 10 };
  const q = run(s);
  assert.equal(q.planned.length, 1);
  assert.equal(q.totals.minutes, 6);
  assert.ok(q.items.length > q.planned.length);
});
test("reparte los nuevos en turnos por asignatura: ninguna se queda sin nada mientras otra acumula de más", () => {
  const s = stateWith([], {
    subjects: {
      algebra: { currentUnit: 2, assessments: [], updatedAt: "" },
      calculo: { currentUnit: 2, assessments: [], updatedAt: "" },
      prepro: { currentUnit: 2, assessments: [], updatedAt: "" },
    },
  });
  // Con el tema 2 también desbloqueado hay 10 candidatos a nuevo (algebra 3,
  // calculo 3, prepro 4) repartidos en 3 asignaturas de impacto muy distinto
  // (vectors/matrices tienen muchos más dependientes que pca o gradient_descent):
  // sin turnos, las de más impacto se comerían el presupuesto entero.
  s.settings = { ...s.settings, dailyMinutes: 36 }; // 6 nuevos (6 min cada uno)
  const q = run(s);
  const news = q.planned.filter((i) => i.type === "new");
  assert.equal(news.length, 6);

  const bySubject = new Map<string, number>();
  for (const item of news) {
    const sid = index.conceptById.get(item.conceptId)!.subjectId;
    bySubject.set(sid, (bySubject.get(sid) ?? 0) + 1);
  }
  // Las 3 asignaturas tienen candidatos (algebra, calculo, prepro): ninguna se queda a 0…
  assert.deepEqual([...bySubject.keys()].sort(), ["algebra", "calculo", "prepro"]);
  const cap = Math.ceil(news.length / bySubject.size) + 1; // techo del enunciado
  // …y ninguna acumula más de ceil(total/asignaturas)+1 mientras las demás tienen candidatos.
  for (const count of bySubject.values()) assert.ok(count <= cap, `una asignatura se llevó ${count} > ${cap}`);

  // Los requisitos se siguen respetando dentro de lo planeado.
  const order = q.planned.map((i) => i.conceptId);
  const plannedSet = new Set(order);
  for (const item of news) {
    for (const req of index.requiresOf.get(item.conceptId) ?? []) {
      if (plannedSet.has(req)) assert.ok(order.indexOf(req) < order.indexOf(item.conceptId), `${req} debería ir antes que ${item.conceptId}`);
    }
  }
});
test("repaso pendiente con motivo de enfriamiento", () => {
  const q = run(stateWith([ev("algebra.matrices", "2026-08-20", "seen"), ev("algebra.matrices", "2026-08-21", "review")]));
  const item = q.items.find((i) => i.conceptId === "algebra.matrices")!;
  assert.equal(item.type, "review");
  assert.ok(item.reasons.some((r) => r.includes("hace 20 días")), item.reasons.join(" | "));
});
test("primer recuerdo de lo visto en clase", () => {
  const q = run(stateWith([ev("calculus.functions", "2026-09-09", "seen", { source: "class" })]));
  const item = q.items.find((i) => i.conceptId === "calculus.functions")!;
  assert.equal(item.type, "first");
  assert.ok(item.reasons.some((r) => r.startsWith("Lo viste en clase")));
});
test("a igual frescura, más impacto va antes", () => {
  const evs = ["algebra.vectors", "stats.variance"].flatMap((id) => [ev(id, "2026-08-20", "seen"), ev(id, "2026-08-21", "review")]);
  const ids = run(stateWith(evs)).items.map((i) => i.conceptId);
  assert.ok(ids.indexOf("algebra.vectors") < ids.indexOf("stats.variance"));
});
test("modo examen: repasa lo del examen aunque no toque", () => {
  const s = stateWith(
    [ev("calculus.chain_rule", "2026-09-04", "seen"), ev("calculus.chain_rule", "2026-09-05", "review", { grade: 4 })],
    { subjects: { calculo: { currentUnit: 2, updatedAt: "", assessments: [{ id: "p1", title: "Parcial 1", kind: "parcial", date: "2026-09-15", weight: 30, unitIds: ["calculo.t2"] }] } } },
  );
  const item = run(s).items.find((i) => i.conceptId === "calculus.chain_rule")!;
  assert.equal(item.type, "review");
  assert.equal(item.reasons[0], "Parcial 1 de Cálculo en 5 días");
});
test("filtro por asignatura y solo repasos", () => {
  const s = stateWith([ev("algebra.matrices", "2026-08-20", "seen"), ev("algebra.matrices", "2026-08-21", "review")]);
  const onlyCalc = run(s, { subjectId: "calculo" }).items;
  assert.ok(onlyCalc.every((i) => index.subjectsOfConcept(i.conceptId).includes("calculo")));
  assert.ok(onlyCalc.some((i) => i.conceptId === "algebra.matrices"));   // alsoIn cálculo
  assert.ok(run(s, { reviewsOnly: true }).items.every((i) => i.type !== "new"));
});
test("repaso implícito de requisitos directos a punto de vencer", () => {
  const evs = [
    ev("calculus.derivative", "2026-09-01", "seen"), ev("calculus.derivative", "2026-09-02", "review"),
    ev("calculus.functions", "2026-09-01", "seen"), ev("calculus.functions", "2026-09-02", "review"),
  ];
  const progress = deriveProgress(evs, sch, now);
  const review = ev("calculus.chain_rule", "2026-09-10", "review");
  const imp = implicitEvents({ index, progress, review, events: evs, now });
  assert.deepEqual(imp.map((e) => e.conceptId), ["calculus.derivative"]);
  assert.equal(imp[0].kind, "implicit");
  assert.equal(imp[0].grade, 3);
  assert.deepEqual(implicitEvents({ index, progress, review: { ...review, grade: 1 }, events: evs, now }), []);
});
test("previsión de examen entre 0 y 1 y crece con el estudio", () => {
  const a = { id: "p1", title: "Parcial 1", kind: "parcial" as const, date: "2026-09-20", weight: 30, unitIds: ["calculo.t2"] };
  const empty = examReadiness({ index, progress: deriveProgress([], sch, now), scheduler: sch, assessment: a });
  const evs = [
    ...["calculus.derivative", "calculus.chain_rule"].flatMap((id) => [ev(id, "2026-09-08", "seen"), ev(id, "2026-09-09", "review")]),
    ev("calculus.functions", "2026-09-08", "seen"),
  ];
  const some = examReadiness({ index, progress: deriveProgress(evs, sch, now), scheduler: sch, assessment: a });
  assert.equal(empty.expected, 0);
  assert.ok(some.expected > 0 && some.expected <= 1);
  assert.deepEqual(some.conceptIds.sort(), ["calculus.chain_rule", "calculus.derivative", "calculus.functions"]);
  assert.equal(some.coverage, 2 / 3);
});

const missionExpedition: Expedition = {
  id: "ficticia.calculo.final-2025", university: "Universidad de Prueba", course: "Cálculo I", courseName: "Cálculo I",
  term: "2025-S1", title: "Examen final", kind: "final", durationMin: 120,
  url: "https://example.org/examen.pdf", solutionsUrl: "https://example.org/soluciones.pdf", license: "CC-BY-SA",
  subjects: ["calculo"], level: "grado", whyThisOne: "Cubre bien la regla de la cadena.",
  problems: [
    { n: "1", topic: "Derivadas", concepts: ["calculus.derivative"] },
    { n: "2", topic: "Regla de la cadena", concepts: ["calculus.chain_rule"] },
  ],
};
test("refuerzo tras una misión: nivel 0 entra como nuevo con su motivo", () => {
  const attempt: ExpeditionAttempt = { id: "att1", startedAt: "2026-09-08T10:00:00.000Z", endedAt: "2026-09-08T11:00:00.000Z", scores: { "1": 0, "2": 1 } };
  const s = stateWith([], { expeditions: { [missionExpedition.id]: [attempt] } });
  const q = run(s, { expeditions: [missionExpedition] });
  const item = q.items.find((i) => i.conceptId === "calculus.derivative")!;
  assert.equal(item.type, "new");
  assert.equal(item.reasons[0], "Reforzar tras la misión Cálculo I (Universidad de Prueba)");
  // El problema 2 (regla de la cadena) se superó: no se propone reforzarlo.
  assert.ok(!q.items.some((i) => i.conceptId === "calculus.chain_rule" && i.reasons.some((r) => r.startsWith("Reforzar"))));
});
test("refuerzo tras una misión: un concepto con nivel ya alcanzado entra como repaso aunque no toque", () => {
  const evs = [ev("calculus.chain_rule", "2026-09-09", "seen"), ev("calculus.chain_rule", "2026-09-09", "review", { grade: 4 })];
  const attempt: ExpeditionAttempt = { id: "att2", startedAt: "2026-09-09T12:00:00.000Z", endedAt: "2026-09-09T12:30:00.000Z", scores: { "2": 0 } };
  const s = stateWith(evs, { expeditions: { [missionExpedition.id]: [attempt] } });
  // Sin `expeditions`, el acierto reciente hace que no toque repasar todavía.
  assert.ok(!run(s).items.some((i) => i.conceptId === "calculus.chain_rule"));
  const q = run(s, { expeditions: [missionExpedition] });
  const item = q.items.find((i) => i.conceptId === "calculus.chain_rule")!;
  assert.equal(item.type, "review");
  assert.ok(item.reasons.includes("Reforzar tras la misión Cálculo I (Universidad de Prueba)"));
});
