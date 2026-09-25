// Pruebas sintéticas: nota, eventos y refuerzo de un intento (especificación
// §7). Puro y determinista: `now`/`at` llegan siempre como parámetro.
import type { CatalogIndex } from "./catalog";
import { dayKey, daysBetween } from "./time";
import type { Readiness } from "./expeditions";
import type { Grade, StudyEvent, Trial, TrialAttempt, TrialProblem, UserState } from "./types";
import { progressOf, type ConceptProgress } from "./tutor/mastery";

/** Nivel a partir del cual un concepto cuenta como "preparado". */
const READY_LEVEL = 2;
/** Proporción de conceptos preparados a partir de la cual una prueba se considera lista. */
const READY_RATIO = 0.7;
/** Nota (sobre 10) a partir de la cual una prueba se considera superada. */
export const TRIAL_PASS = 7;
/** Ventana de días tras un intento en la que sus fallos siguen proponiéndose para reforzar. */
const REINFORCE_WINDOW_DAYS = 7;
/** Margen para comparar fracciones con `>=` sin que el redondeo de coma flotante las penalice. */
const EPS = 1e-9;

const round2 = (x: number): number => Math.round(x * 100) / 100;
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const totalPoints = (trial: Trial): number => trial.problems.reduce((sum, p) => sum + p.points, 0);

/**
 * Puntos obtenidos de un problema en un intento, acotados a [0, points]. Lo que
 * falta o no es un número finito vale 0 (un NaN guardado se vuelve `null` en el
 * JSON; sin esto envenenaría la nota).
 */
function earnedOf(problem: TrialProblem, attempt: TrialAttempt): number {
  const value = attempt.earned[problem.n];
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, problem.points) : 0;
}

/** Nota (0–10) de un intento: puntos obtenidos sobre el total de la prueba, a escala 10 y con 2 decimales. */
export function trialScore(trial: Trial, attempt: TrialAttempt): number {
  const total = totalPoints(trial);
  if (total <= 0) return 0;
  const earned = trial.problems.reduce((sum, p) => sum + earnedOf(p, attempt), 0);
  return round2((earned / total) * 10);
}

/** Puntos de un problema a partir de los criterios de rúbrica marcados (índices únicos y dentro de rango). */
export function earnedFromChecked(problem: TrialProblem, checked: readonly number[]): number {
  const unique = new Set(checked.filter((i) => i >= 0 && i < problem.rubric.length));
  let sum = 0;
  for (const i of unique) sum += problem.rubric[i].points;
  return sum;
}

/**
 * El intento `attemptId` corregido en `at`: `earned` por problema a partir de los
 * criterios de rúbrica marcados (`earnedFromChecked`) o, si la hay, de la
 * puntuación manual de `overrides` (acotada a [0, points]; si no es un número
 * finito, se ignora). Conserva el `startedAt` de `prev` (sin `prev`, empieza en
 * `at`). `null` si `prev` ya estaba corregido: una corrección no se repite (doble
 * envío), porque sus eventos ya están en el registro con el mismo id.
 */
export function gradedAttempt(
  trial: Trial,
  prev: TrialAttempt | undefined,
  attemptId: string,
  checked: Record<string, number[]>,
  overrides: Record<string, number>,
  at: string,
): TrialAttempt | null {
  if (prev?.endedAt) return null;
  const earned: Record<string, number> = {};
  for (const p of trial.problems) {
    const manual = overrides[p.n];
    earned[p.n] = typeof manual === "number" && Number.isFinite(manual)
      ? clamp(manual, 0, p.points)
      : earnedFromChecked(p, checked[p.n] ?? []);
  }
  return { id: attemptId, startedAt: prev?.startedAt ?? at, endedAt: at, earned, checked };
}

/** Estrellas de una nota: 1 desde 7, 2 desde 8,5 y 3 desde 9,5 (o `null`/sin nota → 0). */
export function starsFor(score: number | null): 0 | 1 | 2 | 3 {
  if (score === null) return 0;
  if (score >= 9.5) return 3;
  if (score >= 8.5) return 2;
  if (score >= TRIAL_PASS) return 1;
  return 0;
}

export type TrialResult = {
  /** Intentos terminados (con `endedAt`); los abiertos no cuentan. */
  attempts: number;
  /** Nota del primer intento terminado (por fecha de fin); honesta, siempre visible. */
  first: number | null;
  /** Mejor nota entre los intentos terminados: decide si la prueba está superada. */
  best: number | null;
  /** Nota del último intento terminado (por fecha de fin). */
  last: number | null;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
};

