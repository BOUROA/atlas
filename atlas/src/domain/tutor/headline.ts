// Titular del tutor para la pantalla Hoy: una frase que resume la cola. Puro.
import type { CatalogIndex } from "../catalog";
import type { UserState } from "../types";
import { upcomingAssessments, type QueueItem, type QueueResult } from "./queue";
import { lowerFirst } from "./text";

export type HeadlineInput = { index: CatalogIndex; state: UserState; queue: QueueResult; now: Date };

/** Días hasta una evaluación para que el titular la mencione. */
const HEADLINE_EXAM_DAYS = 30;

const count = (items: readonly QueueItem[], type: QueueItem["type"]) => items.filter((i) => i.type === type).length;

/**
 * "Hoy toca afianzar Cálculo: parcial 1 en 23 días." si la asignatura con más
 * minutos en el plan tiene una evaluación en ≤ 30 días; si no, habla de los
 * repasos que se apagan, de los primeros recuerdos o de las estrellas nuevas.
 */
export function tutorHeadline({ index, state, queue, now }: HeadlineInput): string {
  if (queue.items.length === 0) return "Todo al día. Buen momento para adelantar temario o practicar ejercicios.";
  const items = queue.planned.length > 0 ? queue.planned : queue.items;

  const upcoming = upcomingAssessments(index, state, now);
  const minutes = new Map<string, number>();
  for (const item of items) {
    const owner = index.conceptById.get(item.conceptId)?.subjectId;
    if (owner) minutes.set(owner, (minutes.get(owner) ?? 0) + item.minutes);
  }
  const examDays = (sid: string) => upcoming.get(sid)?.[0]?.days ?? Number.POSITIVE_INFINITY;
  const order = (sid: string) => index.subjectById.get(sid)?.order ?? Number.MAX_SAFE_INTEGER;
  const top = [...minutes.keys()].sort((a, b) =>
    minutes.get(b)! - minutes.get(a)! || examDays(a) - examDays(b) || order(a) - order(b))[0];

  const exam = top === undefined ? undefined : upcoming.get(top)?.[0];
  if (exam && exam.days <= HEADLINE_EXAM_DAYS) {
    const short = index.subjectById.get(exam.subjectId)?.shortName ?? exam.subjectId;
    const title = lowerFirst(exam.assessment.title.trim() || "Evaluación");
    const when = exam.days <= 0 ? `hoy tienes ${title}` : exam.days === 1 ? `mañana tienes ${title}` : `${title} en ${exam.days} días`;
    return `Hoy toca afianzar ${short}: ${when}.`;
  }
  const reviews = count(items, "review");
  if (reviews > 0) {
    return reviews === 1
      ? "Hoy toca rescatar un concepto que se está apagando."
      : `Hoy toca rescatar ${reviews} conceptos que se están apagando.`;
  }
  const first = count(items, "first");
  if (first > 0) {
    return first === 1
      ? "Hoy toca asentar un concepto que acabas de ver."
      : `Hoy toca asentar ${first} conceptos que acabas de ver.`;
  }
  const fresh = count(items, "new");
  return fresh === 1 ? "Hoy puedes encender una estrella nueva." : `Hoy puedes encender ${fresh} estrellas nuevas.`;
}
