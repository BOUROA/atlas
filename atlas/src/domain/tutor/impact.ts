// Impacto de cada concepto en el grafo de requisitos, memoizado por índice de
// catálogo: el catálogo es inmutable, así que cada concepto se recorre una vez.
import type { CatalogIndex } from "../catalog";
import { dependentsDeep, neededIn } from "../graph";

export type ConceptImpact = {
  /** Nº de conceptos que dependen de él transitivamente ("desbloquea"). */
  dependents: number;
  /** Asignaturas ajenas donde se necesita (orden de `neededIn`). */
  neededIn: string[];
  /** 0,5·log2(1 + dependientes) + 0,5·nº de asignaturas donde se necesita. */
  score: number;
};

const cache = new WeakMap<CatalogIndex, Map<string, ConceptImpact>>();

export function conceptImpact(index: CatalogIndex, id: string): ConceptImpact {
  let byId = cache.get(index);
  if (!byId) {
    byId = new Map();
    cache.set(index, byId);
  }
  const known = byId.get(id);
  if (known) return known;
  const dependents = dependentsDeep(index, id).length;
  const subjects = neededIn(index, id).map((n) => n.subjectId);
  const impact = { dependents, neededIn: subjects, score: 0.5 * Math.log2(1 + dependents) + 0.5 * subjects.length };
  byId.set(id, impact);
  return impact;
}
