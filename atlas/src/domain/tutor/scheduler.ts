// Envoltorio fino sobre ts-fsrs: una tarjeta por concepto, sin fuzz ni pasos
// de aprendizaje a corto plazo, para que la reproducción de eventos sea
// determinista.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from "ts-fsrs";
import type { Grade } from "../types";

export type Scheduler = {
  init(at: Date): Card;
  next(card: Card, at: Date, grade: Grade): Card;
  /** Recuperabilidad R (0–1) en `at`; 0 para una tarjeta sin repasar. */
  retrievability(card: Card, at: Date): number;
};

const ratings = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy } as const;

export function createScheduler(desiredRetention = 0.9): Scheduler {
  const f = fsrs(generatorParameters({ request_retention: desiredRetention, enable_fuzz: false, enable_short_term: false }));
  return {
    init: (at) => createEmptyCard(at),
    next: (card, at, grade) => f.next(card, at, ratings[grade]).card,
    retrievability: (card, at) => (card.state === State.New ? 0 : Number(f.get_retrievability(card, at, false))),
  };
}
