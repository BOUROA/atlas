// Misiones: exámenes reales de otras universidades resueltos dentro de Atlas.
// Puro y determinista: `now`/`at` llegan siempre como parámetro.
import { dayKey, daysBetween } from "./time";
import type { Expedition, ExpeditionAttempt, StudyEvent, UserState } from "./types";
import type { ConceptProgress } from "./tutor/mastery";
import { progressOf } from "./tutor/mastery";

/** Nivel a partir del cual un concepto cuenta como "preparado"/"encendido". */
const READY_LEVEL = 2;
/** Proporción de territorio preparado a partir de la cual se considera "listo". */
const READY_RATIO = 0.7;
/** Nota (sobre 10) a partir de la cual una misión se considera superada. */
export const PASSING_GRADE = 7;
/** Ventana de días tras un intento en la que sus fallos siguen proponiéndose para reforzar. */
const REINFORCE_WINDOW_DAYS = 7;

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Conceptos únicos que cubre una misión (unión de los de todos sus problemas), en orden de aparición. */
export function territory(exp: Expedition): string[] {
  return [...new Set(exp.problems.flatMap((p) => p.concepts))];
}

export type Readiness = { ratio: number; ready: boolean; missing: string[] };

/**
 * Preparación para una misión: proporción de su territorio ya a nivel ≥ 2,
 * lista (`ready`) a partir del 70 %, y los conceptos que aún faltan (en el
 * orden del territorio). Una misión sin territorio se considera lista.
 */
export function readiness(exp: Expedition, progress: ReadonlyMap<string, ConceptProgress>): Readiness {
  const ids = territory(exp);
  if (ids.length === 0) return { ratio: 1, ready: true, missing: [] };
  const missing = ids.filter((id) => progressOf(progress, id).level < READY_LEVEL);
  const ratio = (ids.length - missing.length) / ids.length;
  return { ratio, ready: ratio >= READY_RATIO, missing };
}

/** Nota (0–10) de un intento: media de sus puntuaciones ponderada por `points` (1 si no se indica). */
export function scoreOf(exp: Expedition, attempt: ExpeditionAttempt): number {
  let earned = 0;
  let weightSum = 0;
  for (const p of exp.problems) {
    const weight = p.points ?? 1;
    earned += (attempt.scores[p.n] ?? 0) * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? round2((earned / weightSum) * 10) : 0;
}

/**
 * Mejor puntuación de cada concepto de la misión en un intento (un problema
 * puede cubrir varios conceptos; un concepto puede aparecer en varios
 * problemas: se queda con la mejor nota entre todos ellos).
 */
function bestScoresByConcept(exp: Expedition, attempt: ExpeditionAttempt): Map<string, 0 | 0.5 | 1> {
  const best = new Map<string, 0 | 0.5 | 1>();
  for (const p of exp.problems) {
    const score = attempt.scores[p.n] ?? 0;
    for (const conceptId of p.concepts) {
      const prev = best.get(conceptId);
      if (prev === undefined || score > prev) best.set(conceptId, score);
    }
  }
  return best;
}

/**
 * Eventos `review` (`source: "challenge"`, `questionKind: "exercise"`) que
 * corregir una misión genera: uno por concepto, con la mejor nota del
 * intento (1 → nota 3, ½ → nota 2, 0 → ningún evento).
 */
export function eventsFromGrading(exp: Expedition, attempt: ExpeditionAttempt, at: string): StudyEvent[] {
  const events: StudyEvent[] = [];
  for (const [conceptId, score] of bestScoresByConcept(exp, attempt)) {
    if (score === 0) continue;
    events.push({
      id: `${attempt.id}~${conceptId}`, at, conceptId, kind: "review",
      grade: score === 1 ? 3 : 2, questionKind: "exercise", source: "challenge",
    });
  }
  return events;
}

export type ReinforceHit = { conceptId: string; expedition: Expedition; attempt: ExpeditionAttempt };

/**
 * Conceptos con nota 0 en un intento de misión de los últimos 7 días, con la
 * misión y el intento (el más reciente) que lo motivan. Sin duplicados por concepto.
 */
export function reinforceHits(expeditions: readonly Expedition[], state: UserState, now: Date): ReinforceHit[] {
  const today = dayKey(now);
  const byConcept = new Map<string, ReinforceHit>();
  for (const exp of expeditions) {
    for (const attempt of state.expeditions?.[exp.id] ?? []) {
      const at = attempt.endedAt ?? attempt.startedAt;
      if (daysBetween(dayKey(at), today) > REINFORCE_WINDOW_DAYS) continue;
      for (const [conceptId, score] of bestScoresByConcept(exp, attempt)) {
        if (score !== 0) continue;
        const current = byConcept.get(conceptId);
        const currentAt = current ? (current.attempt.endedAt ?? current.attempt.startedAt) : undefined;
        if (!current || at > currentAt!) byConcept.set(conceptId, { conceptId, expedition: exp, attempt });
      }
    }
  }
  return [...byConcept.values()];
}

/** Ids de los conceptos con nota 0 en un intento de misión de los últimos 7 días. */
export function reinforceFrom(expeditions: readonly Expedition[], state: UserState, now: Date): string[] {
  return reinforceHits(expeditions, state, now).map((h) => h.conceptId);
}
