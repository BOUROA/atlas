// Ritmo del 10: compara el avance real de una asignatura con un ritmo lineal
// entre el inicio de curso (settings.courseStart, por defecto
// DEFAULT_COURSE_START) y 10 días antes de su próxima evaluación con fecha
// (o DEFAULT_FINAL_DAY si no tiene ninguna). Puro; `now` llega como parámetro.
import type { CatalogIndex } from "./catalog";
import { courseStartOf, DEFAULT_FINAL_DAY } from "./route";
import { addDays, dayKey, daysBetween, parseDayKey } from "./time";
import { subjectStateOf, type UserState } from "./types";
import { progressOf, type ConceptProgress } from "./tutor/mastery";

/** Días de margen antes de la evaluación que marca el objetivo. */
const LEAD_DAYS = 10;
/** Nivel a partir del cual un concepto cuenta como "avanzado". */
const DONE_LEVEL = 2;

export type Pace10 = {
  /** Proporción esperada hoy si el avance fuera lineal (0–1). */
  expected: number;
  /** Proporción real de conceptos de la asignatura a nivel ≥ 2 (0–1). */
  actual: number;
  /** Días de adelanto (positivo) o de retraso (negativo) sobre el ritmo lineal. */
  daysAhead: number;
};

/** Primer día de la evaluación con fecha ≥ hoy más cercana de la asignatura, o `undefined` si no hay ninguna. */
function nextAssessmentDay(state: UserState, subjectId: string, today: string): string | undefined {
  let best: string | undefined;
  for (const a of subjectStateOf(state, subjectId).assessments) {
    if (!a.date) continue;
    const day = dayKey(a.date);
    if (day < today) continue;
    if (!best || day < best) best = day;
  }
  return best;
}

/**
 * Ritmo del 10 de una asignatura en `now`: `expected` crece linealmente desde
 * 0 en `courseStartOf(state.settings)` hasta 1 diez días antes de su próxima
 * evaluación con fecha (o `DEFAULT_FINAL_DAY` si no tiene ninguna), acotado a
 * [0, 1]. `actual` es la proporción de sus conceptos a nivel ≥ 2. `daysAhead`
 * es `(actual − expected)` convertido a días sobre el total del tramo.
 */
export function pace10(
  index: CatalogIndex,
  state: UserState,
  progress: ReadonlyMap<string, ConceptProgress>,
  subjectId: string,
  now: Date,
): Pace10 {
  const today = dayKey(now);
  const start = courseStartOf(state.settings);
  const examDay = nextAssessmentDay(state, subjectId, today) ?? DEFAULT_FINAL_DAY;
  const targetDay = dayKey(addDays(parseDayKey(examDay), -LEAD_DAYS));

  const totalDays = daysBetween(start, targetDay);
  const elapsedDays = daysBetween(start, today);
  const expected = totalDays > 0 ? Math.max(0, Math.min(1, elapsedDays / totalDays)) : elapsedDays >= 0 ? 1 : 0;

  const concepts = index.conceptsOfSubject(subjectId);
  const actual = concepts.length > 0
    ? concepts.filter((c) => progressOf(progress, c.id).level >= DONE_LEVEL).length / concepts.length
    : 0;

  const daysAhead = Math.round((actual - expected) * totalDays);
  return { expected, actual, daysAhead };
}
