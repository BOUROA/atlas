// Niveles de dominio (0–3) y tarjeta FSRS de cada concepto, derivados
// reproduciendo el registro de eventos en orden (especificación §6.1 y §6.2).
import type { Card } from "ts-fsrs";
import type { Grade, Level, QuestionKind, StudyEvent } from "../types";
import { dayKey, daysBetween } from "../time";
import type { Scheduler } from "./scheduler";

export type LevelUp = { at: string; level: 2 | 3 };
export type ConceptProgress = {
  conceptId: string;
  level: Level;
  /** Nivel 2 por "Ya lo domino", pendiente de que un acierto posterior lo confirme. */
  declared: boolean;
  /** Primer evento que cuenta como "visto" (`seen`, `review` o `declared`). */
  firstAt: string | null;
  lastReviewAt: string | null;
  reviews: number;
  /** Fallos (nota 1) en repasos intentados. */
  lapses: number;
  card: Card | null;
  due: Date | null;
  /** Frescura en `now` (0–1); null si el concepto aún no tiene tarjeta. */
  retrievability: number | null;
  /** Requisito de práctica del nivel 3 cumplido (acierto en `exercise` o `apply`). */
  practicePassed: boolean;
  levelUps: LevelUp[];
};

/** Días naturales mínimos desde el repaso anterior para que un acierto cuente para el nivel 3. */
const LONG_INTERVAL_DAYS = 7;
const PRACTICE_KINDS: ReadonlySet<QuestionKind> = new Set<QuestionKind>(["exercise", "apply"]);

const emptyProgress = (conceptId: string): ConceptProgress => ({
  conceptId, level: 0, declared: false, firstAt: null, lastReviewAt: null, reviews: 0, lapses: 0,
  card: null, due: null, retrievability: null, practicePassed: false, levelUps: [],
});

const byTime = (a: StudyEvent, b: StudyEvent): number => Date.parse(a.at) - Date.parse(b.at);

/**
 * Reproduce los eventos de un concepto (se ordenan por `at`; los empates
 * conservan el orden recibido) y devuelve su progreso en `now`.
 * Todos los eventos deben pertenecer a `conceptId`.
 */
export function replayConcept(conceptId: string, events: readonly StudyEvent[], scheduler: Scheduler, now: Date): ConceptProgress {
  const p = emptyProgress(conceptId);
  // Día desde el que cuenta el "día natural posterior" para (re)ganar el nivel 2.
  let eligibleAfterDay: string | null = null;
  let longPassed = false;
  let prevReviewAt: string | null = null;

  const levelUp = (at: string, level: 2 | 3) => {
    p.level = level;
    p.levelUps.push({ at, level });
  };
  const schedule = (at: Date, grade: Grade) => {
    p.card = scheduler.next(p.card ?? scheduler.init(at), at, grade);
  };

  for (const e of [...events].sort(byTime)) {
    const at = new Date(e.at);
    const day = dayKey(at);

    // El repaso implícito solo refresca la tarjeta: no hace "visto" el concepto.
    if (e.kind === "implicit") {
      schedule(at, e.grade ?? 3);
      continue;
    }
    // Mostrar la respuesta sin intentarlo se programa como nota 1.
    const grade = e.kind === "review" ? (e.attempted === false ? 1 : e.grade) : undefined;
    if (e.kind === "review" && grade === undefined) continue; // repaso sin nota: evento mal formado

    if (p.firstAt === null) {
      p.firstAt = e.at;
      p.level = 1;
      eligibleAfterDay = day;
    }

    if (e.kind === "declared") {
      if (p.level < 2) {
        levelUp(e.at, 2);
        p.declared = true;
      }
      schedule(at, 3);
      continue;
    }
    if (grade === undefined) continue; // `seen`: solo cuenta como visto; lo que queda es un `review`

    p.reviews++;
    schedule(at, grade);
    if (e.attempted !== false) {
      if (grade === 1) {
        p.lapses++;
        if (p.level >= 2) {
          if (p.level === 3) {
            p.practicePassed = false;
            longPassed = false;
          }
          p.level = p.level === 3 ? 2 : 1;
          p.declared = false;
          eligibleAfterDay = day;
        }
      } else if (grade >= 3) {
        p.declared = false;
        if (e.questionKind && PRACTICE_KINDS.has(e.questionKind)) p.practicePassed = true;
        if (prevReviewAt !== null && daysBetween(dayKey(prevReviewAt), day) >= LONG_INTERVAL_DAYS) longPassed = true;
        if (p.level < 2 && eligibleAfterDay !== null && daysBetween(eligibleAfterDay, day) >= 1) levelUp(e.at, 2);
        if (p.level === 2 && p.practicePassed && longPassed) levelUp(e.at, 3);
      }
    }
    prevReviewAt = e.at;
    p.lastReviewAt = e.at;
  }

  p.due = p.card?.due ?? null;
  p.retrievability = p.card ? scheduler.retrievability(p.card, now) : null;
  return p;
}

/** Progreso de todos los conceptos con eventos, agrupando por `conceptId`. */
export function deriveProgress(events: readonly StudyEvent[], scheduler: Scheduler, now: Date): Map<string, ConceptProgress> {
  const byConcept = new Map<string, StudyEvent[]>();
  for (const e of events) {
    const list = byConcept.get(e.conceptId);
    if (list) list.push(e);
    else byConcept.set(e.conceptId, [e]);
  }
  const progress = new Map<string, ConceptProgress>();
  for (const [conceptId, list] of byConcept) progress.set(conceptId, replayConcept(conceptId, list, scheduler, now));
  return progress;
}

/** Progreso de un concepto, o el de nivel 0 si no tiene eventos. */
export const progressOf = (progress: ReadonlyMap<string, ConceptProgress>, conceptId: string): ConceptProgress =>
  progress.get(conceptId) ?? emptyProgress(conceptId);
