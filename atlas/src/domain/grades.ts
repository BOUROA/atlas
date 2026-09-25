// Calculadora de notas: pura, sin React ni DOM. Ver
// docs/superpowers/specs/2026-09-24-atlas-v2-design.md.

import type { Assessment } from "./types";

export type GradeStatus = "empty" | "possible" | "impossible" | "secured" | "done";

export type GradeSummary = {
  status: GradeStatus;
  /** Suma de `weight/100 * grade` de las evaluaciones ya calificadas (0-10). */
  weighted: number;
  /** Suma de los pesos (0-100) de las evaluaciones ya calificadas. */
  gradedWeight: number;
  /** Suma de los pesos (0-100) de las evaluaciones aún sin calificar. */
  remainingWeight: number;
  /** Media (0-10) de lo calificado hasta ahora; `null` si nada tiene nota todavía. */
  currentAverage: number | null;
  /** Nota máxima alcanzable si el resto se saca un 10. */
  maxPossible: number;
  /** Nota necesaria en el peso restante para llegar al objetivo; `null` si no aplica. */
  needed: number | null;
  /** Nota final una vez que no queda peso pendiente; `null` si aún queda algo por calificar. */
  final: number | null;
  /** true si los pesos de todas las evaluaciones no suman 100 (± 0.01). */
  weightWarning: boolean;
};

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Resume el estado de las evaluaciones de una asignatura frente a una nota objetivo (0-10). */
export const gradeSummary = (assessments: Assessment[], target: number): GradeSummary => {
  const totalWeight = assessments.reduce((sum, x) => sum + x.weight, 0);
  const weightWarning = Math.abs(totalWeight - 100) > 0.01;

  if (assessments.length === 0) {
    return {
      status: "empty",
      weighted: 0,
      gradedWeight: 0,
      remainingWeight: 0,
      currentAverage: null,
      maxPossible: 0,
      needed: null,
      final: null,
      weightWarning,
    };
  }

  const graded = assessments.filter((x) => x.grade !== undefined);
  const gradedWeight = graded.reduce((sum, x) => sum + x.weight, 0);
  const remainingWeight = totalWeight - gradedWeight;

  const weighted = round2(graded.reduce((sum, x) => sum + (x.weight / 100) * (x.grade as number), 0));
  const currentAverage = gradedWeight > 0 ? round2((weighted / gradedWeight) * 100) : null;
  const maxPossible = round2(weighted + remainingWeight / 10);

  if (remainingWeight <= 0) {
    return {
      status: "done",
      weighted,
      gradedWeight,
      remainingWeight,
      currentAverage,
      maxPossible,
      needed: null,
      final: weighted,
      weightWarning,
    };
  }

  const needed = round2((target - weighted) / (remainingWeight / 100));
  if (needed <= 0) {
    return {
      status: "secured",
      weighted,
      gradedWeight,
      remainingWeight,
      currentAverage,
      maxPossible,
      needed: 0,
      final: null,
      weightWarning,
    };
  }
  if (needed > 10) {
    return {
      status: "impossible",
      weighted,
      gradedWeight,
      remainingWeight,
      currentAverage,
      maxPossible,
      needed: null,
      final: null,
      weightWarning,
    };
  }
  return {
    status: "possible",
    weighted,
    gradedWeight,
    remainingWeight,
    currentAverage,
    maxPossible,
    needed,
    final: null,
    weightWarning,
  };
};
