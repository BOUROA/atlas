import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));

test("buildCatalog resuelve asignatura de temas y conceptos", () => {
  assert.equal(index.conceptById.get("data.pca")?.subjectId, "prepro");
  assert.equal(index.unitById.get("calculo.t2")?.subjectId, "calculo");
  assert.equal(index.catalog.concepts.length, 10);
});
test("asignaturas ordenadas por order", () => {
  assert.deepEqual(index.subjects.map((s) => s.id), ["algebra", "calculo", "prepro"]);
});
test("requisitos y dependientes directos", () => {
  assert.deepEqual(index.requiresOf.get("data.pca")?.slice().sort(), ["algebra.eigen", "stats.covariance"]);
  assert.deepEqual(index.requiredBy.get("algebra.matrices")?.slice().sort(), ["algebra.eigen", "stats.covariance"]);
  assert.deepEqual(index.requiresOf.get("algebra.vectors") ?? [], []);
  assert.deepEqual(index.relatedOf.get("data.gradient_descent"), ["data.pca"]);
});
test("conceptos por tema en orden y por asignatura en orden de temario", () => {
  assert.deepEqual(index.conceptsByUnit.get("calculo.t2")?.map((c) => c.id), ["calculus.derivative", "calculus.chain_rule"]);
  assert.deepEqual(index.conceptsOfSubject("algebra").map((c) => c.id), ["algebra.vectors", "algebra.matrices", "algebra.eigen"]);
});
test("asignaturas de un concepto: propietaria + alsoIn", () => {
  assert.deepEqual(index.subjectsOfConcept("algebra.matrices"), ["algebra", "calculo"]);
  assert.equal(index.reason("data.pca", "requires", "algebra.eigen"), "base");
});
test("buildCatalog rechaza relaciones con extremos desconocidos", () => {
  const bad = structuredClone(fixtureFiles);
  bad[0].relations.push({ source: "algebra.vectors", target: "nope", type: "requires", reason: "x" });
  assert.throws(() => buildCatalog(fixtureSubjects, bad), /nope/);
});
// Añadidos a los del plan: validaciones de buildCatalog sin cubrir y motivo simétrico de `related`.
test("buildCatalog rechaza conceptos en temas de otra asignatura y ids duplicados", () => {
  const foreignUnit = structuredClone(fixtureFiles);
  foreignUnit[0].concepts[0].unitId = "calculo.t1";
  assert.throws(() => buildCatalog(fixtureSubjects, foreignUnit), /algebra\.vectors/);
  const duplicated = structuredClone(fixtureFiles);
  duplicated[1].concepts.push({ ...duplicated[0].concepts[0], unitId: "calculo.t1" });
  assert.throws(() => buildCatalog(fixtureSubjects, duplicated), /duplicado "algebra\.vectors"/);
});
test("reason de related se encuentra en ambos sentidos", () => {
  assert.equal(index.reason("data.gradient_descent", "related", "data.pca"), "se confunden");
  assert.equal(index.reason("algebra.eigen", "requires", "data.pca"), undefined);
});
