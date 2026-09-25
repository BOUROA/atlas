// Repaso implícito (especificación §6.2): acertar un concepto refresca los
// requisitos directos que ya se entienden y están a punto de vencer. Puro.
import type { CatalogIndex } from "../catalog";
import { addDays, dayKey } from "../time";
import type { StudyEvent } from "../types";
import { progressOf, type ConceptProgress } from "./mastery";

/** Margen hasta el vencimiento para que un requisito reciba el repaso implícito. */
const DUE_WINDOW_DAYS = 2;

export type ImplicitInput = {
  index: CatalogIndex;
  progress: ReadonlyMap<string, ConceptProgress>;
  /** Repaso que se acaba de registrar. */
  review: StudyEvent;
  /** Registro de eventos (para saber qué se ha repasado ya ese día). */
  events: readonly StudyEvent[];
  now: Date;
};

/**
 * Eventos `implicit` (nota 3) para los requisitos directos de `review.conceptId`
 * con nivel ≥ 2, que vencen como tarde en `now + 2 días` y que no tienen ningún
 * evento en el día de `review.at`. Solo si `review` es un acierto intentado
 * (nota ≥ 3). Orden de temario.
 */
export function implicitEvents({ index, progress, review, events, now }: ImplicitInput): StudyEvent[] {
  if (review.kind !== "review" || review.attempted === false || (review.grade ?? 0) < 3) return [];
  const limit = addDays(now, DUE_WINDOW_DAYS).getTime();
  const candidates = (index.requiresOf.get(review.conceptId) ?? []).filter((id) => {
    const p = progressOf(progress, id);
    return p.level >= 2 && p.due !== null && p.due.getTime() <= limit;
  });
  if (candidates.length === 0) return [];

  const day = dayKey(review.at);
  const wanted = new Set(candidates);
  const touchedToday = new Set<string>();
  for (const e of events) {
    if (wanted.has(e.conceptId) && !touchedToday.has(e.conceptId) && dayKey(e.at) === day) touchedToday.add(e.conceptId);
  }
  return candidates
    .filter((id) => !touchedToday.has(id))
    .map((id) => ({ id: `${review.id}~${id}`, at: review.at, conceptId: id, kind: "implicit", grade: 3, source: review.source }));
}
