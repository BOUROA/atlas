// Derivados memoizados para la interfaz: reloj por minutos, progreso,
// gamificación, cola, rumbo y vista de concepto. Todo sale de `store` y del catálogo.
import { useMemo, useSyncExternalStore } from "react";
import type { CatalogConcept, CatalogUnit, ConceptNote, DayPlan, Level, StudyEvent, Subject, UserState } from "../domain/types";
import { campaignOf, type Campaign } from "../domain/campaigns";
import { subjectPath, subjectPathLevel, type PathInput, type SubjectPath, type SubjectPathLevel } from "../domain/camino";
import { neededIn, impactOf, type NeededIn } from "../domain/graph";
import {
  composeDayPlan, endOfTomorrow, missionStatuses, reviewsDueBy, tomorrowFocus, type MissionStatus, type PlanInput,
} from "../domain/plan";
import { buildRoutes, type SubjectRoute } from "../domain/route";
import { dayKey } from "../domain/time";
import { buildQueue, type QueueOptions, type QueueResult } from "../domain/tutor/queue";
import { progressOf, type ConceptProgress } from "../domain/tutor/mastery";
import { catalog, currentSubjects, expeditions, guides, trials } from "./catalog";
import { createDeriver, type Derived } from "./derive-core";
import { store, useUserState } from "./store";

export type { Derived } from "./derive-core";
export { progressOf } from "../domain/tutor/mastery";

/* ───────── Reloj compartido (un Date por minuto) ───────── */

