// Estrellas guía: leyendas (referentes históricos) y perfiles destacados,
// mostrados como constelaciones sobre el progreso del usuario. Puro.
import type { Legend, Profile } from "./types";
import { progressOf, type ConceptProgress } from "./tutor/mastery";

/** Nivel a partir del cual un concepto de la ruta cuenta como "encendido". */
const LIT_LEVEL = 2;
/** Nivel a partir del cual cuenta como "dominado" (constelación de oro). */
const MASTER_LEVEL = 3;

export type ConstellationProgress = {
  /** Conceptos de la ruta/territorio a nivel ≥ 2. */
  done: number;
  total: number;
  ratio: number;
  /** Toda la ruta a nivel ≥ 2. */
  completed: boolean;
  /** Toda la ruta a nivel 3 (dominada): constelación de oro. */
  golden: boolean;
};

function routeProgress(conceptIds: readonly string[], progress: ReadonlyMap<string, ConceptProgress>): ConstellationProgress {
  const total = conceptIds.length;
  if (total === 0) return { done: 0, total: 0, ratio: 0, completed: false, golden: false };
  const done = conceptIds.filter((id) => progressOf(progress, id).level >= LIT_LEVEL).length;
  const golden = conceptIds.every((id) => progressOf(progress, id).level >= MASTER_LEVEL);
  return { done, total, ratio: done / total, completed: done === total, golden };
}

/** Progreso de la constelación de una leyenda, sobre su `route`. */
export const legendProgress = (legend: Legend, progress: ReadonlyMap<string, ConceptProgress>): ConstellationProgress =>
  routeProgress(legend.route, progress);

/** Progreso de la constelación de un perfil destacado, sobre su `territory`. */
export const profileProgress = (profile: Profile, progress: ReadonlyMap<string, ConceptProgress>): ConstellationProgress =>
  routeProgress(profile.territory, progress);
