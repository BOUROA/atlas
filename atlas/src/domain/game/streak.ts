// Racha de días activos con un comodín automático por semana ISO
// (especificación §7). Pura: `now` llega como parámetro.
import { addDays, dayKey, isoWeekKey, parseDayKey, startOfDay } from "../time";
import type { UserState } from "../types";
import { activeDaysFrom, dailyActivity } from "./activity";

export type StreakInfo = { current: number; freezesUsed: number; activeToday: boolean };

/** Días activos (DayKey): ≥ 10 repasos, ≥ 10 conceptos vistos o una sesión completada. */
export const activeDays = (state: UserState): Set<string> => activeDaysFrom(dailyActivity(state));

/**
 * Recorre hacia atrás desde `start`: cada día activo suma; uno inactivo se
 * cubre con el comodín de su semana ISO si no se ha usado y el día anterior
 * está activo (no suma); si no, la racha se corta ahí.
 */
function walkBack(active: ReadonlySet<string>, start: Date): { current: number; freezesUsed: number } {
  let current = 0;
  let freezesUsed = 0;
  const usedWeeks = new Set<string>();
  for (let d = startOfDay(start); ; d = addDays(d, -1)) {
    if (active.has(dayKey(d))) {
      current++;
      continue;
    }
    const week = isoWeekKey(d);
    if (usedWeeks.has(week) || !active.has(dayKey(addDays(d, -1)))) break;
    usedWeeks.add(week);
    freezesUsed++;
  }
  return { current, freezesUsed };
}

/** Racha actual: empieza hoy si hoy es activo; si no, ayer (hoy aún no la rompe). */
export function streakInfo(active: ReadonlySet<string>, now: Date): StreakInfo {
  const activeToday = active.has(dayKey(now));
  return { ...walkBack(active, activeToday ? now : addDays(now, -1)), activeToday };
}

/**
 * Racha más larga de la historia. Si el día siguiente a `d` es activo, la racha
 * que acaba en él es la de `d` + 1, así que basta con mirar los días activos
 * que no tienen continuación.
 */
export function longestStreak(active: ReadonlySet<string>): number {
  let best = 0;
  for (const key of active) {
    const d = parseDayKey(key);
    if (active.has(dayKey(addDays(d, 1)))) continue;
    best = Math.max(best, walkBack(active, d).current);
  }
  return best;
}