const minuteOf = (d: Date) => new Date(Math.floor(d.getTime() / 60_000) * 60_000);
// Fecha simulada para capturas y demos: `?hoy=AAAA-MM-DD` en la URL (antes del #).
// Solo desplaza lo que se ve (el reloj de los derivados); las acciones guardan la hora real.
const simulatedOffset = (() => {
  if (typeof window === "undefined") return 0;
  const hoy = new URLSearchParams(window.location.search).get("hoy");
  if (!hoy || !/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return 0;
  const now = new Date();
  const target = new Date(now);
  const [y, m, d] = hoy.split("-").map(Number);
  target.setFullYear(y, m - 1, d);
  return target.getTime() - now.getTime();
})();
const currentDate = () => new Date(Date.now() + simulatedOffset);

let clock = minuteOf(currentDate());
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setTimeout> | null = null;

function tick() {
  const next = minuteOf(currentDate());
  if (next.getTime() !== clock.getTime()) {
    clock = next;
    for (const l of clockListeners) l();
  }
}
function scheduleTick() {
  if (clockTimer) clearTimeout(clockTimer);
  const ms = 60_000 - (Date.now() % 60_000) + 50;
  clockTimer = setTimeout(() => {
    tick();
    scheduleTick();
  }, ms);
}
function subscribeClock(l: () => void) {
  clockListeners.add(l);
  if (clockListeners.size === 1) {
    scheduleTick();
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
  }
  return () => {
    clockListeners.delete(l);
    if (clockListeners.size === 0) {
      if (clockTimer) clearTimeout(clockTimer);
      clockTimer = null;
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    }
  };
}
const getClock = () => clock;

/** Hora actual redondeada al minuto; cambia cada minuto y al volver a la pestaña. */
export function useNow(): Date {
  return useSyncExternalStore(subscribeClock, getClock, getClock);
}
/** La misma hora que ve `useNow`, fuera de React (acciones). */
export const nowMinute = (): Date => {
  tick();
  return clock;
};

/* ───────── Derivados ───────── */

const derive = createDeriver({ index: catalog, expeditions, guides, trials });

/** Derivados para un estado y un instante concretos (memoizado; úsalo en acciones). */
export const getDerived = (state: UserState = store.getState(), now: Date = nowMinute()): Derived => derive(state, now);

/**
 * Progreso, XP, nivel, rango, racha, actividad, objetivos semanales e insignias.
 * Todos los componentes comparten el mismo objeto mientras no cambien el estado ni el minuto.
 */
export function useDerived(): Derived {
  const state = useUserState((s) => s);
  const now = useNow();
  return useMemo(() => derive(state, now), [state, now]);
}

/** Progreso de un concepto (nivel 0 si no tiene eventos). */
export function useProgress(conceptId: string): ConceptProgress {
  const { progress } = useDerived();
  return progressOf(progress, conceptId);
}

/* ───────── Cola ───────── */

const queueMemo = new Map<string, { state: UserState; progress: Map<string, ConceptProgress>; value: QueueResult }>();

/** Cola de hoy (buildQueue) para unas opciones; memoizada por estado, minuto y opciones. */
export function getQueue(opts: QueueOptions = {}, state: UserState = store.getState(), derived: Derived = getDerived(state)): QueueResult {
  const key = `${opts.subjectId ?? ""}|${opts.minutes ?? ""}|${opts.reviewsOnly ? 1 : 0}`;
  const hit = queueMemo.get(key);
  if (hit && hit.state === state && hit.progress === derived.progress) return hit.value;
  const value = buildQueue({
    index: catalog,
    state,
    progress: derived.progress,
    scheduler: derived.scheduler,
    now: derived.now,
    expeditions,
    trials,
    ...opts,
  });
  if (queueMemo.size > 12) queueMemo.clear();
  queueMemo.set(key, { state, progress: derived.progress, value });
  return value;
}

/** Cola de hoy, opcionalmente filtrada por asignatura, minutos o solo repasos. */
export function useQueue(opts: QueueOptions = {}): QueueResult {
  const state = useUserState((s) => s);
  const derived = useDerived();
  const { subjectId, minutes, reviewsOnly } = opts;
  return useMemo(
    () => getQueue({ subjectId, minutes, reviewsOnly }, state, derived),
    [state, derived, subjectId, minutes, reviewsOnly],
  );
}

/* ───────── Rumbo y campañas de élite ───────── */

// El rumbo y las campañas solo leen el *nivel* de los conceptos (que depende
// del registro y la retención, ambos en `state`) y, el rumbo, el día. La
// frescura, que cambia cada minuto y da un `derived.progress` nuevo, no les
// afecta: por eso la memoria se indexa por estado (y día), no por progreso, y
// la lista devuelta es la misma instancia todo el día mientras no cambie el estado.
const routesMemo = { state: null as UserState | null, day: "", value: null as SubjectRoute[] | null };

/** Rumbo de cada asignatura del curso actual; memoizado por estado y día. */
export function getRoutes(state: UserState = store.getState(), derived: Derived = getDerived(state)): SubjectRoute[] {
  const day = dayKey(derived.now);
  if (routesMemo.value && routesMemo.state === state && routesMemo.day === day) return routesMemo.value;
  const value = buildRoutes({ index: catalog, state, progress: derived.progress, trials, now: derived.now });
  routesMemo.state = state;
  routesMemo.day = day;
  routesMemo.value = value;
  return value;
}

/** Rumbo de cada asignatura del curso actual. */
export function useRoutes(): SubjectRoute[] {
  const state = useUserState((s) => s);
  const derived = useDerived();
  return useMemo(() => getRoutes(state, derived), [state, derived]);
}

const campaignMemo = { state: null as UserState | null, bySubject: new Map<string, Campaign>() };

/** Campaña de élite de una asignatura; memoizada por estado (no depende de la hora). */
export function getCampaign(subjectId: string, state: UserState = store.getState(), derived: Derived = getDerived(state)): Campaign {
  if (campaignMemo.state !== state) {
    campaignMemo.state = state;
    campaignMemo.bySubject = new Map();
  }
  let hit = campaignMemo.bySubject.get(subjectId);
  if (!hit) {
    hit = campaignOf(subjectId, expeditions, state, derived.progress);
    campaignMemo.bySubject.set(subjectId, hit);
  }
  return hit;
}

/** Campaña de élite de una asignatura (escalera de misiones ordenadas por dificultad). */
export function useCampaign(subjectId: string): Campaign {
  const state = useUserState((s) => s);
  const derived = useDerived();
  return useMemo(() => getCampaign(subjectId, state, derived), [subjectId, state, derived]);
}

/* ───────── Misión del día ───────── */

const planInput = (state: UserState, derived: Derived): PlanInput => ({
  index: catalog, state, scheduler: derived.scheduler, trials, expeditions, now: derived.now,
});

// El plan propuesto (sin guardar) solo se calcula hasta que `ensureDayPlan` lo
// guarda: memoria por estado y día, compartida con la acción.
const composedMemo = { state: null as UserState | null, day: "", value: null as DayPlan | null };

/**
 * Plan de hoy: la instantánea guardada en `state.dayPlans` o, si aún no la hay,
 * uno recién calculado (`stored: false`) que no se escribe; lo guarda `ensureDayPlan`.
 */
export function getDayPlan(state: UserState = store.getState(), derived: Derived = getDerived(state)): { plan: DayPlan; stored: boolean } {
  const day = dayKey(derived.now);
  const saved = state.dayPlans?.[day];
  if (saved) return { plan: saved, stored: true };
  if (!composedMemo.value || composedMemo.state !== state || composedMemo.day !== day) {
    composedMemo.state = state;
    composedMemo.day = day;
    composedMemo.value = composeDayPlan(planInput(state, derived));
  }
  return { plan: composedMemo.value, stored: false };
}

export type DayPlanView = {
  /** La instantánea de hoy o, si aún no se ha guardado, la propuesta (ver `stored`). */
  plan: DayPlan;
  /** true si `plan` ya está en `state.dayPlans`; si no, llama a `ensureDayPlan()`. */
  stored: boolean;
  /** Progreso de cada misión, en el orden de `plan.missions`. */
  statuses: MissionStatus[];
  /** Misiones hechas y totales. */
  done: number;
  total: number;
  /** Día completado (+60 XP): hay misiones y todas están hechas. */
  completed: boolean;
  /** Minutos estimados del plan. */
  minutes: number;
  /** Línea de mañana: asignaturas en foco y repasos que vencen mañana (FSRS). No se guarda. */
  tomorrow: { focus: string[]; reviews: number };
};

// Nada de la vista depende del minuto (solo del estado y del día).
const dayViewMemo = { state: null as UserState | null, day: "", value: null as DayPlanView | null };

/** Vista de la Misión del día; memoizada por estado y día. */
export function getDayPlanView(state: UserState = store.getState(), derived: Derived = getDerived(state)): DayPlanView {
  const day = dayKey(derived.now);
  if (dayViewMemo.value && dayViewMemo.state === state && dayViewMemo.day === day) return dayViewMemo.value;
  const { plan, stored } = getDayPlan(state, derived);
  const statuses = missionStatuses(plan, state);
  const done = statuses.filter((s) => s.done).length;
  const value: DayPlanView = {
    plan,
    stored,
    statuses,
    done,
    total: plan.missions.length,
    completed: plan.missions.length > 0 && done === plan.missions.length,
    minutes: plan.missions.reduce((sum, m) => sum + m.minutes, 0),
    tomorrow: {
      focus: tomorrowFocus(planInput(state, derived), plan, derived.progress),
      reviews: reviewsDueBy(catalog, derived.progress, endOfTomorrow(derived.now)),
    },
  };
  dayViewMemo.state = state;
  dayViewMemo.day = day;
  dayViewMemo.value = value;
  return value;
}

/** Misión del día: plan, progreso de cada misión, totales y la línea de mañana. */
export function useDayPlan(): DayPlanView {
  const state = useUserState((s) => s);
  const derived = useDerived();
  return useMemo(() => getDayPlanView(state, derived), [state, derived]);
}

/* ───────── Camino ───────── */

const pathInput = (state: UserState, derived: Derived): PathInput => ({
  index: catalog, state, progress: derived.progress, trials, expeditions, now: derived.now, routes: getRoutes(state, derived),
});

// Como el rumbo: solo lee niveles (del estado) y el día.
const pathMemo = {
  state: null as UserState | null, day: "",
  bySubject: new Map<string, SubjectPath>(),
  levels: null as Record<string, SubjectPathLevel> | null,
};
const pathMemoFor = (state: UserState, day: string) => {
  if (pathMemo.state !== state || pathMemo.day !== day) {
    pathMemo.state = state;
    pathMemo.day = day;
    pathMemo.bySubject = new Map();
    pathMemo.levels = null;
  }
  return pathMemo;
};

/** Camino de una asignatura (nodos del Rumbo + élite, nivel y «estás aquí»); memoizado por estado y día. */
export function getSubjectPath(subjectId: string, state: UserState = store.getState(), derived: Derived = getDerived(state)): SubjectPath {
  const memo = pathMemoFor(state, dayKey(derived.now));
  let hit = memo.bySubject.get(subjectId);
  if (!hit) {
    hit = subjectPath(pathInput(state, derived), subjectId);
    memo.bySubject.set(subjectId, hit);
  }
  return hit;
}

/** Camino de una asignatura hasta el máximo. */
export function useSubjectPath(subjectId: string): SubjectPath {
  const state = useUserState((s) => s);
  const derived = useDerived();
  return useMemo(() => getSubjectPath(subjectId, state, derived), [subjectId, state, derived]);
}

/** Nivel del Camino de cada asignatura del curso actual, por id; memoizado por estado y día. */
export function getSubjectLevels(state: UserState = store.getState(), derived: Derived = getDerived(state)): Record<string, SubjectPathLevel> {
  const memo = pathMemoFor(state, dayKey(derived.now));
  if (!memo.levels) {
    const input = pathInput(state, derived);
    memo.levels = Object.fromEntries(currentSubjects.map((s) => [s.id, subjectPathLevel(input, s.id)]));
  }
  return memo.levels;
}

/** Nivel del Camino de cada asignatura del curso actual (`levels[subjectId]`). */
export function useSubjectLevels(): Record<string, SubjectPathLevel> {
  const state = useUserState((s) => s);
  const derived = useDerived();
  return useMemo(() => getSubjectLevels(state, derived), [state, derived]);
}

/* ───────── Vista de concepto (ficha) ───────── */

export type ConceptView = {
  concept: CatalogConcept;
  subject: Subject;
  unit: CatalogUnit;
  progress: ConceptProgress;
  /** Asignaturas ajenas donde se necesita, con los conceptos por los que se necesita. */
  neededIn: NeededIn[];
  impact: { dependents: number; subjects: number };
  /** Requisitos directos con su nivel y el motivo de la relación. */
  prerequisites: { id: string; level: Level; reason: string }[];
  /** Dependientes directos con su asignatura. */
  dependents: { id: string; subjectId: string }[];
  /** Eventos del concepto, del más antiguo al más reciente. */
  events: StudyEvent[];
  note: ConceptNote | undefined;
};

const staticMemo = new Map<string, Pick<ConceptView, "neededIn" | "impact">>();
const staticOf = (id: string) => {
  let hit = staticMemo.get(id);
  if (!hit) {
    hit = { neededIn: neededIn(catalog, id), impact: impactOf(catalog, id) };
    staticMemo.set(id, hit);
  }
  return hit;
};

/** Todo lo que la ficha necesita; `null` si el id no existe en el catálogo. */
export function useConceptView(conceptId: string): ConceptView | null {
  const state = useUserState((s) => s);
  const { progress } = useDerived();
  return useMemo(() => {
    const concept = catalog.conceptById.get(conceptId);
    if (!concept) return null;
    const subject = catalog.subjectById.get(concept.subjectId)!;
    const unit = catalog.unitById.get(concept.unitId)!;
    const { neededIn: needed, impact } = staticOf(conceptId);
    return {
      concept,
      subject,
      unit,
      progress: progressOf(progress, conceptId),
      neededIn: needed,
      impact,
      prerequisites: (catalog.requiresOf.get(conceptId) ?? []).map((id) => ({
        id,
        level: progressOf(progress, id).level,
        reason: catalog.reason(conceptId, "requires", id) ?? "",
      })),
      dependents: (catalog.requiredBy.get(conceptId) ?? []).map((id) => ({ id, subjectId: catalog.conceptById.get(id)?.subjectId ?? "" })),
      events: state.events.filter((e) => e.conceptId === conceptId).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
      note: state.notes[conceptId],
    };
  }, [conceptId, state.events, state.notes, progress]);
}
