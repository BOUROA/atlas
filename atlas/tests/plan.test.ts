// Misión del día (spec 2026-09-25-mision-del-dia-camino §3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { completedDayPlans, composeDayPlan, isDayCompleted, missionStatuses, tomorrowFocus, type DayPlan, type PlanInput } from "../src/domain/plan";
import { totalXp, XP_RULES } from "../src/domain/game/xp";
import { mergeStates } from "../src/domain/sync";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { buildQueue } from "../src/domain/tutor/queue";
import { emptyUserState, type StudyEvent, type Trial, type TrialAttempt, type UserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
let n = 0;
const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}, hour = 10): StudyEvent => ({
  id: `p${n++}`, at: at(day, hour), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});
const level2 = (conceptId: string, day1: string, day2: string) => [ev(conceptId, day1, "seen"), ev(conceptId, day2, "review")];
const trial = (id: string, kind: Trial["kind"], level: Trial["level"], unitIds: string[], durationMin = 30): Trial => ({
  id, subjectId: "calculo", kind, level, title: id, unitIds, durationMin,
  problems: [{ n: "1", points: 10, difficulty: 2, concepts: ["calculus.functions"], statement: "e", solution: "s", rubric: [{ text: "r", points: 10 }] }],
});
const TRIALS: Trial[] = [trial("calculo.control.t1", "control", 2, ["calculo.t1"])];
const base = (patch: Partial<UserState> = {}): UserState => ({ ...emptyUserState("2026-09-01T00:00:00.000Z"), ...patch });
const withMinutes = (s: UserState, dailyMinutes: number): UserState => ({ ...s, settings: { ...s.settings, dailyMinutes } });
const input = (state: UserState, iso: string, trials: Trial[] = []): PlanInput => ({ index, state, scheduler: sch, trials, expeditions: [], now: new Date(iso) });
const kinds = (p: DayPlan) => p.missions.map((m) => [m.kind, m.subjectId ?? null, m.conceptIds]);

test("sin actividad: avances de las asignaturas en foco (empate → orden) y, si hay menos de 3 misiones, uno extra", () => {
  const p = composeDayPlan(input(base(), "2026-11-19T09:00:00"));
  assert.equal(p.day, "2026-11-19");
  assert.deepEqual(kinds(p), [
    ["advance", "algebra", ["algebra.vectors", "algebra.matrices", "algebra.eigen"]],
    ["advance", "calculo", ["calculus.functions", "calculus.derivative", "calculus.chain_rule"]],
    // covarianza necesita matrices (de otra asignatura, aún sin ver): solo entra la varianza
    ["advance", "prepro", ["stats.variance"]],
  ]);
  assert.deepEqual(p.focus, ["algebra", "calculo", "prepro"]);
  assert.equal(p.missions[0].title, "Álgebra · Tema 1");
  assert.equal(p.missions[0].unitId, "algebra.t1");
  assert.equal(p.missions[0].minutes, 18);   // 3 conceptos × 6 min
  assert.equal(p.missions[0].target, 3);
});

test("rotación: gana la asignatura que lleva más días sin avanzar; K = 3 con 180 min o más", () => {
  const s = base({ events: [ev("algebra.vectors", "2026-11-18", "seen")] });
  const p2 = composeDayPlan(input(s, "2026-11-19T09:00:00"));
  assert.deepEqual(p2.focus.slice(0, 2), ["calculo", "prepro"]);
  const p3 = composeDayPlan(input(withMinutes(s, 240), "2026-11-19T09:00:00"));
  assert.deepEqual(p3.focus, ["calculo", "prepro", "algebra"]);
});

test("congelado: lo estudiado hoy no cambia el plan de hoy (solo su progreso)", () => {
  const before = base({ events: [ev("algebra.vectors", "2026-11-17", "seen")] });
  const morning = composeDayPlan(input(before, "2026-11-19T08:00:00"));
  const later = { ...before, events: [...before.events, ev("calculus.functions", "2026-11-19", "seen", {}, 11), ev("stats.variance", "2026-11-19", "seen", {}, 12)] };
  const evening = composeDayPlan(input(later, "2026-11-19T21:00:00"));
  assert.deepEqual({ ...evening, createdAt: "" }, { ...morning, createdAt: "" });
});

