import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { weeklyDistribution } from "../src/domain/game/weekly";
import { totalXp } from "../src/domain/game/xp";
import { rankOf } from "../src/domain/game/levels";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type StudyEvent } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
let n = 0;
const ev = (conceptId: string, day: string, extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `w${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind: "review", grade: 3, attempted: true, questionKind: "recall", source: "session", ...extra,
});

test("reparto semanal en minutos por asignatura y la más descuidada", () => {
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events: [
    ev("calculus.derivative", "2026-09-22", { ms: 600000 }),
    ev("calculus.functions", "2026-09-23"),                    // sin ms → 1,5 min
    ev("algebra.matrices", "2026-09-23", { ms: 120000 }),
    ev("stats.variance", "2026-09-14", { ms: 999999 }),        // semana anterior
  ] };
  const d = weeklyDistribution(index, s, new Date("2026-09-24T12:00:00"));
  assert.deepEqual(d.bySubject.map((x) => [x.subjectId, x.minutes]), [["calculo", 11.5], ["algebra", 2], ["prepro", 0]]);
  assert.equal(d.totalMinutes, 13.5);
  assert.equal(d.neglected, "prepro");
});
test("cofre semanal: +300 XP al cumplir los tres objetivos", () => {
  const sch = createScheduler(0.9);
  const days = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"];
  const events: StudyEvent[] = [];
  days.forEach((d, i) => { for (let k = 0; k < 30; k++) events.push(ev(`c${i}_${k}`, d, { grade: 1 })); });
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events };
  const xp = totalXp(s, deriveProgress(events, sch, new Date("2026-09-26T10:00:00")));
  // 150 repasos × 4 + 5 días × 50 (objetivo diario) + 300 cofre
  assert.equal(xp.total, 150 * 4 + 5 * 50 + 300);
});
test("rangos astronómicos", () => {
  assert.equal(rankOf(1), "Polvo estelar");
  assert.equal(rankOf(7), "Nebulosa");
  assert.equal(rankOf(11), "Protoestrella");
  assert.equal(rankOf(60), "Supernova");
});
