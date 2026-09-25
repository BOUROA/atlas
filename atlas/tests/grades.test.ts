import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeSummary } from "../src/domain/grades";
import type { Assessment } from "../src/domain/types";

const a = (id: string, weight: number, grade?: number): Assessment => ({ id, title: id, kind: "parcial", weight, grade, unitIds: [] });

test("sin evaluaciones", () => {
  const s = gradeSummary([], 10);
  assert.equal(s.status, "empty");
});
test("parcial 30 % con un 9: el 10 ya no es posible", () => {
  const s = gradeSummary([a("p1", 30, 9), a("final", 70)], 10);
  assert.equal(s.weighted, 2.7);
  assert.equal(s.gradedWeight, 30);
  assert.equal(s.remainingWeight, 70);
  assert.equal(s.currentAverage, 9);
  assert.equal(s.maxPossible, 9.7);
  assert.equal(s.status, "impossible");
  assert.equal(s.needed, null);
});
test("objetivo 9,5: necesitas 9,71 en el final", () => {
  const s = gradeSummary([a("p1", 30, 9), a("final", 70)], 9.5);
  assert.equal(s.status, "possible");
  assert.equal(s.needed, 9.71);
});
test("objetivo ya asegurado", () => {
  const s = gradeSummary([a("p1", 80, 10), a("final", 20)], 8);
  assert.equal(s.status, "secured");
  assert.equal(s.needed, 0);
});
test("todo evaluado", () => {
  const s = gradeSummary([a("p1", 40, 8), a("p2", 60, 9)], 10);
  assert.equal(s.status, "done");
  assert.equal(s.final, 8.6);
});
test("avisa si los pesos no suman 100", () => {
  assert.equal(gradeSummary([a("p1", 30, 9), a("p2", 50)], 10).weightWarning, true);
  assert.equal(gradeSummary([a("p1", 30, 9), a("p2", 70)], 10).weightWarning, false);
});