test("calentamiento: los repasos pendientes del día van primero; hecho al hacer ese número de repasos hoy", () => {
  const events = [...level2("calculus.functions", "2026-11-01", "2026-11-02"), ...level2("algebra.vectors", "2026-11-01", "2026-11-02")];
  const s = base({ events });
  const p = composeDayPlan(input(s, "2026-11-19T09:00:00"));
  const dayEnd = new Date("2026-11-19T23:59:59");
  const q = buildQueue({ index, state: s, progress: deriveProgress(events, sch, dayEnd), scheduler: sch, now: dayEnd, reviewsOnly: true });
  const expected = q.items.filter((i) => i.type !== "new").length;
  assert.ok(expected > 0, "el fixture debe tener repasos pendientes");
  assert.equal(p.missions[0].kind, "review");
  assert.equal(p.missions[0].target, expected);
  const partial = { ...s, events: [...events, ev("calculus.functions", "2026-11-19", "review", {}, 11)] };
  const st = missionStatuses(p, partial)[0];
  assert.equal(st.count, 1);
  assert.equal(st.done, expected <= 1);
  const doneAll = { ...s, events: [...events, ...Array.from({ length: expected }, (_, i) => ev("algebra.vectors", "2026-11-19", "review", {}, 11 + (i % 10)))] };
  assert.equal(missionStatuses(p, doneAll)[0].done, true);
});

test("avance: hecho cuando todos sus conceptos tienen un evento hoy; cuenta parcial", () => {
  const s = base();
  const p = composeDayPlan(input(s, "2026-11-19T09:00:00"));
  const adv = p.missions.findIndex((m) => m.kind === "advance" && m.subjectId === "calculo");
  const some = { ...s, events: [ev("calculus.functions", "2026-11-19", "seen", {}, 11)] };
  assert.deepEqual([missionStatuses(p, some)[adv].count, missionStatuses(p, some)[adv].done], [1, false]);
  const all = { ...s, events: ["calculus.functions", "calculus.derivative", "calculus.chain_rule"].map((c) => ev(c, "2026-11-19", "seen", {}, 12)) };
  assert.equal(missionStatuses(p, all)[adv].done, true);
  // un evento de ayer no cuenta para hoy
  const yesterday = { ...s, events: ["calculus.functions", "calculus.derivative", "calculus.chain_rule"].map((c) => ev(c, "2026-11-18", "seen")) };
  assert.equal(missionStatuses(p, yesterday)[adv].done, false);
});

test("demuestra: una prueba lista (preparación ≥ 70 %) y no superada, al final; hecha con un intento terminado hoy", () => {
  const events = level2("calculus.functions", "2026-11-01", "2026-11-02");
  const s = base({ events });
  const p = composeDayPlan(input(s, "2026-11-19T09:00:00", TRIALS));
  const last = p.missions[p.missions.length - 1];
  assert.equal(last.kind, "trial");
  assert.equal(last.trialId, "calculo.control.t1");
  assert.equal(last.minutes, 45);   // 30 de prueba + 15 de corrección
  const attempt: TrialAttempt = { id: "a", startedAt: at("2026-11-19", 16), endedAt: at("2026-11-19", 17), earned: { "1": 5 } };
  assert.equal(missionStatuses(p, { ...s, trials: { "calculo.control.t1": [attempt] } }).at(-1)!.done, true);
  // ya superada: no se propone
  const passed: TrialAttempt = { id: "b", startedAt: at("2026-11-10"), endedAt: at("2026-11-10", 11), earned: { "1": 8 } };
  const p2 = composeDayPlan(input({ ...s, trials: { "calculo.control.t1": [passed] } }, "2026-11-19T09:00:00", TRIALS));
  assert.ok(!p2.missions.some((m) => m.kind === "trial"));
});

test("presupuesto: los avances se recortan (mínimo 2 conceptos) y los extra solo entran si caben", () => {
  const p = composeDayPlan(input(withMinutes(base(), 30), "2026-11-19T09:00:00"));
  assert.deepEqual(kinds(p), [
    ["advance", "algebra", ["algebra.vectors", "algebra.matrices", "algebra.eigen"]],
    ["advance", "calculo", ["calculus.functions", "calculus.derivative"]],
  ]);
  assert.equal(p.missions.reduce((a, m) => a + m.minutes, 0), 30);
});

test("arrastre sin culpa: lo no hecho de ayer entra primero y su asignatura entra en foco; solo desde ayer", () => {
  const yesterdayPlan: DayPlan = {
    day: "2026-11-18", createdAt: at("2026-11-18", 8), focus: ["calculo"],
    missions: [{ id: "2026-11-18:advance:calculo", kind: "advance", title: "Cálculo · Tema 1", subjectId: "calculo", unitId: "calculo.t1",
      conceptIds: ["calculus.functions", "calculus.derivative", "calculus.chain_rule"], target: 3, minutes: 18 }],
  };
  const s = base({ events: [ev("calculus.functions", "2026-11-18", "seen")], dayPlans: { "2026-11-18": yesterdayPlan } });
  const p = composeDayPlan(input(s, "2026-11-19T09:00:00"));
  const adv = p.missions.filter((m) => m.kind === "advance");
  assert.deepEqual(adv[0].subjectId, "calculo");
  assert.deepEqual(adv[0].conceptIds, ["calculus.derivative", "calculus.chain_rule"]);
  assert.equal(adv[0].carried, true);
  assert.ok(p.focus.includes("calculo"));
  // el mismo plan, pero de hace dos días: no se arrastra
  const old = base({ events: [ev("calculus.functions", "2026-11-17", "seen")], dayPlans: { "2026-11-17": { ...yesterdayPlan, day: "2026-11-17" } } });
  const p2 = composeDayPlan(input(old, "2026-11-19T09:00:00"));
  assert.ok(!p2.missions.some((m) => m.carried));
});

