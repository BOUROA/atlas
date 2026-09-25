// Misión del día (spec 2026-09-25-mision-del-dia-camino §3): un plan cerrado
// de 3–5 misiones calculado con el estado al empezar el día (se guarda como
// instantánea y ya no cambia) y su progreso, con los eventos de ese día.
// Puro y determinista: `now` llega siempre como parámetro.
import type { CatalogIndex } from "./catalog";
import { reinforceHits } from "./expeditions";
import { pace10 } from "./pace";
import { buildRoutes, DEFAULT_FINAL_DAY } from "./route";
import { addDays, createDayKeyer, dayKey, daysBetween, startOfDay } from "./time";
import { trialReadiness, trialReinforceHits, trialResult } from "./trials";
import { buildQueue, ITEM_MINUTES, upcomingAssessments, type QueueItemType } from "./tutor/queue";
import { deriveProgress, progressOf, type ConceptProgress } from "./tutor/mastery";
import type { Scheduler } from "./tutor/scheduler";
import { subjectStateOf, type DayMission, type DayPlan, type Expedition, type StudyEvent, type Trial, type TrialKind, type UserState } from "./types";

export type { DayMission, DayMissionKind, DayPlan } from "./types";

/** Asignaturas en foco: 2, o 3 con un presupuesto de 180 minutos o más. */
const FOCUS_BASE = 2;
const FOCUS_LONG = 3;
const LONG_DAY_MINUTES = 180;
/** Tope de días de la rotación (y valor si la asignatura nunca se ha avanzado). */
const ROTATION_CAP = 14;
/** Días de retraso sobre el ritmo del 10 que valen un punto. */
const DELAY_DAYS_PER_POINT = 7;
/** Ventana (días) en la que la misión principal empieza a puntuar, y días por punto. */
const EXAM_WINDOW_DAYS = 21;
const EXAM_DAYS_PER_POINT = 3;
/** Tamaño de un Avance: como mucho 6 conceptos; al recortar, como mínimo 2 (o todos, si son menos). */
const ADVANCE_MAX = 6;
const ADVANCE_MIN = 2;
/** Conceptos como mucho en el Refuerzo. */
const REINFORCE_MAX = 8;
/** Parte del presupuesto que puede ocupar el Calentamiento (el resto de repasos sigue en la cola). */
const REVIEW_SHARE = 0.6;
/** Misiones del plan: se completan hasta 3 con Avances extra (si caben) y nunca pasan de 5. */
const MIN_MISSIONS = 3;
const MAX_MISSIONS = 5;
/** Minutos de corrección que se suman a la duración de una prueba. */
const TRIAL_GRADING_MINUTES = 15;
/** Preferencia por tipo de prueba: el control antes que los simulacros. */
const TRIAL_KIND_ORDER: Record<TrialKind, number> = { control: 0, parcial: 1, final: 2 };
const EPS = 1e-9;

export type PlanInput = {
  index: CatalogIndex;
  state: UserState;
  scheduler: Scheduler;
  /** Pruebas conocidas (Demuestra y refuerzo tras sus fallos). */
  trials: readonly Trial[];
  /** Misiones (expediciones) conocidas (refuerzo tras sus fallos). */
  expeditions: readonly Expedition[];
  now: Date;
};

export type MissionStatus = {
  id: string;
  /** Repasos hechos (acotado al objetivo), conceptos hechos o intentos terminados (0/1). */
  count: number;
  target: number;
  done: boolean;
};

/** Asignaturas en foco según el presupuesto diario. */
const focusCount = (dailyMinutes: number): number => (dailyMinutes >= LONG_DAY_MINUTES ? FOCUS_LONG : FOCUS_BASE);

/** Último instante (23:59:59 local) del día de `d`. */
const endOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

/**
 * El estado tal como estaba en `start`: eventos anteriores y solo los intentos
 * de prueba y de misión ya terminados antes (uno abierto o terminado después no
 * existía todavía como resultado).
 */
