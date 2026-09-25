import { test } from "node:test";
import assert from "node:assert/strict";
import { xpToNext, levelFromXp } from "../src/domain/game/levels";
import { totalXp } from "../src/domain/game/xp";
import { streakInfo } from "../src/domain/game/streak";
import { weeklyGoals } from "../src/domain/game/goals";
import { evaluateAchievements, ACHIEVEMENTS } from "../src/domain/game/achievements";
import { buildCatalog, CatalogIndex } from "../src/domain/catalog";
import { createScheduler } from "../src/domain/tutor/scheduler";
import { deriveProgress } from "../src/domain/tutor/mastery";
import { emptyUserState, type Expedition, type ExpeditionAttempt, type Legend, type Profile, type StudyEvent } from "../src/domain/types";
import { fixtureFiles, fixtureSubjects } from "./fixtures/catalog";

let n = 0;
const ev = (conceptId: string, day: string, kind: StudyEvent["kind"], extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `g${n++}`, at: new Date(`${day}T10:00:00`).toISOString(), conceptId, kind, source: "session",
  ...(kind === "review" ? { attempted: true, questionKind: "recall" as const, grade: 3 as const } : {}), ...extra,
});

test("curva de niveles", () => {
  assert.equal(xpToNext(1), 120);
  assert.equal(xpToNext(2), 364);
  assert.deepEqual(levelFromXp(0), { level: 1, into: 0, needed: 120 });
  assert.equal(levelFromXp(119).level, 1);
  assert.equal(levelFromXp(120).level, 2);
  assert.equal(levelFromXp(483).level, 2);
  assert.deepEqual(levelFromXp(484), { level: 3, into: 0, needed: xpToNext(3) });
});

test("XP por eventos, subidas, sesiones, objetivo diario y logros", () => {
  const sch = createScheduler(0.9);
  const events = [
    ev("a", "2026-09-01", "seen"),                                   // 5
    ev("a", "2026-09-02", "review"),                                 // 10 + 25 (sube a 2)
    ev("b", "2026-09-02", "review", { grade: 1 }),                   // 4
    ev("c", "2026-09-02", "review", { attempted: false, grade: 4 }), // 0
    ev("d", "2026-09-02", "implicit", { grade: 3 }),                 // 0
  ];
  const progress = deriveProgress(events, sch, new Date("2026-09-03T10:00:00"));
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events,
    sessions: [{ id: "s1", startedAt: events[1].at, endedAt: events[1].at, reviews: 3, newConcepts: 0, completed: true }],
    achievements: { "primer-paso": events[0].at } };
  const xp = totalXp(s, progress);
  assert.equal(xp.total, 5 + 10 + 25 + 4 + 30 + 100);
  assert.equal(xp.byDay["2026-09-02"], 10 + 25 + 4 + 30);
});

test("objetivo diario: 20 repasos en un día dan +50", () => {
  const sch = createScheduler(0.9);
  const events = Array.from({ length: 20 }, (_, i) => ev(`k${i}`, "2026-09-05", "review", { grade: 1 }));
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events };
  assert.equal(totalXp(s, deriveProgress(events, sch, new Date("2026-09-06T10:00:00"))).total, 20 * 4 + 50);
});

test("racha con comodín semanal", () => {
  // lun 21, mar 22, (mié 23 sin actividad), jue 24, vie 25 = hoy
  const active = new Set(["2026-09-21", "2026-09-22", "2026-09-24", "2026-09-25"]);
  assert.deepEqual(streakInfo(active, new Date("2026-09-25T20:00:00")), { current: 4, freezesUsed: 1, activeToday: true });
  // dos huecos en la misma semana rompen la racha
  const broken = new Set(["2026-09-21", "2026-09-24", "2026-09-25"]);
  assert.equal(streakInfo(broken, new Date("2026-09-25T20:00:00")).current, 2);
  // hoy aún sin actividad no rompe la racha de ayer
  assert.deepEqual(streakInfo(new Set(["2026-09-24"]), new Date("2026-09-25T09:00:00")), { current: 1, freezesUsed: 0, activeToday: false });
});

test("objetivos semanales de la semana ISO actual", () => {
  const events = [
    ...Array.from({ length: 12 }, (_, i) => ev(`r${i}`, "2026-09-22", "review")),
    ev("x", "2026-09-23", "seen"),
    ...Array.from({ length: 3 }, (_, i) => ev(`old${i}`, "2026-09-18", "review")),
  ];
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events };
  const g = weeklyGoals(s, new Date("2026-09-24T12:00:00"));
  assert.deepEqual(g.map((x) => [x.id, x.value, x.target]), [["dias", 1, 5], ["repasos", 12, 150], ["nuevos", 13, 25]]);
});

