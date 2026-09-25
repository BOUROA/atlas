// Reparto semanal del tiempo de estudio por asignatura (semana ISO). Puro.
import type { CatalogIndex } from "../catalog";
import { addDays, parseDayKey } from "../time";
import type { UserState } from "../types";
import { isoWeekDays } from "./goals";

export type SubjectMinutes = { subjectId: string; minutes: number };
export type WeeklyDistribution = {
  /** Asignaturas `current`, de más a menos minutos (empate: `order`). */
  bySubject: SubjectMinutes[];
  totalMinutes: number;
  /** La de menos minutos; null si no hay ninguna actividad en la semana. */
  neglected: string | null;
};

/** Minutos supuestos de un repaso sin duración registrada. */
const REVIEW_MINUTES = 1.5;
const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Minutos de la semana ISO de `now` por asignatura propietaria del concepto:
 * `ms` de cada `review` o `seen` (un `review` sin `ms` cuenta 1,5 min; un
 * `seen` sin `ms`, como un registro de clase, no cuenta).
 */
export function weeklyDistribution(index: CatalogIndex, state: UserState, now: Date): WeeklyDistribution {
  const days = isoWeekDays(now);
  const start = parseDayKey(days[0]).getTime();
  const end = addDays(parseDayKey(days[6]), 1).getTime();

  const raw = new Map<string, number>();
  for (const s of index.subjects) if (s.status === "current") raw.set(s.id, 0);
  let active = false;
  for (const e of state.events) {
    if (e.kind !== "review" && e.kind !== "seen") continue;
    const minutes = e.ms !== undefined && e.ms > 0 ? e.ms / 60000 : e.kind === "review" ? REVIEW_MINUTES : 0;
    if (minutes <= 0) continue;
    const t = Date.parse(e.at);
    if (!(t >= start && t < end)) continue;
    const owner = index.conceptById.get(e.conceptId)?.subjectId;
    if (owner === undefined || !raw.has(owner)) continue;
    raw.set(owner, raw.get(owner)! + minutes);
    active = true;
  }

  const order = (sid: string) => index.subjectById.get(sid)?.order ?? Number.MAX_SAFE_INTEGER;
  const bySubject = [...raw]
    .map(([subjectId, minutes]) => ({ subjectId, minutes: round1(minutes) }))
    .sort((a, b) => b.minutes - a.minutes || order(a.subjectId) - order(b.subjectId));
  const total = [...raw.values()].reduce((sum, m) => sum + m, 0);
  return {
    bySubject,
    totalMinutes: round1(total),
    neglected: active && bySubject.length > 0 ? bySubject[bySubject.length - 1].subjectId : null,
  };
}