function stateBefore(state: UserState, start: Date): UserState {
  const t = start.getTime();
  const endedBefore = (iso: string | undefined) => iso !== undefined && Date.parse(iso) < t;
  const filterAttempts = <A extends { endedAt?: string }>(all: Record<string, A[]> | undefined) => {
    if (!all) return undefined;
    const out: Record<string, A[]> = {};
    for (const [id, list] of Object.entries(all)) out[id] = list.filter((a) => endedBefore(a.endedAt));
    return out;
  };
  const trials = filterAttempts(state.trials);
  const expeditions = filterAttempts(state.expeditions);
  return {
    ...state,
    events: state.events.filter((e) => Date.parse(e.at) < t),
    ...(trials ? { trials } : {}),
    ...(expeditions ? { expeditions } : {}),
  };
}

/** Día ("YYYY-MM-DD") del último evento `seen` de cada asignatura (la propietaria del concepto). */
function lastSeenBySubject(index: CatalogIndex, events: readonly StudyEvent[]): Map<string, string> {
  const lastMs = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== "seen") continue;
    const subjectId = index.conceptById.get(e.conceptId)?.subjectId;
    if (!subjectId) continue;
    const t = Date.parse(e.at);
    const prev = lastMs.get(subjectId);
    if (prev === undefined || t > prev) lastMs.set(subjectId, t);
  }
  const out = new Map<string, string>();
  for (const [subjectId, t] of lastMs) out.set(subjectId, dayKey(new Date(t)));
  return out;
}

/**
 * Siguientes conceptos a nivel 0 de una asignatura, en orden de temario (del tema
 * actual y, si no llegan a 6, de los siguientes), después de `first` (arrastrados
 * de ayer). Un concepto entra si todos sus requisitos directos están a nivel ≥ 1
 * o van antes en esta misma lista; si no, se salta. Como mucho 6.
 */
function advanceWalk(index: CatalogIndex, subjectId: string, levelOf: (id: string) => number, first: readonly string[] = []): string[] {
  const out = first.slice(0, ADVANCE_MAX);
  const inList = new Set(out);
  for (const c of index.conceptsOfSubject(subjectId)) {
    if (out.length >= ADVANCE_MAX) break;
    if (inList.has(c.id) || levelOf(c.id) >= 1) continue;
    if ((index.requiresOf.get(c.id) ?? []).every((req) => inList.has(req) || levelOf(req) >= 1)) {
      out.push(c.id);
      inList.add(c.id);
    }
  }
  return out;
}

type RankInput = {
  index: CatalogIndex;
  state: UserState;
  progress: ReadonlyMap<string, ConceptProgress>;
  /** Instante en el que se puntúa (su día es "hoy"). */
  now: Date;
  lastSeen: ReadonlyMap<string, string>;
};

/**
 * Asignaturas candidatas (curso actual, con algún concepto a nivel 0 que ya se
 * pueda avanzar) de mayor a menor puntuación: rotación (días desde el último
 * `seen`, hasta 14) + retraso (días detrás del ritmo del 10 / 7) + examen
 * ((21 − días a su misión principal) / 3 si faltan ≤ 21). A igualdad, `order`.
 */
function rankSubjects({ index, state, progress, now, lastSeen }: RankInput): string[] {
  const today = dayKey(now);
  const levelOf = (id: string) => progressOf(progress, id).level;
  const upcoming = upcomingAssessments(index, state, now);
  const defaultFinalDays = daysBetween(today, DEFAULT_FINAL_DAY);

  /** Días hasta la misión principal más cercana (parcial o final con fecha, sin nota; o el final supuesto). */
  const mainMissionDays = (subjectId: string): number | undefined => {
    const main = upcoming.get(subjectId)?.find((u) => u.assessment.kind === "parcial" || u.assessment.kind === "final");
    if (main) return main.days;
    const hasFinal = subjectStateOf(state, subjectId).assessments.some((a) => a.kind === "final" && a.date);
    return !hasFinal && defaultFinalDays >= 0 ? defaultFinalDays : undefined;
  };

  const scored: { subjectId: string; score: number; order: number }[] = [];
  for (const s of index.subjects) {
    if (s.status !== "current") continue;
    if (advanceWalk(index, s.id, levelOf).length === 0) continue;
    const last = lastSeen.get(s.id);
    const rotation = last === undefined ? ROTATION_CAP : Math.max(0, Math.min(ROTATION_CAP, daysBetween(last, today)));
    const delay = Math.max(0, -pace10(index, state, progress, s.id, now).daysAhead) / DELAY_DAYS_PER_POINT;
    const days = mainMissionDays(s.id);
    const exam = days !== undefined && days <= EXAM_WINDOW_DAYS ? (EXAM_WINDOW_DAYS - days) / EXAM_DAYS_PER_POINT : 0;
    scored.push({ subjectId: s.id, score: rotation + delay + exam, order: s.order });
  }
  scored.sort((a, b) => (Math.abs(a.score - b.score) > EPS ? b.score - a.score : a.order - b.order));
  return scored.map((x) => x.subjectId);
}

