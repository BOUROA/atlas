// Previsión de preparación para una evaluación (especificación §6.2): frescura
// media esperada el día del examen si no se repasa nada más. Puro.
import type { CatalogIndex } from "../catalog";
import { dayKey, parseDayKey } from "../time";
import type { Assessment } from "../types";
import { progressOf, type ConceptProgress } from "./mastery";
import type { Scheduler } from "./scheduler";

/** Frescura supuesta de un concepto visto que aún no tiene tarjeta FSRS. */
const SEEN_WITHOUT_CARD = 0.2;
/** Hora local a la que se evalúa la frescura el día del examen. */
const EXAM_HOUR = 9;
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export type Readiness = {
  /** Conceptos de los temas evaluados y sus requisitos directos de fuera de esos temas. */
  conceptIds: string[];
  /** Media de la frescura prevista en la fecha del examen (0–1). */
  expected: number;
  /** Proporción de esos conceptos con nivel ≥ 2 (0–1). */
  coverage: number;
};

export type ReadinessInput = {
  index: CatalogIndex;
  progress: ReadonlyMap<string, ConceptProgress>;
  scheduler: Scheduler;
  assessment: Assessment;
};

/** Conceptos que entran en una evaluación: los de sus temas y, después, sus bases directas externas. */
export function assessmentConcepts(index: CatalogIndex, assessment: Assessment): string[] {
  const own: string[] = [];
  for (const unitId of assessment.unitIds) for (const c of index.conceptsByUnit.get(unitId) ?? []) own.push(c.id);
  const inScope = new Set(own);
  const external = new Set<string>();
  for (const id of own) {
    for (const req of index.requiresOf.get(id) ?? []) if (!inScope.has(req)) external.add(req);
  }
  const rank = (id: string) => index.syllabusRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...new Set(own)].sort((a, b) => rank(a) - rank(b)).concat([...external].sort((a, b) => rank(a) - rank(b)));
}

/**
 * Preparación prevista para `assessment`. La frescura se evalúa a las 09:00
 * (hora local) del día del examen; sin fecha, se usa la frescura actual de
 * `progress`. Nivel 0 cuenta 0 y un concepto visto sin tarjeta, 0,2.
 */
export function examReadiness({ index, progress, scheduler, assessment }: ReadinessInput): Readiness {
  const conceptIds = assessmentConcepts(index, assessment);
  if (conceptIds.length === 0) return { conceptIds, expected: 0, coverage: 0 };

  let at: Date | null = null;
  if (assessment.date) {
    at = parseDayKey(dayKey(assessment.date));
    at.setHours(EXAM_HOUR);
  }
  let sum = 0;
  let covered = 0;
  for (const id of conceptIds) {
    const p = progressOf(progress, id);
    if (p.level >= 2) covered++;
    if (p.card) sum += clamp01(at ? scheduler.retrievability(p.card, at) : (p.retrievability ?? 0));
    else if (p.level >= 1) sum += SEEN_WITHOUT_CARD;
  }
  return { conceptIds, expected: sum / conceptIds.length, coverage: covered / conceptIds.length };
}
