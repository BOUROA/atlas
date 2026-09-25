// Actividad agregada por día local, calculada en una sola pasada por el
// registro. Base común de racha, objetivos, XP y logros. Pura.
import { createDayKeyer } from "../time";
import type { StudyEvent, UserState } from "../types";

export type DayActivity = {
  /** Repasos con intento (`review` con nota y `attempted !== false`). */
  reviews: number;
  /** Eventos `seen`. */
  seen: number;
  /** Sesiones completadas que terminaron ese día. */
  completedSessions: number;
  /** Conceptos cuyo primer evento (`seen`, `review` o `declared`) cae ese día. */
  newConcepts: number;
};

/** Un repaso cuenta como intento si tiene nota y no se mostró la respuesta sin intentarlo. */
export const isAttemptedReview = (e: StudyEvent): boolean =>
  e.kind === "review" && e.attempted !== false && e.grade !== undefined;

/** Umbrales del día activo (racha y objetivo "días activos"). */
export const ACTIVE_DAY_REVIEWS = 10;
export const ACTIVE_DAY_SEEN = 10;

/** Día activo: ≥ 10 repasos, ≥ 10 conceptos vistos o una sesión completada. */
export const isActiveDay = (a: DayActivity): boolean =>
  a.reviews >= ACTIVE_DAY_REVIEWS || a.seen >= ACTIVE_DAY_SEEN || a.completedSessions > 0;

const emptyDay = (): DayActivity => ({ reviews: 0, seen: 0, completedSessions: 0, newConcepts: 0 });

/** Actividad por DayKey ("YYYY-MM-DD", hora local). Solo aparecen días con algo. */
export function dailyActivity(state: UserState): Map<string, DayActivity> {
  const toDay = createDayKeyer();
  const days = new Map<string, DayActivity>();
  const day = (key: string): DayActivity => {
    let a = days.get(key);
    if (!a) {
      a = emptyDay();
      days.set(key, a);
    }
    return a;
  };
  const firstAt = new Map<string, number>();
  for (const e of state.events) {
    if (e.kind === "implicit") continue;
    const t = Date.parse(e.at);
    const first = firstAt.get(e.conceptId);
    if (first === undefined || t < first) firstAt.set(e.conceptId, t);
    if (isAttemptedReview(e)) day(toDay(t)).reviews++;
    else if (e.kind === "seen") day(toDay(t)).seen++;
  }
  for (const t of firstAt.values()) day(toDay(t)).newConcepts++;
  for (const s of state.sessions) if (s.completed) day(toDay(s.endedAt)).completedSessions++;
  return days;
}

/** Conjunto de días activos a partir de la actividad diaria. */
export function activeDaysFrom(activity: ReadonlyMap<string, DayActivity>): Set<string> {
  const out = new Set<string>();
  for (const [key, a] of activity) if (isActiveDay(a)) out.add(key);
  return out;
}