/** Minutos estimados de un concepto según su estado (nuevo, primer recuerdo o repaso). */
function conceptMinutes(progress: ReadonlyMap<string, ConceptProgress>, conceptId: string): number {
  const p = progressOf(progress, conceptId);
  const type: QueueItemType = p.level === 0 ? "new" : p.level === 1 && !p.card ? "first" : "review";
  return ITEM_MINUTES[type];
}

/**
 * Conceptos con fallo reciente (`trialReinforceHits` y `reinforceHits`, últimos
 * 7 días) que aún no se han repasado bien (nota ≥ 2) después de ese fallo; solo
 * del catálogo, en orden de temario y como mucho 8.
 */
function reinforceConcepts(input: PlanInput, state: UserState): string[] {
  const { index, trials, expeditions, now } = input;
  const ids = new Set<string>();
  const fixedAfter = (conceptId: string, failedAt: string) =>
    state.events.some((e) => e.conceptId === conceptId && e.kind === "review" && e.attempted !== false && (e.grade ?? 0) >= 2 && e.at > failedAt);
  const add = (conceptId: string, attempt: { startedAt: string; endedAt?: string }) => {
    if (!fixedAfter(conceptId, attempt.endedAt ?? attempt.startedAt)) ids.add(conceptId);
  };
  if (trials.length > 0) for (const h of trialReinforceHits(trials, state, now)) add(h.conceptId, h.attempt);
  if (expeditions.length > 0) for (const h of reinforceHits(expeditions, state, now)) add(h.conceptId, h.attempt);
  const rank = (id: string) => index.syllabusRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...ids].filter((id) => index.conceptById.has(id)).sort((a, b) => rank(a) - rank(b)).slice(0, REINFORCE_MAX);
}

/** Pruebas cuyo paso es el siguiente del Rumbo de su asignatura (el primer paso pendiente, atrasado o no). */
function rumboNextTrials(input: PlanInput, state: UserState, progress: ReadonlyMap<string, ConceptProgress>): Set<string> {
  const out = new Set<string>();
  for (const route of buildRoutes({ index: input.index, state, progress, trials: input.trials, now: input.now })) {
    const step = route.steps.find((s) => s.kind !== "exam" && (s.status === "late" || s.status === "next"));
    if (step?.trialId) out.add(step.trialId);
  }
  return out;
}

/**
 * Conceptos del Avance de ayer que quedaron sin hacer y siguen a nivel 0, por
 * asignatura. Solo desde ayer: un plan más antiguo no se arrastra.
 */
function carriedFromYesterday(input: PlanInput, state: UserState, start: Date, levelOf: (id: string) => number): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const yesterday = state.dayPlans?.[dayKey(addDays(start, -1))];
  if (!yesterday) return out;
  const statuses = missionStatuses(yesterday, state);
  yesterday.missions.forEach((m, i) => {
    if (m.kind !== "advance" || !m.subjectId || statuses[i].done) return;
    const left = m.conceptIds.filter((id) => input.index.conceptById.get(id)?.subjectId === m.subjectId && levelOf(id) === 0);
    if (left.length > 0) out.set(m.subjectId, [...(out.get(m.subjectId) ?? []), ...left]);
  });
  return out;
}

