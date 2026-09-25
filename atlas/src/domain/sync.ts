// Fusión de dos UserState (p.ej. al sincronizar entre dispositivos).
// Puro y determinista: nunca usa Date.now() ni new Date() sin argumento.

import type { ConceptNote, DayPlan, ExpeditionAttempt, Settings, StudyEvent, SubjectState, TrialAttempt, UserState } from "./types";

/** Registro con `updatedAt`: en un conflicto gana el de fecha ISO más reciente. */
const newer = <T extends { updatedAt: string }>(x: T, y: T): T => (y.updatedAt > x.updatedAt ? y : x);

/** Combina dos diccionarios registro-por-id quedándose, para cada id, con el "más nuevo" según `pick`. */
const mergeById = <T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> => {
  const out: Record<string, T> = { ...a };
  for (const [id, value] of Object.entries(b)) {
    out[id] = id in out ? pick(out[id], value) : value;
  }
  return out;
};

/** Fusiona dos listas de eventos por `id` (deduplicando) y las ordena por `at` (orden cronológico). */
const mergeEvents = (a: StudyEvent[], b: StudyEvent[]): StudyEvent[] => {
  const byId = new Map<string, StudyEvent>();
  for (const ev of [...a, ...b]) byId.set(ev.id, ev);
  return [...byId.values()].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
};

/** Fusiona dos listas de sesiones por `id` (deduplicando, sin orden particular más allá de la aparición). */
const mergeSessions = <T extends { id: string }>(a: T[], b: T[]): T[] => {
  const byId = new Map<string, T>();
  for (const s of [...a, ...b]) byId.set(s.id, s);
  return [...byId.values()];
};

/** Fusiona dos mapas id→ISO de desbloqueo de logro: gana la fecha más antigua (el desbloqueo real). */
const mergeAchievements = (a: Record<string, string>, b: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = { ...a };
  for (const [id, at] of Object.entries(b)) {
    out[id] = id in out ? (at < out[id] ? at : out[id]) : at;
  }
  return out;
};

/** Fusiona el estado "visto" (onboarding/tutoriales): unión de logros vistos, máximo nivel mostrado. */
const mergeSeen = (
  a: UserState["seen"],
  b: UserState["seen"],
): UserState["seen"] => ({
  achievements: [...new Set([...a.achievements, ...b.achievements])],
  levelShown: Math.max(a.levelShown, b.levelShown),
});

/** El intento "más completo": el que tiene `endedAt` (sobre el que no lo tiene) o, a igualdad, más puntuaciones. */
const moreCompleteAttempt = (x: ExpeditionAttempt, y: ExpeditionAttempt): ExpeditionAttempt => {
  if (Boolean(x.endedAt) !== Boolean(y.endedAt)) return x.endedAt ? x : y;
  return Object.keys(y.scores).length > Object.keys(x.scores).length ? y : x;
};

/** Fusiona los intentos de una misma misión por `id` de intento, quedándose con el más completo. */
const mergeAttempts = (a: ExpeditionAttempt[], b: ExpeditionAttempt[]): ExpeditionAttempt[] => {
  const byId = new Map<string, ExpeditionAttempt>();
  for (const attempt of a) byId.set(attempt.id, attempt);
  for (const attempt of b) {
    const known = byId.get(attempt.id);
    byId.set(attempt.id, known ? moreCompleteAttempt(known, attempt) : attempt);
  }
  return [...byId.values()];
};

/** Fusiona `expeditions` (intentos por id de misión); `undefined` si ninguno de los dos lo tiene. */
const mergeExpeditions = (
  a: UserState["expeditions"],
  b: UserState["expeditions"],
): UserState["expeditions"] | undefined =>
  a || b ? mergeById<ExpeditionAttempt[]>(a ?? {}, b ?? {}, mergeAttempts) : undefined;

/** Casillas de rúbrica marcadas en un intento (su borrador de corrección). */
const checkedCount = (a: TrialAttempt): number =>
  Object.values(a.checked ?? {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);

/**
 * El intento de prueba "más completo": el que tiene `endedAt`; a igualdad, el de
 * más puntos por problema y, si siguen empatados (dos intentos abiertos, cuyo
 * `earned` está vacío), el de borrador de corrección más avanzado.
 */
const moreCompleteTrialAttempt = (x: TrialAttempt, y: TrialAttempt): TrialAttempt => {
  if (Boolean(x.endedAt) !== Boolean(y.endedAt)) return x.endedAt ? x : y;
  const byEarned = Object.keys(y.earned).length - Object.keys(x.earned).length;
  if (byEarned !== 0) return byEarned > 0 ? y : x;
  return checkedCount(y) > checkedCount(x) ? y : x;
};

/** Fusiona los intentos de una misma prueba por `id` de intento, quedándose con el más completo. */
const mergeTrialAttempts = (a: TrialAttempt[], b: TrialAttempt[]): TrialAttempt[] => {
  const byId = new Map<string, TrialAttempt>();
  for (const attempt of a) byId.set(attempt.id, attempt);
  for (const attempt of b) {
    const known = byId.get(attempt.id);
    byId.set(attempt.id, known ? moreCompleteTrialAttempt(known, attempt) : attempt);
  }
  return [...byId.values()];
};

/** Fusiona `trials` (intentos por id de prueba); `undefined` si ninguno de los dos lo tiene. */
const mergeTrials = (a: UserState["trials"], b: UserState["trials"]): UserState["trials"] | undefined =>
  a || b ? mergeById<TrialAttempt[]>(a ?? {}, b ?? {}, mergeTrialAttempts) : undefined;

/** La instantánea más antigua de un día (la primera que se hizo; a igualdad, la de `a`). */
const olderPlan = (a: DayPlan, b: DayPlan): DayPlan => (b.createdAt < a.createdAt ? b : a);

/** Fusiona `dayPlans` por día quedándose con la instantánea más antigua; `undefined` si ninguno de los dos lo tiene. */
const mergeDayPlans = (a: UserState["dayPlans"], b: UserState["dayPlans"]): UserState["dayPlans"] | undefined =>
  a || b ? mergeById<DayPlan>(a ?? {}, b ?? {}, olderPlan) : undefined;

/** Fusiona dos UserState (p.ej. de dos dispositivos) en uno solo, sin pérdida de datos. */
export const mergeStates = (a: UserState, b: UserState): UserState => {
  const expeditions = mergeExpeditions(a.expeditions, b.expeditions);
  const trials = mergeTrials(a.trials, b.trials);
  const dayPlans = mergeDayPlans(a.dayPlans, b.dayPlans);
  return {
    version: 2,
    createdAt: a.createdAt < b.createdAt ? a.createdAt : b.createdAt,
    settings: newer<Settings>(a.settings, b.settings),
    events: mergeEvents(a.events, b.events),
    sessions: mergeSessions(a.sessions, b.sessions),
    notes: mergeById<ConceptNote>(a.notes, b.notes, newer),
    subjects: mergeById<SubjectState>(a.subjects, b.subjects, newer),
    achievements: mergeAchievements(a.achievements, b.achievements),
    seen: mergeSeen(a.seen, b.seen),
    ...(expeditions ? { expeditions } : {}),
    ...(trials ? { trials } : {}),
    ...(dayPlans ? { dayPlans } : {}),
  };
};
