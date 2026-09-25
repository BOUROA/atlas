import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { layoutMap } from "../src/domain/map-layout";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const L = layoutMap(index);
const node = (id: string) => L.nodes.find((n) => n.id === id)!;

test("un nodo por concepto y un carril por asignatura en orden", () => {
  assert.equal(L.nodes.length, 10);
  assert.deepEqual(L.lanes.map((l) => l.subjectId), ["algebra", "calculo", "prepro"]);
});
test("carriles sin solaparse y nodos dentro de su carril", () => {
  for (let i = 1; i < L.lanes.length; i++) assert.ok(L.lanes[i].y >= L.lanes[i - 1].y + L.lanes[i - 1].height);
  for (const n of L.nodes) {
    const lane = L.lanes.find((l) => l.subjectId === n.subjectId)!;
    assert.ok(n.y > lane.y && n.y < lane.y + lane.height, n.id);
  }
});
test("todas las flechas de requisito van de izquierda a derecha", () => {
  for (const e of L.edges.filter((e) => e.type === "requires")) assert.ok(node(e.from).x < node(e.to).x, `${e.from}→${e.to}`);
});
test("x crece con la capa y no hay nodos superpuestos", () => {
  assert.ok(node("algebra.vectors").x < node("algebra.matrices").x);
  assert.equal(node("stats.covariance").layer, 2);
  const pos = new Set(L.nodes.map((n) => `${n.x},${n.y}`));
  assert.equal(pos.size, L.nodes.length);
});
test("determinista", () => {
  assert.deepEqual(JSON.stringify(layoutMap(index)), JSON.stringify(L));
});
test("dimensiones totales contienen todo", () => {
  for (const n of L.nodes) assert.ok(n.x < L.width && n.y < L.height);
});