/**
 * Plan del día de `now` (spec §3), calculado solo con lo anterior a las 00:00
 * locales de ese día; el progreso y la cola de repasos, al final del día
 * (23:59:59), para que cuente todo lo que vence durante el día. En orden:
 * Calentamiento, Refuerzo, un Avance por asignatura en foco (con lo arrastrado de
 * ayer primero) y, al final, un Demuestra si cabe. Entre 3 y 5 misiones cuando
 * el presupuesto lo permite (los Avances extra solo entran si caben).
 */
export function composeDayPlan(input: PlanInput): DayPlan {
  const { index, scheduler, now } = input;
  const day = dayKey(now);
  const start = startOfDay(now);
  const end = endOfDay(now);
  const state = stateBefore(input.state, start);
  const progress = deriveProgress(state.events, scheduler, end);
  const levelOf = (id: string) => progressOf(progress, id).level;
  const budget = state.settings.dailyMinutes;
  const missions: DayMission[] = [];
  let used = 0;

  // 1. Calentamiento: los repasos y primeros recuerdos pendientes del día, en el
  //    orden de prioridad de la cola y como mucho el 60 % del presupuesto (el
  //    resto sigue en la cola para estudio libre; así siempre queda sitio para avanzar).
  const queue = buildQueue({ index, state, progress, scheduler, now: end, reviewsOnly: true });
  const reviewCap = budget * REVIEW_SHARE;
  const reviews: typeof queue.items = [];
  let reviewMinutes = 0;
  for (const item of queue.items) {
    if (item.type === "new") continue;
    if (reviews.length > 0 && reviewMinutes + item.minutes > reviewCap + EPS) break;
    reviews.push(item);
    reviewMinutes += item.minutes;
  }
  if (reviews.length > 0) {
    const minutes = Math.ceil(reviews.reduce((sum, i) => sum + i.minutes, 0) - EPS);
    missions.push({
      id: `${day}:review`, kind: "review", title: "Calentamiento",
      conceptIds: reviews.map((i) => i.conceptId), target: reviews.length, minutes,
    });
    used += minutes;
  }

  // 2. Refuerzo: los fallos recientes en pruebas y misiones.
  const reinforce = reinforceConcepts(input, state);
  if (reinforce.length > 0) {
    const minutes = Math.ceil(reinforce.reduce((sum, id) => sum + conceptMinutes(progress, id), 0) - EPS);
    missions.push({
      id: `${day}:reinforce`, kind: "reinforce", title: "Refuerzo",
      conceptIds: reinforce, target: reinforce.length, minutes,
    });
    used += minutes;
  }

  // 3. Avances: las asignaturas arrastradas de ayer primero (cuentan dentro de K) y
  //    después las de más puntuación; el resto del ranking, para los extra.
  const carried = carriedFromYesterday(input, state, start, levelOf);
  const ranked = rankSubjects({ index, state, progress, now, lastSeen: lastSeenBySubject(index, state.events) });
  const position = (sid: string) => {
    const i = ranked.indexOf(sid);
    return i === -1 ? ranked.length + (index.subjectById.get(sid)?.order ?? 0) : i;
  };
  const carriedSubjects = [...carried.keys()].sort((a, b) => position(a) - position(b));
  const order = [...carriedSubjects, ...ranked.filter((sid) => !carried.has(sid))];
  const focusSize = Math.max(focusCount(budget), carriedSubjects.length);

  /** Avance de una asignatura recortado a lo que queda de presupuesto (mínimo 2, o todos si son menos), o null. */
  const advanceFor = (subjectId: string): DayMission | null => {
    const subject = index.subjectById.get(subjectId);
    if (!subject) return null;
    const fromYesterday = carried.get(subjectId) ?? [];
    const list = advanceWalk(index, subjectId, levelOf, fromYesterday);
    if (list.length === 0) return null;
    const fits = Math.floor((budget - used + EPS) / ITEM_MINUTES.new);
    const size = Math.min(list.length, fits);
    if (size < Math.min(ADVANCE_MIN, list.length)) return null;
    const conceptIds = list.slice(0, size);
    const unit = index.unitById.get(index.conceptById.get(conceptIds[0])!.unitId);
    return {
      id: `${day}:advance:${subjectId}`, kind: "advance",
      title: unit ? `${subject.shortName} · Tema ${unit.number}` : subject.shortName,
      subjectId, ...(unit ? { unitId: unit.id } : {}),
      conceptIds, target: conceptIds.length, minutes: conceptIds.length * ITEM_MINUTES.new,
      ...(conceptIds.some((id) => fromYesterday.includes(id)) ? { carried: true } : {}),
    };
  };

  for (const subjectId of order.slice(0, focusSize)) {
    if (missions.length >= MAX_MISSIONS) break;
    const mission = advanceFor(subjectId);
    if (!mission) continue;
    missions.push(mission);
    used += mission.minutes;
  }

  // 4. Demuestra: una prueba lista (≥ 70 %) y sin superar, solo si cabe entera.
  let trialMission: DayMission | null = null;
  if (missions.length < MAX_MISSIONS && input.trials.length > 0) {
    const room = budget - used;
    const candidates = input.trials.filter((t) =>
      index.subjectById.has(t.subjectId)
      && t.durationMin + TRIAL_GRADING_MINUTES <= room + EPS
      && !trialResult(t, state).passed
      && trialReadiness(t, index, progress).ready);
    if (candidates.length > 0) {
      const focus = new Set(missions.filter((m) => m.kind === "advance").map((m) => m.subjectId));
      const rumboNext = candidates.length > 1 ? rumboNextTrials(input, state, progress) : new Set<string>();
      const subjectOrder = (sid: string) => index.subjectById.get(sid)?.order ?? Number.MAX_SAFE_INTEGER;
      candidates.sort((a, b) =>
        Number(!focus.has(a.subjectId)) - Number(!focus.has(b.subjectId))
        || Number(!rumboNext.has(a.id)) - Number(!rumboNext.has(b.id))
        || TRIAL_KIND_ORDER[a.kind] - TRIAL_KIND_ORDER[b.kind]
        || subjectOrder(a.subjectId) - subjectOrder(b.subjectId)
        || a.level - b.level
        || a.id.localeCompare(b.id));
      const trial = candidates[0];
      trialMission = {
        id: `${day}:trial`, kind: "trial", title: trial.title, subjectId: trial.subjectId, trialId: trial.id,
        conceptIds: [], target: 1, minutes: trial.durationMin + TRIAL_GRADING_MINUTES,
      };
      used += trialMission.minutes;
    }
  }

  // 5. Menos de 3 misiones: Avances extra de las siguientes asignaturas del ranking, si caben.
  for (const subjectId of order.slice(focusSize)) {
    if (missions.length + (trialMission ? 1 : 0) >= MIN_MISSIONS) break;
    const mission = advanceFor(subjectId);
    if (!mission) continue;
    missions.push(mission);
    used += mission.minutes;
  }
  if (trialMission) missions.push(trialMission);

  return {
    day,
    createdAt: now.toISOString(),
    focus: missions.filter((m) => m.kind === "advance").map((m) => m.subjectId!),
    missions,
  };
}

