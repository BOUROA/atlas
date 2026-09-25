// XP derivada del estado (especificación §7): eventos, subidas de nivel,
// sesiones, objetivo diario, cofre semanal, Misión del día completada e
// insignias. Pura y en tiempo lineal.
import { createDayKeyer } from "../time";
import type { Grade, UserState } from "../types";
import type { ConceptProgress } from "../tutor/mastery";
import { ACHIEVEMENT_BY_ID } from "./achievements";
import { dailyActivity, isAttemptedReview } from "./activity";
import { perfectWeeks } from "./goals";
import { completedDayPlans } from "../plan";

export const XP_RULES = {
  seen: 5,
  review: { 1: 4, 2: 8, 3: 10, 4: 12 } as Readonly<Record<Grade, number>>,
  levelUp: { 2: 25, 3: 60 } as const,
  session: 30,
  /** Objetivo diario: ≥ 20 repasos con intento o conceptos vistos en el día. */
  dailyGoal: 50,
  dailyGoalEvents: 20,
  /** Cofre semanal: los tres objetivos semanales cumplidos. */
  weeklyChest: 300,
  /** Misión del día completada (todas sus misiones hechas ese día). */
  dayPlan: 60,
} as const;

export type XpTotals = { total: number; byDay: Record<string, number> };

export function totalXp(state: UserState, progress: ReadonlyMap<string, ConceptProgress>): XpTotals {
  const toDay = createDayKeyer();
  const byDay: Record<string, number> = {};
  let total = 0;
  const give = (day: string, xp: number) => {
    if (xp <= 0) return;
    byDay[day] = (byDay[day] ?? 0) + xp;
    total += xp;
  };

  for (const e of state.events) {
    if (e.kind === "seen") give(toDay(e.at), XP_RULES.seen);
    else if (isAttemptedReview(e)) give(toDay(e.at), XP_RULES.review[e.grade!]);
  }
  for (const p of progress.values()) {
    for (const up of p.levelUps) give(toDay(up.at), XP_RULES.levelUp[up.level]);
  }
  for (const s of state.sessions) if (s.completed) give(toDay(s.endedAt), XP_RULES.session);

  const activity = dailyActivity(state);
  for (const [day, a] of activity) {
    if (a.reviews + a.seen >= XP_RULES.dailyGoalEvents) give(day, XP_RULES.dailyGoal);
  }
  for (const w of perfectWeeks(activity)) give(w.day, XP_RULES.weeklyChest);
  for (const day of completedDayPlans(state)) give(day, XP_RULES.dayPlan);

  for (const [id, at] of Object.entries(state.achievements)) {
    const achievement = ACHIEVEMENT_BY_ID.get(id);
    if (achievement) give(toDay(at), achievement.xp);
  }
  return { total, byDay };
}