test("como mucho 5 misiones", () => {
  const events = [...level2("calculus.functions", "2026-11-01", "2026-11-02"), ...level2("algebra.vectors", "2026-11-01", "2026-11-02")];
  const p = composeDayPlan(input(withMinutes(base({ events }), 600), "2026-11-19T09:00:00", TRIALS));
  assert.ok(p.missions.length >= 3 && p.missions.length <= 5);
});

test("día completado: todas sus misiones hechas ese día → +60 XP; la instantánea más antigua gana al fusionar", () => {
  const plan: DayPlan = {
    day: "2026-11-18", createdAt: at("2026-11-18", 8), focus: ["prepro"],
    missions: [{ id: "2026-11-18:advance:prepro", kind: "advance", title: "Preprocesamiento · Tema 1", subjectId: "prepro", unitId: "prepro.t1",
      conceptIds: ["stats.variance"], target: 1, minutes: 6 }],
  };
  const done = base({ events: [ev("stats.variance", "2026-11-18", "seen")], dayPlans: { "2026-11-18": plan } });
  const notDone = base({ events: [ev("stats.variance", "2026-11-19", "seen")], dayPlans: { "2026-11-18": plan } });   // lo hizo al día siguiente
  assert.equal(isDayCompleted(plan, done), true);
  assert.equal(isDayCompleted(plan, notDone), false);
  assert.deepEqual(completedDayPlans(done), ["2026-11-18"]);
  assert.deepEqual(completedDayPlans(notDone), []);
  assert.equal(XP_RULES.dayPlan, 60);
  const now = new Date("2026-11-20T12:00:00");
  const xpWith = totalXp(done, deriveProgress(done.events, sch, now)).total;
  const xpWithout = totalXp({ ...done, dayPlans: {} }, deriveProgress(done.events, sch, now)).total;
  assert.equal(xpWith - xpWithout, 60);
  // fusión: por día, la instantánea con createdAt menor
  const later: DayPlan = { ...plan, createdAt: at("2026-11-18", 20), focus: ["algebra"] };
  const m = mergeStates(base({ dayPlans: { "2026-11-18": later } }), base({ dayPlans: { "2026-11-18": plan } }));
  assert.deepEqual(m.dayPlans!["2026-11-18"].focus, ["prepro"]);
  assert.equal(mergeStates(base(), base()).dayPlans, undefined);
});

test("mañana: la rotación supone hecho el avance de hoy", () => {
  const inp = input(base(), "2026-11-19T09:00:00");
  const today = composeDayPlan(inp);   // foco: algebra, calculo (+ prepro extra)
  assert.deepEqual(tomorrowFocus(inp, { ...today, focus: ["algebra", "calculo"] }), ["prepro", "algebra"]);
});

test("calentamiento: como mucho el 60 % del presupuesto, en orden de prioridad de la cola", () => {
  // 8 conceptos con repaso pendiente; presupuesto 10 min → tope 6 min → 4 repasos de 1,5 min.
  const ids = ["algebra.vectors", "algebra.matrices", "algebra.eigen", "calculus.functions", "calculus.derivative", "calculus.chain_rule", "stats.variance", "stats.covariance"];
  const events = ids.flatMap((c) => level2(c, "2026-11-01", "2026-11-02"));
  const s = withMinutes(base({ events }), 10);
  const p = composeDayPlan(input(s, "2026-11-19T09:00:00"));
  assert.equal(p.missions[0].kind, "review");
  assert.ok(p.missions[0].minutes <= 6, `minutos ${p.missions[0].minutes}`);
  assert.ok(p.missions[0].target >= 1 && p.missions[0].target < ids.length);
});

test("refuerzo: desaparece en cuanto el concepto se repasa bien después del fallo", () => {
  const failed: TrialAttempt = { id: "f", startedAt: at("2026-11-17", 9), endedAt: at("2026-11-17", 10), earned: { "1": 1 } };
  const seenBefore = [ev("calculus.functions", "2026-11-10", "seen")];
  const s = base({ events: seenBefore, trials: { "calculo.control.t1": [failed] } });
  const p = composeDayPlan(input(s, "2026-11-19T09:00:00", TRIALS));
  assert.deepEqual(p.missions.find((m) => m.kind === "reinforce")?.conceptIds, ["calculus.functions"]);
  const fixed = { ...s, events: [...seenBefore, ev("calculus.functions", "2026-11-18", "review")] };
  const p2 = composeDayPlan(input(fixed, "2026-11-19T09:00:00", TRIALS));
  assert.ok(!p2.missions.some((m) => m.kind === "reinforce"));
});