test("logros: primer paso, tema completo y puente", () => {
  const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
  const sch = createScheduler(0.9);
  const evs = ["calculus.functions"].flatMap((id) => [ev(id, "2026-09-01", "seen"), ev(id, "2026-09-02", "review")]);
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events: evs };
  const unlocked = evaluateAchievements({ index, state: s, progress: deriveProgress(evs, sch, new Date("2026-09-03T10:00:00")) });
  assert.ok(unlocked.includes("primer-paso"));
  assert.ok(unlocked.includes("tema-completo"));      // calculo.t1 solo tiene Funciones
  assert.ok(!unlocked.includes("puente"));
  assert.ok(ACHIEVEMENTS.length >= 25);
  assert.ok(ACHIEVEMENTS.every((a) => a.id && a.title && a.description && a.xp >= 100));
});

const mission = (id: string, university: string, course: string, concepts: string[]): Expedition => ({
  id, university, course, courseName: course, term: "2025-S1", title: "Examen", kind: "final", durationMin: 90,
  url: "https://example.org/e.pdf", solutionsUrl: "https://example.org/s.pdf", license: "CC-BY-SA",
  subjects: [], level: "grado", whyThisOne: "", problems: [{ n: "1", topic: "t", concepts }],
});
test("logros de misiones: primera, superada, cinco y tres universidades", () => {
  const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
  const missions: Expedition[] = [
    mission("m.alfa", "Universidad Alfa", "Cálculo I", ["calculus.functions"]),
    mission("m.beta", "Universidad Beta", "Álgebra I", ["algebra.vectors"]),
    mission("m.gamma", "Universidad Gamma", "Preprocesamiento", ["stats.variance"]),
  ];
  const att = (id: string, day: string, score: 0 | 0.5 | 1): ExpeditionAttempt =>
    ({ id, startedAt: `${day}T10:00:00.000Z`, endedAt: `${day}T10:30:00.000Z`, scores: { "1": score } });
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), expeditions: {
    "m.alfa": [att("a1", "2026-09-01", 1), att("a2", "2026-09-02", 0.5)],
    "m.beta": [att("a3", "2026-09-03", 0.5)],
    "m.gamma": [att("a4", "2026-09-04", 0)],
  } };
  const progress = deriveProgress([], createScheduler(0.9), new Date("2026-09-05T10:00:00"));
  const unlocked = evaluateAchievements({ index, state: s, progress, expeditions: missions });
  assert.ok(unlocked.includes("primera-mision"));
  assert.ok(unlocked.includes("mision-superada"));    // a1: nota 10
  assert.ok(!unlocked.includes("cinco-misiones"));    // solo 4 intentos completados
  assert.ok(unlocked.includes("tres-universidades")); // Alfa, Beta, Gamma

  // Sin pasar `expeditions`, ninguno de los 4 se desbloquea aunque el estado los tenga.
  const withoutCatalog = evaluateAchievements({ index, state: s, progress });
  assert.ok(!["primera-mision", "mision-superada", "cinco-misiones", "tres-universidades"].some((id) => withoutCatalog.includes(id)));
});

test("logros de estrellas guía: primera, cinco y firmamento completo", () => {
  const index = new CatalogIndex(buildCatalog(fixtureSubjects, fixtureFiles));
  const sch = createScheduler(0.9);
  const legend: Legend = {
    id: "leg1", name: "Ada Lovelace", years: "1815–1852", origin: "Reino Unido", tagline: "",
    story: "", milestones: [], route: ["algebra.vectors", "algebra.matrices", "algebra.eigen"],
    studyLesson: { title: "", text: "", atlasFeature: "mapa" }, sources: [],
  };
  const profile: Profile = {
    id: "prof1", name: "Grace Hopper", origin: "EE. UU.", field: "Computación", tagline: "",
    story: "", path: [], stamps: [], territory: ["calculus.functions", "calculus.derivative"],
    studyLesson: { title: "", text: "" }, sources: [],
  };
  const level2 = (id: string) => [ev(id, "2026-09-01", "seen"), ev(id, "2026-09-02", "review")];

  // Solo la leyenda completa (perfil sin ningún evento).
  const evs = [...level2("algebra.vectors"), ...level2("algebra.matrices"), ...level2("algebra.eigen")];
  const progress = deriveProgress(evs, sch, new Date("2026-09-03T10:00:00"));
  const s = { ...emptyUserState("2026-09-01T00:00:00.000Z"), events: evs };
  const unlocked = evaluateAchievements({ index, state: s, progress, guides: [legend, profile] });
  assert.ok(unlocked.includes("primera-guia"));
  assert.ok(!unlocked.includes("cinco-guias"));       // solo 2 guías en total
  assert.ok(!unlocked.includes("todas-las-guias"));   // el perfil no está completo

  // Ambas completas.
  const evs2 = [...evs, ...level2("calculus.functions"), ...level2("calculus.derivative")];
  const progress2 = deriveProgress(evs2, sch, new Date("2026-09-03T10:00:00"));
  const both = evaluateAchievements({ index, state: { ...s, events: evs2 }, progress: progress2, guides: [legend, profile] });
  assert.ok(both.includes("todas-las-guias"));

  // Sin pasar `guides`, no se desbloquean aunque el progreso las cumpla.
  const withoutGuides = evaluateAchievements({ index, state: { ...s, events: evs2 }, progress: progress2 });
  assert.ok(!withoutGuides.includes("primera-guia"));
});