/** Resultado de una prueba a partir de sus intentos en el estado: primer intento, mejor nota, estrellas y superación. */
export function trialResult(trial: Trial, state: UserState): TrialResult {
  const finished = (state.trials?.[trial.id] ?? []).filter((a) => a.endedAt);
  if (finished.length === 0) return { attempts: 0, first: null, best: null, last: null, stars: 0, passed: false };
  const sorted = [...finished].sort((a, b) => (a.endedAt! < b.endedAt! ? -1 : a.endedAt! > b.endedAt! ? 1 : 0));
  const scores = sorted.map((a) => trialScore(trial, a));
  const best = Math.max(...scores);
  return {
    attempts: finished.length,
    first: scores[0],
    best,
    last: scores[scores.length - 1],
    stars: starsFor(best),
    passed: best >= TRIAL_PASS,
  };
}

/**
 * Mejor fracción (earned/points) de cada concepto entre los problemas que lo
 * evalúan, en orden de primera aparición. Exportada para que la interfaz no la
 * replique (features/trial/helpers.ts tiene hoy una copia).
 */
export function bestFractionByConcept(trial: Trial, attempt: TrialAttempt): Map<string, number> {
  const best = new Map<string, number>();
  for (const p of trial.problems) {
    const fraction = p.points > 0 ? earnedOf(p, attempt) / p.points : 0;
    for (const conceptId of p.concepts) {
      const prev = best.get(conceptId);
      if (prev === undefined || fraction > prev) best.set(conceptId, fraction);
    }
  }
  return best;
}

/**
 * Eventos `review` (`source: "challenge"`, `questionKind: "exercise"`) que corregir una
 * prueba genera: uno por concepto, con la mejor fracción entre los problemas que lo
 * evalúan (≥ 0,8 → nota 3, ≥ 0,5 → nota 2, < 0,5 → nota 1 solo si el concepto ya se
 * había visto, si no ningún evento). En el orden de primera aparición en los problemas.
 */
export function eventsFromTrial(
  trial: Trial,
  attempt: TrialAttempt,
  progress: ReadonlyMap<string, ConceptProgress>,
  at: string,
): StudyEvent[] {
  const fractions = bestFractionByConcept(trial, attempt);
  const order = [...new Set(trial.problems.flatMap((p) => p.concepts))];
  const events: StudyEvent[] = [];
  for (const conceptId of order) {
    const fraction = fractions.get(conceptId)!;
    let grade: Grade | undefined;
    if (fraction >= 0.8 - EPS) grade = 3;
    else if (fraction >= 0.5 - EPS) grade = 2;
    else if (progressOf(progress, conceptId).level >= 1) grade = 1;
    if (grade === undefined) continue;
    events.push({ id: `${attempt.id}~${conceptId}`, at, conceptId, kind: "review", grade, questionKind: "exercise", source: "challenge" });
  }
  return events;
}

export type TrialReinforceHit = { conceptId: string; trial: Trial; attempt: TrialAttempt };

/**
 * Conceptos con fracción < 0,5 en un intento terminado de prueba de los últimos 7
 * días, con la prueba y el intento (el más reciente) que lo motivan. Sin duplicados
 * por concepto.
 */
export function trialReinforceHits(trials: readonly Trial[], state: UserState, now: Date): TrialReinforceHit[] {
  const today = dayKey(now);
  const byConcept = new Map<string, TrialReinforceHit>();
  for (const trial of trials) {
    for (const attempt of state.trials?.[trial.id] ?? []) {
      if (!attempt.endedAt) continue;
      if (daysBetween(dayKey(attempt.endedAt), today) > REINFORCE_WINDOW_DAYS) continue;
      for (const [conceptId, fraction] of bestFractionByConcept(trial, attempt)) {
        if (fraction >= 0.5 - EPS) continue;
        const current = byConcept.get(conceptId);
        const currentAt = current?.attempt.endedAt;
        if (!current || attempt.endedAt! > currentAt!) byConcept.set(conceptId, { conceptId, trial, attempt });
      }
    }
  }
  return [...byConcept.values()];
}

/**
 * Preparación de unos temas: proporción de sus conceptos (vía el catálogo) ya a
 * nivel ≥ 2, lista (`ready`) a partir del 70 %. Temas sin conceptos o desconocidos:
 * lista (ratio 1). Misma regla que `readiness` en expeditions.ts, pero sobre temas
 * en vez de un territorio. La usan las pruebas y los pasos del rumbo (route.ts).
 */
export function unitsReadiness(unitIds: readonly string[], index: CatalogIndex, progress: ReadonlyMap<string, ConceptProgress>): Readiness {
  const ids = unitIds.flatMap((unitId) => (index.conceptsByUnit.get(unitId) ?? []).map((c) => c.id));
  if (ids.length === 0) return { ratio: 1, ready: true, missing: [] };
  const missing = ids.filter((id) => progressOf(progress, id).level < READY_LEVEL);
  const ratio = (ids.length - missing.length) / ids.length;
  return { ratio, ready: ratio >= READY_RATIO, missing };
}

/** Preparación para una prueba: `unitsReadiness` de sus temas. */
export function trialReadiness(trial: Trial, index: CatalogIndex, progress: ReadonlyMap<string, ConceptProgress>): Readiness {
  return unitsReadiness(trial.unitIds, index, progress);
}
