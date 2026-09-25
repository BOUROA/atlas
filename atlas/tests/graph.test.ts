import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { prerequisitesDeep, dependentsDeep, neededIn, impactOf, layers, externalBases, feedsInto } from "../src/domain/graph";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));

test("prerrequisitos transitivos con profundidad", () => {
  const p = prerequisitesDeep(index, "data.pca");
  assert.deepEqual(Object.fromEntries(p.map((x) => [x.id, x.depth])), {
    "stats.covariance": 1, "algebra.eigen": 1, "stats.variance": 2, "algebra.matrices": 2, "algebra.vectors": 3,
  });
});
test("dependientes transitivos", () => {
  assert.deepEqual(dependentsDeep(index, "algebra.vectors").map((x) => x.id).sort(),
    ["algebra.eigen", "algebra.matrices", "data.pca", "stats.covariance"]);
});
test("neededIn: asignaturas ajenas que lo necesitan, con conceptos vía", () => {
  const n = neededIn(index, "algebra.matrices");
  assert.deepEqual(n.map((x) => x.subjectId), ["prepro", "calculo"]);
  assert.deepEqual(n[0].via, ["stats.covariance", "data.pca"]);
  assert.equal(n[0].role, "depends");
  assert.deepEqual(n[1].via, []);
  assert.equal(n[1].role, "used");
  assert.deepEqual(neededIn(index, "stats.variance"), []);
});
test("impacto = dependientes transitivos + asignaturas", () => {
  assert.deepEqual(impactOf(index, "algebra.vectors"), { dependents: 4, subjects: 1 });
  assert.deepEqual(impactOf(index, "stats.variance"), { dependents: 2, subjects: 0 });
});
test("capas por camino más largo", () => {
  const l = layers(index);
  assert.deepEqual(
    ["algebra.vectors", "algebra.matrices", "algebra.eigen", "calculus.functions", "calculus.derivative", "calculus.chain_rule", "stats.variance", "stats.covariance", "data.pca", "data.gradient_descent"].map((id) => l.get(id)),
    [0, 1, 2, 0, 1, 2, 0, 2, 3, 3],
  );
});
test("bases externas de una asignatura ordenadas por dependientes", () => {
  const b = externalBases(index, "prepro");
  assert.deepEqual(b.map((x) => x.conceptId), ["algebra.matrices", "algebra.eigen", "calculus.chain_rule"]);
  assert.deepEqual(b[0].dependents.sort(), ["data.pca", "stats.covariance"]);
});
test("feedsInto: a qué asignaturas alimenta", () => {
  const f = feedsInto(index, "algebra");
  assert.deepEqual(f.map((x) => x.subjectId), ["prepro"]);
  assert.deepEqual(f[0].concepts.sort(), ["data.pca", "stats.covariance"]);
});
// Añadido a los del plan: un ciclo en `requires` no debe colgar el cálculo de capas.
test("layers lanza si hay un ciclo de requisitos", () => {
  const cyclic = structuredClone(fixtureFiles);
  cyclic[0].relations.push({ source: "algebra.vectors", target: "algebra.eigen", type: "requires", reason: "x" });
  assert.throws(() => layers(new CatalogIndex(buildCatalog(fixtureSubjects, cyclic))), /ciclo/);
});
