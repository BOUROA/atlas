import { test } from "node:test";
import assert from "node:assert/strict";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { replayConcept, deriveProgress, progressOf } from "../src/domain/tutor/mastery";
import type { StudyEvent } from "../src/domain/types";
import { dayKey, daysBetween } from "../src/domain/time";

const sch = createScheduler(0.9);
let n = 0;
const ev = (day: string, hour: number, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `e${n++}`, at: new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).toISOString(),
  conceptId: "x", kind, source: "session", ...(kind === "review" ? { attempted: true, questionKind: "recall" as const } : {}), ...extra,
});
const now = new Date("2026-10-01T12:00:00");

test("sin eventos → nivel 0", () => {
  const p = replayConcept("x", [], sch, now);
  assert.equal(p.level, 0);
  assert.equal(p.card, null);
  assert.equal(p.retrievability, null);
});
test("visto → nivel 1 sin tarjeta", () => {
  const p = replayConcept("x", [ev("2026-09-01", 10, "seen")], sch, now);
  assert.equal(p.level, 1);
  assert.equal(p.card, null);
});
test("acertar el mismo día no llega a nivel 2", () => {
  const p = replayConcept("x", [ev("2026-09-01", 10, "seen"), ev("2026-09-01", 18, "review", { grade: 3 })], sch, now);
  assert.equal(p.level, 1);
  assert.ok(p.card);
});
test("acertar otro día → nivel 2 con subida registrada", () => {
  const p = replayConcept("x", [ev("2026-09-01", 10, "seen"), ev("2026-09-02", 10, "review", { grade: 3 })], sch, now);
  assert.equal(p.level, 2);
  assert.equal(p.levelUps.length, 1);
  assert.equal(p.levelUps[0].level, 2);
});
test("Difícil (2) no cuenta como acierto para subir", () => {
  const p = replayConcept("x", [ev("2026-09-01", 10, "seen"), ev("2026-09-02", 10, "review", { grade: 2 })], sch, now);
  assert.equal(p.level, 1);
});
test("declarado → nivel 2 declarado, confirmado por un acierto posterior", () => {
  let p = replayConcept("x", [ev("2026-09-01", 10, "declared")], sch, now);
  assert.equal(p.level, 2);
  assert.equal(p.declared, true);
  assert.ok(p.card && p.due);
  p = replayConcept("x", [ev("2026-09-01", 10, "declared"), ev("2026-09-04", 10, "review", { grade: 3 })], sch, now);
  assert.equal(p.level, 2);
  assert.equal(p.declared, false);
});
test("fallo baja un nivel y hay que recuperarlo otro día", () => {
  const base = [ev("2026-09-01", 10, "seen"), ev("2026-09-02", 10, "review", { grade: 3 }), ev("2026-09-05", 10, "review", { grade: 1 })];
  assert.equal(replayConcept("x", base, sch, now).level, 1);
  assert.equal(replayConcept("x", base, sch, now).lapses, 1);
  assert.equal(replayConcept("x", [...base, ev("2026-09-05", 18, "review", { grade: 3 })], sch, now).level, 1);
  assert.equal(replayConcept("x", [...base, ev("2026-09-06", 10, "review", { grade: 3 })], sch, now).level, 2);
});
test("nivel 3: práctica acertada + acierto con intervalo ≥ 7 días", () => {
  const evs = [
    ev("2026-09-01", 10, "seen"),
    ev("2026-09-02", 10, "review", { grade: 3 }),
    ev("2026-09-04", 10, "review", { grade: 3, questionKind: "exercise" }),
  ];
  assert.equal(replayConcept("x", evs, sch, now).level, 2);
  const p = replayConcept("x", [...evs, ev("2026-09-12", 10, "review", { grade: 3 })], sch, now);
  assert.equal(p.level, 3);
  assert.equal(p.practicePassed, true);
  assert.deepEqual(p.levelUps.map((u) => u.level), [2, 3]);
});
test("mostrar la respuesta sin intentarlo no sube de nivel", () => {
  const p = replayConcept("x", [ev("2026-09-01", 10, "seen"), ev("2026-09-02", 10, "review", { grade: 4, attempted: false })], sch, now);
  assert.equal(p.level, 1);
  assert.ok(p.card);
});
test("la frescura cae con el tiempo", () => {
  const evs = [ev("2026-09-01", 10, "seen"), ev("2026-09-02", 10, "review", { grade: 3 })];
  const soon = replayConcept("x", evs, sch, new Date("2026-09-03T10:00:00")).retrievability!;
  const late = replayConcept("x", evs, sch, new Date("2026-09-30T10:00:00")).retrievability!;
  assert.ok(soon > late);
  assert.ok(soon <= 1 && late >= 0);
});
test("implícito actualiza la tarjeta pero no el nivel", () => {
  const evs = [ev("2026-09-01", 10, "seen"), ev("2026-09-02", 10, "implicit", { grade: 3 })];
  const p = replayConcept("x", evs, sch, now);
  assert.equal(p.level, 1);
  assert.ok(p.card);
});
test("deriveProgress agrupa por concepto y ordena por fecha", () => {
  const a = { ...ev("2026-09-02", 10, "review", { grade: 3 }), conceptId: "a" };
  const b = { ...ev("2026-09-01", 10, "seen"), conceptId: "a" };
  const m = deriveProgress([a, b], sch, now);
  assert.equal(m.get("a")?.level, 2);
  assert.equal(progressOf(m, "zzz").level, 0);
});

// Casos límite no cubiertos por el plan (decisiones documentadas en mastery.ts).
test("declarado programa la comprobación a 3 días", () => {
  const p = replayConcept("x", [ev("2026-09-01", 10, "declared")], sch, now);
  assert.equal(daysBetween("2026-09-01", dayKey(p.due!)), 3);
});
test("mostrar la respuesta sin intentarlo no baja de nivel ni cuenta como fallo", () => {
  const p = replayConcept("x", [
    ev("2026-09-01", 10, "seen"),
    ev("2026-09-02", 10, "review", { grade: 3 }),
    ev("2026-09-03", 10, "review", { grade: 4, attempted: false }),
  ], sch, now);
  assert.equal(p.level, 2);
  assert.equal(p.lapses, 0);
  assert.equal(p.reviews, 2);
});
test("un implícito sin eventos previos no hace visto el concepto", () => {
  const p = replayConcept("x", [ev("2026-09-01", 10, "implicit", { grade: 3 })], sch, now);
  assert.equal(p.level, 0);
  assert.equal(p.firstAt, null);
  assert.ok(p.card);
});
