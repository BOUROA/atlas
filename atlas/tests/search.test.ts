import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { normalize, searchConcepts } from "../src/domain/search";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));

test("normalize quita acentos y mayúsculas", () => {
  assert.equal(normalize("Análisis  ÁRBOL"), "analisis arbol");
});
test("busca por nombre sin acentos", () => {
  assert.equal(searchConcepts(index, "regla cadena")[0], "calculus.chain_rule");
  assert.equal(searchConcepts(index, "autovalo")[0], "algebra.eigen");
});
test("busca por alias", () => {
  assert.equal(searchConcepts(index, "componentes principales")[0], "data.pca");
  assert.equal(searchConcepts(index, "valores propios")[0], "algebra.eigen");
});
test("el prefijo del nombre gana a la subcadena", () => {
  const r = searchConcepts(index, "var");
  assert.equal(r[0], "stats.variance");
  assert.ok(r.includes("stats.covariance"));
  assert.ok(r.indexOf("stats.variance") < r.indexOf("stats.covariance"));
});
test("consulta vacía o sin resultados", () => {
  assert.deepEqual(searchConcepts(index, "   "), []);
  assert.deepEqual(searchConcepts(index, "zzzz"), []);
});
