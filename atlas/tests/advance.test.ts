import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { neededEarly } from "../src/domain/tutor/advance";
import { tutorHeadline } from "../src/domain/tutor/headline";
import { buildQueue } from "../src/domain/tutor/queue";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const now = new Date("2026-09-10T10:00:00");
const sch = createScheduler(0.9);

test("adelantar: lo que otra asignatura ya necesita y la suya aún no ha dado, con cierre transitivo", () => {
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"),
    subjects: { prepro: { currentUnit: 2, assessments: [], updatedAt: "" }, algebra: { currentUnit: 1, assessments: [], updatedAt: "" } } };
  const early = neededEarly(index, s);
  // algebra.eigen requiere algebra.matrices, pero su tema (algebra.t1) ya está
  // alcanzado (currentUnit 1) así que no se adelanta más. calculus.chain_rule
  // requiere calculus.derivative, en calculo.t2, que cálculo (tema 1 por
  // defecto) todavía no ha alcanzado: el cierre transitivo lo adelanta también.
  assert.deepEqual(early.map((e) => [e.conceptId, e.bySubject, e.via]), [
    ["algebra.eigen", "prepro", "data.pca"],
    ["calculus.chain_rule", "prepro", "data.gradient_descent"],   // cálculo sigue en el tema 1 (por defecto)
    ["calculus.derivative", "calculo", "calculus.chain_rule"],    // cierre transitivo: lo necesita chain_rule
  ]);
});
test("la cola propone adelantar con su motivo (directo y por cierre transitivo)", () => {
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"),
    subjects: { prepro: { currentUnit: 2, assessments: [], updatedAt: "" }, algebra: { currentUnit: 1, assessments: [], updatedAt: "" } } };
  const q = buildQueue({ index, state: s, progress: deriveProgress([], sch, now), scheduler: sch, now });
  const item = q.items.find((i) => i.conceptId === "algebra.eigen")!;
  assert.equal(item.type, "new");
  assert.equal(item.reasons[0], "Adelántalo: ya lo necesitas en Preprocesamiento (PCA)");
  const chained = q.items.find((i) => i.conceptId === "calculus.derivative")!;
  assert.equal(chained.type, "new");
  assert.equal(chained.reasons[0], "Adelántalo: lo necesitas para Regla de la cadena");
});
test("titular del tutor menciona la asignatura con más peso y su evaluación", () => {
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"),
    subjects: { calculo: { currentUnit: 2, updatedAt: "", assessments: [{ id: "p", title: "Parcial 1", kind: "parcial" as const, date: "2026-10-03", weight: 30, unitIds: ["calculo.t2"] }] } } };
  const q = buildQueue({ index, state: s, progress: deriveProgress([], sch, now), scheduler: sch, now });
  const h = tutorHeadline({ index, state: s, queue: q, now });
  assert.match(h, /Cálculo/);
  assert.match(h, /23 días/);
});