/** Progreso de las misiones de `plan` con `dayEvents` (los eventos de su día). */
function statusesFor(plan: DayPlan, dayEvents: readonly StudyEvent[], state: UserState): MissionStatus[] {
  let reviews = 0;
  const reviewedOk = new Set<string>();
  const touched = new Set<string>();
  for (const e of dayEvents) {
    if (e.kind === "review" && e.grade !== undefined) {
      if (e.attempted === true) reviews++;
      if (e.attempted !== false && e.grade >= 2) reviewedOk.add(e.conceptId);
    }
    if (e.kind === "seen" || e.kind === "declared" || e.kind === "review") touched.add(e.conceptId);
  }
  const toDay = createDayKeyer();
  return plan.missions.map((m): MissionStatus => {
    switch (m.kind) {
      case "review":
        return { id: m.id, count: Math.min(reviews, m.target), target: m.target, done: reviews >= m.target };
      case "reinforce": {
        const count = m.conceptIds.filter((id) => reviewedOk.has(id)).length;
        return { id: m.id, count, target: m.target, done: count >= m.conceptIds.length };
      }
      case "advance": {
        const count = m.conceptIds.filter((id) => touched.has(id)).length;
        return { id: m.id, count, target: m.target, done: count >= m.conceptIds.length };
      }
      case "trial": {
        const done = m.trialId !== undefined
          && (state.trials?.[m.trialId] ?? []).some((a) => a.endedAt !== undefined && toDay(a.endedAt) === plan.day);
        return { id: m.id, count: done ? 1 : 0, target: 1, done };
      }
    }
  });
}

