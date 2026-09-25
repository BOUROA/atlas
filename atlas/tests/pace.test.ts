import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { pace10 } from "../src/domain/pace";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type StudyEvent } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
const sch = createScheduler(0.9);
let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `p${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});
const level2 = (conceptId: string, day: string) => [ev(conceptId, day, "seen"), ev(conceptId, day.replace(/\d\d$/, (d) => String(Number(d) + 1).padStart(2, "0")), "review")];

test("pace10: sin evaluación con fecha, objetivo por defecto 08-02-2027 y el curso empieza el 21-oct (ajustes)", () => {
  const s = emptyUserState("2026-09-01T00:00:00.000Z");
  const now = new Date("2026-10-21T00:00:00");   // justo el inicio de curso por defecto
  const p = pace10(index, s, deriveProgress([], sch, now), "algebra", now);
  assert.equal(p.expected, 0);
  assert.equal(p.actual, 0);
  assert.equal(p.daysAhead, 0);
});

test("pace10: expected crece linealmente y está acotado a [0, 1]", () => {
  const s = emptyUserState("2026-09-01T00:00:00.000Z");
  // total = 21-oct-2026 → 29-ene-2027 (08-02-2027 − 10 días)
  const now = new Date("2027-06-01T00:00:00");   // muy por delante del objetivo
  const p = pace10(index, s, deriveProgress([], sch, now), "algebra", now);
  assert.equal(p.expected, 1);
});

test("pace10: actual = proporción de conceptos de la asignatura a nivel ≥ 2, objetivo = evaluación − 10 días", () => {
  const empty = emptyUserState("2026-09-01T00:00:00.000Z");
  const s = { ...empty, settings: { ...empty.settings, courseStart: "2026-09-14" },
    subjects: { algebra: { currentUnit: 2, updatedAt: "", assessments: [
      { id: "p1", title: "Parcial 1", kind: "parcial" as const, date: "2026-11-13", weight: 100, unitIds: [] },
    ] } } };
  // objetivo = 2026-11-13 − 10 días = 2026-11-03; total = 14-sep..03-nov = 50 días
  const now = new Date("2026-10-09T00:00:00");   // 25 días desde el inicio → mitad del tramo
  const evs = [...level2("algebra.vectors", "2026-09-01")];   // 1 de 3 conceptos de álgebra
  const p = pace10(index, s, deriveProgress(evs, sch, now), "algebra", now);
  assert.equal(p.actual, 1 / 3);
  assert.equal(p.expected, 0.5);   // 25 de 50 días del tramo (14-sep → 03-nov)
  assert.equal(p.daysAhead, Math.round((1 / 3 - 0.5) * 50));
  assert.ok(p.daysAhead < 0);   // va por detrás del ritmo lineal
});

test("pace10: por delante del ritmo da días positivos", () => {
  const empty = emptyUserState("2026-09-01T00:00:00.000Z");
  const s = { ...empty, settings: { ...empty.settings, courseStart: "2026-09-14" },
    subjects: { algebra: { currentUnit: 2, updatedAt: "", assessments: [
      { id: "p1", title: "Parcial 1", kind: "parcial" as const, date: "2026-11-13", weight: 100, unitIds: [] },
    ] } } };
  const now = new Date("2026-09-15T00:00:00");   // 1 día desde el inicio: expected muy bajo
  const evs = [...level2("algebra.vectors", "2026-09-01"), ...level2("algebra.matrices", "2026-09-01"), ...level2("algebra.eigen", "2026-09-01")];
  const p = pace10(index, s, deriveProgress(evs, sch, now), "algebra", now);
  assert.equal(p.actual, 1);
  assert.ok(p.daysAhead > 0);
});
