import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { bestExpeditionScore, campaignOf } from "../src/domain/campaigns";
import { assessmentAfterEdit, onlineTemplate, TEMPLATE_FINAL_DAYS } from "../src/domain/calendar-template";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type Assessment, type Expedition, type ExpeditionAttempt, type UserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
const now = new Date("2026-10-01T12:00:00");
const progress = deriveProgress([], sch, now);

const exp = (id: string, subjects: string[], kind: Expedition["kind"], difficulty?: Expedition["difficulty"]): Expedition => ({
  id, university: "U", course: id, courseName: id, term: "T", title: id, kind, durationMin: 60,
  url: "https://example.org/e.pdf", solutionsUrl: "https://example.org/s.pdf", license: "CC", subjects, level: "grado",
  whyThisOne: "…", problems: [{ n: "1", topic: "t", concepts: ["calculus.functions"] }, { n: "2", topic: "t", concepts: ["calculus.derivative"] }],
  ...(difficulty ? { difficulty } : {}),
});
const EXPS: Expedition[] = [
  exp("c-final-b", ["calculo"], "final"),                 // sin difficulty: final → 3
  exp("c-final-a", ["calculo", "algebra"], "final", 3),
  exp("a-final", ["algebra"], "final", 4),
  exp("c-parcial", ["calculo"], "parcial", 3),
  exp("c-quiz", ["calculo"], "quiz", 1),
];
const attempt = (id: string, scores: ExpeditionAttempt["scores"], ended = true): ExpeditionAttempt => ({
  id, startedAt: "2026-09-30T09:00:00.000Z", ...(ended ? { endedAt: "2026-09-30T10:00:00.000Z" } : {}), scores,
});
const withExp = (e: Record<string, ExpeditionAttempt[]>): UserState => ({ ...emptyUserState("2026-09-01T00:00:00.000Z"), expeditions: e });

test("campaignOf: misiones que incluyen la asignatura, por dificultad, tipo e id", () => {
  const c = campaignOf("calculo", EXPS, withExp({}), progress);
  assert.deepEqual(c.rungs.map((r) => [r.expedition.id, r.difficulty]), [
    ["c-quiz", 1], ["c-parcial", 3], ["c-final-a", 3], ["c-final-b", 3],
  ]);
  assert.deepEqual(campaignOf("algebra", EXPS, withExp({}), progress).rungs.map((r) => r.expedition.id), ["c-final-a", "a-final"]);
  assert.deepEqual(campaignOf("prepro", EXPS, withExp({}), progress).rungs, []);
});

test("campaignOf: superado con nota ≥ 7, siguiente peldaño = primero sin superar, cumbre = el último", () => {
  const s = withExp({
    "c-quiz": [attempt("q1", { "1": 1, "2": 0.5 })],            // 7,5 → superado
    "c-parcial": [attempt("p1", { "1": 1, "2": 1 }, false)],    // sin terminar: no cuenta
  });
  const c = campaignOf("calculo", EXPS, s, progress);
  assert.deepEqual(c.rungs.map((r) => [r.expedition.id, r.best, r.passed, r.isNext, r.isSummit]), [
    ["c-quiz", 7.5, true, false, false],
    ["c-parcial", null, false, true, false],
    ["c-final-a", null, false, false, false],
    ["c-final-b", null, false, false, true],
  ]);
  assert.equal(c.passed, 1);
  assert.equal(c.summitPassed, false);
  assert.equal(c.rungs[0].readiness.ratio, 0);
});

test("bestExpeditionScore: la mejor nota de los intentos terminados, o null", () => {
  const e = EXPS[4];
  assert.equal(bestExpeditionScore(e, withExp({})), null);
  assert.equal(bestExpeditionScore(e, withExp({ "c-quiz": [attempt("a", { "1": 1, "2": 0 }), attempt("b", { "1": 1, "2": 1 }), attempt("c", { "1": 0, "2": 0 }, false)] })), 10);
});

test("onlineTemplate: evaluación continua 40 % + final 60 % en días laborables de febrero, solo donde no hay evaluaciones", () => {
  assert.deepEqual(TEMPLATE_FINAL_DAYS, [
    "2027-02-08", "2027-02-09", "2027-02-10", "2027-02-11", "2027-02-12",
    "2027-02-15", "2027-02-16", "2027-02-17", "2027-02-18", "2027-02-19",
  ]);
  const s: UserState = {
    ...emptyUserState("2026-09-01T00:00:00.000Z"),
    subjects: { calculo: { currentUnit: 1, updatedAt: "", assessments: [{ id: "x", title: "Mío", kind: "final", weight: 100, unitIds: [] }] } },
  };
  const t = onlineTemplate(index, s);
  assert.deepEqual(Object.keys(t), ["algebra", "prepro"]);   // cálculo ya tiene evaluaciones
  assert.deepEqual(t.algebra, [
    { id: "algebra.plantilla.continua", title: "Evaluación continua", kind: "entrega", weight: 40, unitIds: ["algebra.t1", "algebra.t2"], template: true },
    { id: "algebra.plantilla.final", title: "Examen final", kind: "final", date: "2027-02-08", weight: 60, unitIds: ["algebra.t1", "algebra.t2"], template: true },
  ]);
  // la fecha depende de la posición de la asignatura en el curso, no de cuántas reciben plantilla
  assert.equal(t.prepro[1].date, "2027-02-10");
});

/* ───────── Casos límite (revisión) ───────── */

test("onlineTemplate: solo asignaturas del curso actual, y la fecha según su posición entre ellas", () => {
  const subjects = fixtureSubjects.map((s) => (s.id === "algebra" ? { ...s, status: "future" as const } : s));
  const idx = new CatalogIndex(buildCatalog(subjects, fixtureFiles));
  const t = onlineTemplate(idx, emptyUserState("2026-09-01T00:00:00.000Z"));
  assert.deepEqual(Object.keys(t), ["calculo", "prepro"]);
  assert.deepEqual([t.calculo[1].date, t.prepro[1].date], ["2027-02-08", "2027-02-09"]);
});

test("assessmentAfterEdit: la marca de plantilla se quita al cambiar fecha o peso, y solo entonces", () => {
  const tpl: Assessment = { id: "f", title: "Examen final", kind: "final", date: "2027-02-08", weight: 60, unitIds: [], template: true };
  // editar el título sin pasar `template` (un formulario que no lo conoce) la conserva
  const { template: _drop, ...withoutFlag } = tpl;
  assert.equal(assessmentAfterEdit(tpl, { ...withoutFlag, title: "Final ordinario" }).template, true);
  assert.equal(assessmentAfterEdit(tpl, { ...tpl, unitIds: ["calculo.t1"] }).template, true);
  // cambiar la fecha o el peso la quita (sin dejar la clave)
  assert.ok(!("template" in assessmentAfterEdit(tpl, { ...tpl, date: "2027-02-10" })));
  assert.ok(!("template" in assessmentAfterEdit(tpl, { ...tpl, weight: 50 })));
  assert.ok(!("template" in assessmentAfterEdit(tpl, { ...withoutFlag, date: undefined })));
  // `template: false` explícito se respeta; una evaluación nueva queda como venga
  assert.ok(!assessmentAfterEdit(tpl, { ...tpl, template: false }).template);
  assert.deepEqual(assessmentAfterEdit(undefined, tpl), tpl);
  const real: Assessment = { ...withoutFlag };
  assert.ok(!("template" in assessmentAfterEdit(real, { ...real, date: "2027-03-01" })));
});