/**
 * Progreso de cada misión del plan (mismo orden que `plan.missions`), solo con
 * lo hecho el día del plan:
 * - Calentamiento: repasos intentados (`attempted: true`) ese día ≥ objetivo.
 * - Refuerzo: todos sus conceptos con un repaso de nota ≥ 2 ese día.
 * - Avance: todos sus conceptos con un evento `seen`, `declared` o `review` ese día.
 * - Demuestra: un intento de la prueba terminado ese día.
 */
export function missionStatuses(plan: DayPlan, state: UserState): MissionStatus[] {
  const toDay = createDayKeyer();
  return statusesFor(plan, state.events.filter((e) => toDay(e.at) === plan.day), state);
}

/** Día completado: el plan tiene misiones y todas se hicieron antes de terminar su día. */
export function isDayCompleted(plan: DayPlan, state: UserState): boolean {
  return plan.missions.length > 0 && missionStatuses(plan, state).every((s) => s.done);
}

/** Días ("YYYY-MM-DD", en orden) de las instantáneas de `state.dayPlans` completadas. Una pasada por el registro. */
export function completedDayPlans(state: UserState): string[] {
  const plans = Object.values(state.dayPlans ?? {}).filter((p) => p.missions.length > 0);
  if (plans.length === 0) return [];
  const days = new Set(plans.map((p) => p.day));
  const byDay = new Map<string, StudyEvent[]>();
  const toDay = createDayKeyer();
  for (const e of state.events) {
    const day = toDay(e.at);
    if (!days.has(day)) continue;
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
  }
  return plans
    .filter((p) => statusesFor(p, byDay.get(p.day) ?? [], state).every((s) => s.done))
    .map((p) => p.day)
    .sort();
}

/**
 * Asignaturas en foco mañana (spec §3.7): la misma rotación, suponiendo que hoy
 * se avanza en las del foco de `today` (su último avance pasa a ser hoy). Sin
 * arrastre: se supone hecho. `progress` (opcional) evita reproducir el registro
 * si ya se tiene; si no, se deriva de `input.state` en `input.now`.
 */
export function tomorrowFocus(input: PlanInput, today: DayPlan, progress?: ReadonlyMap<string, ConceptProgress>): string[] {
  const { index, state, scheduler, now } = input;
  const current = progress ?? deriveProgress(state.events, scheduler, now);
  const lastSeen = lastSeenBySubject(index, state.events);
  for (const subjectId of today.focus) {
    const known = lastSeen.get(subjectId);
    if (known === undefined || known < today.day) lastSeen.set(subjectId, today.day);
  }
  const tomorrow = addDays(startOfDay(now), 1);
  return rankSubjects({ index, state, progress: current, now: tomorrow, lastSeen }).slice(0, focusCount(state.settings.dailyMinutes));
}

/** Conceptos del catálogo cuya tarjeta FSRS vence en `end` o antes (estimación de repasos). */
export function reviewsDueBy(index: CatalogIndex, progress: ReadonlyMap<string, ConceptProgress>, end: Date): number {
  const t = end.getTime();
  let n = 0;
  for (const p of progress.values()) if (p.due && p.due.getTime() <= t && index.conceptById.has(p.conceptId)) n++;
  return n;
}

/** Último instante (23:59:59 local) del día siguiente a `now`: el horizonte de la estimación de mañana. */
export const endOfTomorrow = (now: Date): Date => endOfDay(addDays(startOfDay(now), 1));
