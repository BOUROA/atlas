// Recorridos sobre el grafo de requisitos (`requires`) del catálogo. Puro y determinista.
import type { CatalogIndex } from "./catalog";
import type { AlsoIn } from "./types";

/** Concepto alcanzado en un recorrido, con su distancia mínima al origen. */
export type Reached = { id: string; depth: number };
export type NeededIn = { subjectId: string; via: string[]; role: "depends" | AlsoIn["role"] };
export type Impact = { dependents: number; subjects: number };
export type ExternalBase = { conceptId: string; dependents: string[] };
export type Feed = { subjectId: string; concepts: string[] };

const rankOf = (index: CatalogIndex, id: string) => index.syllabusRank.get(id) ?? Number.MAX_SAFE_INTEGER;
const subjectOrderOf = (index: CatalogIndex, subjectId: string) =>
  index.subjectById.get(subjectId)?.order ?? Number.MAX_SAFE_INTEGER;
const ownerOf = (index: CatalogIndex, id: string) => index.conceptById.get(id)?.subjectId;

/** BFS desde `start` siguiendo `edges`; excluye el origen y ordena por profundidad y temario. */
function reach(index: CatalogIndex, start: string, edges: ReadonlyMap<string, readonly string[]>): Reached[] {
  const depth = new Map<string, number>([[start, 0]]);
  let frontier = [start];
  for (let d = 1; frontier.length > 0; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of edges.get(id) ?? []) {
        if (depth.has(n)) continue;
        depth.set(n, d);
        next.push(n);
      }
    }
    frontier = next;
  }
  depth.delete(start);
  return [...depth]
    .map(([id, d]) => ({ id, depth: d }))
    .sort((a, b) => a.depth - b.depth || rankOf(index, a.id) - rankOf(index, b.id));
}

/** Requisitos transitivos con su profundidad mínima (1 = directo). */
export const prerequisitesDeep = (index: CatalogIndex, id: string): Reached[] => reach(index, id, index.requiresOf);

/** Conceptos que dependen transitivamente de `id`, con su profundidad mínima. */
export const dependentsDeep = (index: CatalogIndex, id: string): Reached[] => reach(index, id, index.requiredBy);

/**
 * Asignaturas ajenas a la propietaria donde se necesita el concepto. Primero las
 * que tienen dependientes transitivos (`via` = esos conceptos por profundidad y
 * temario; role `depends`), después las de `alsoIn` no incluidas ya (via vacío).
 * Dentro de cada grupo: más conceptos vía primero y, a igualdad, `order` de asignatura.
 */
export function neededIn(index: CatalogIndex, id: string): NeededIn[] {
  const owner = ownerOf(index, id);
  const viaBySubject = new Map<string, string[]>();
  for (const { id: dep } of dependentsDeep(index, id)) {
    const subjectId = ownerOf(index, dep);
    if (subjectId === undefined || subjectId === owner) continue;
    const via = viaBySubject.get(subjectId);
    if (via) via.push(dep);
    else viaBySubject.set(subjectId, [dep]);
  }
  const bySizeThenOrder = (a: NeededIn, b: NeededIn) =>
    b.via.length - a.via.length || subjectOrderOf(index, a.subjectId) - subjectOrderOf(index, b.subjectId);

  const depends: NeededIn[] = [...viaBySubject].map(([subjectId, via]) => ({ subjectId, via, role: "depends" as const }));
  const declared: NeededIn[] = [];
  for (const a of index.conceptById.get(id)?.alsoIn ?? []) {
    if (a.subjectId === owner || viaBySubject.has(a.subjectId) || declared.some((d) => d.subjectId === a.subjectId)) continue;
    declared.push({ subjectId: a.subjectId, via: [], role: a.role });
  }
  return [...depends.sort(bySizeThenOrder), ...declared.sort(bySizeThenOrder)];
}

/** Nº de dependientes transitivos y nº de asignaturas ajenas donde se necesita. */
export const impactOf = (index: CatalogIndex, id: string): Impact => ({
  dependents: dependentsDeep(index, id).length,
  subjects: neededIn(index, id).length,
});

/**
 * Capa de cada concepto = camino más largo desde las bases por `requires`
 * (0 sin requisitos; 1 + la mayor capa de sus requisitos). Lanza si hay un ciclo.
 */
export function layers(index: CatalogIndex): Map<string, number> {
  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const known = layer.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) throw new Error(`Grafo: ciclo de requisitos que pasa por "${id}"`);
    visiting.add(id);
    let value = 0;
    for (const req of index.requiresOf.get(id) ?? []) value = Math.max(value, visit(req) + 1);
    visiting.delete(id);
    layer.set(id, value);
    return value;
  };
  for (const c of index.catalog.concepts) visit(c.id);
  return layer;
}

/**
 * Requisitos directos de conceptos de `subjectId` cuyo propietario es otra
 * asignatura. `dependents` = conceptos de `subjectId` que dependen de él
 * transitivamente. Orden: más dependientes primero y, a igualdad, temario.
 */
export function externalBases(index: CatalogIndex, subjectId: string): ExternalBase[] {
  const bases = new Set<string>();
  for (const c of index.conceptsOfSubject(subjectId)) {
    for (const req of index.requiresOf.get(c.id) ?? []) if (ownerOf(index, req) !== subjectId) bases.add(req);
  }
  return [...bases]
    .map((conceptId) => ({
      conceptId,
      dependents: dependentsDeep(index, conceptId).map((d) => d.id).filter((dep) => ownerOf(index, dep) === subjectId),
    }))
    .sort((a, b) => b.dependents.length - a.dependents.length || rankOf(index, a.conceptId) - rankOf(index, b.conceptId));
}

/**
 * Para cada otra asignatura, sus conceptos que requieren directamente algún
 * concepto de `subjectId` (en orden de temario). Orden: más conceptos primero
 * y, a igualdad, `order` de asignatura.
 */
export function feedsInto(index: CatalogIndex, subjectId: string): Feed[] {
  const feeds: Feed[] = [];
  for (const s of index.subjects) {
    if (s.id === subjectId) continue;
    const concepts = index.conceptsOfSubject(s.id)
      .filter((c) => (index.requiresOf.get(c.id) ?? []).some((req) => ownerOf(index, req) === subjectId))
      .map((c) => c.id);
    if (concepts.length > 0) feeds.push({ subjectId: s.id, concepts });
  }
  // `index.subjects` ya va por `order` y el sort es estable: el desempate queda resuelto.
  return feeds.sort((a, b) => b.concepts.length - a.concepts.length);
}
