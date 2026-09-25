// Objetivos semanales (semana ISO, de lunes a domingo; especificación §7). Puro.
import { addDays, dayKey, isoWeekKey, parseDayKey, startOfDay } from "../time";
import type { UserState } from "../types";
import { dailyActivity, isActiveDay, type DayActivity } from "./activity";

export type WeeklyGoalId = "dias" | "repasos" | "nuevos";
export type WeeklyGoal = { id: WeeklyGoalId; label: string; value: number; target: number };

export const WEEKLY_TARGETS: Readonly<Record<WeeklyGoalId, number>> = { dias: 5, repasos: 150, nuevos: 25 };

/** Los siete DayKey (lunes a domingo) de la semana ISO de `d`. */
export function isoWeekDays(d: Date): string[] {
  const day = startOfDay(d);
  const monday = addDays(day, -((day.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
}

type Totals = Record<WeeklyGoalId, number>;
const add = (t: Totals, a: DayActivity) => {
  if (isActiveDay(a)) t.dias++;
  t.repasos += a.reviews;
  t.nuevos += a.newConcepts;
};
const met = (t: Totals) =>
  t.dias >= WEEKLY_TARGETS.dias && t.repasos >= WEEKLY_TARGETS.repasos && t.nuevos >= WEEKLY_TARGETS.nuevos;

export function goalsFrom(activity: ReadonlyMap<string, DayActivity>, now: Date): WeeklyGoal[] {
  const t: Totals = { dias: 0, repasos: 0, nuevos: 0 };
  for (const key of isoWeekDays(now)) {
    const a = activity.get(key);
    if (a) add(t, a);
  }
  return [
    { id: "dias", label: "Días activos", value: t.dias, target: WEEKLY_TARGETS.dias },
    { id: "repasos", label: "Repasos", value: t.repasos, target: WEEKLY_TARGETS.repasos },
    { id: "nuevos", label: "Conceptos nuevos", value: t.nuevos, target: WEEKLY_TARGETS.nuevos },
  ];
}

/**
 * Objetivos de la semana ISO de `now`: días activos (misma definición que la
 * racha), repasos con intento y conceptos cuyo primer evento cae en la semana.
 */
export const weeklyGoals = (state: UserState, now: Date): WeeklyGoal[] => goalsFrom(dailyActivity(state), now);

/** Semana ISO con los tres objetivos cumplidos y el día en que se cumplió el último. */
export type PerfectWeek = { week: string; day: string };

/** Todas las semanas con los tres objetivos cumplidos, en orden cronológico. */
export function perfectWeeks(activity: ReadonlyMap<string, DayActivity>): PerfectWeek[] {
  const byWeek = new Map<string, string[]>();
  for (const key of activity.keys()) {
    const week = isoWeekKey(parseDayKey(key));
    const list = byWeek.get(week);
    if (list) list.push(key);
    else byWeek.set(week, [key]);
  }
  const out: PerfectWeek[] = [];
  for (const [week, days] of byWeek) {
    const t: Totals = { dias: 0, repasos: 0, nuevos: 0 };
    for (const key of days.sort()) {
      add(t, activity.get(key)!);
      if (met(t)) {
        out.push({ week, day: key });
        break;
      }
    }
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
