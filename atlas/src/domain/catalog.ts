// Catálogo global: une los ficheros de asignatura, lo valida y construye un
// índice de consulta inmutable. Puro: sin React ni DOM.
import type { Catalog, CatalogConcept, CatalogUnit, RelationType, Subject, SubjectContent } from "./types";

/**
 * Une los ficheros de contenido en un catálogo único: añade `subjectId` a temas y
 * conceptos y concatena las relaciones. Lanza `Error` (con el id culpable en el
 * mensaje) si un fichero no tiene asignatura, un tema o concepto está duplicado,
 * un concepto está en un tema que no es de su asignatura, un `alsoIn` apunta a
 * una asignatura desconocida o una relación apunta a un concepto inexistente.
 */
export function buildCatalog(subjects: Subject[], files: SubjectContent[]): Catalog {
  const subjectIds = new Set(subjects.map((s) => s.id));
  const units: CatalogUnit[] = [];
  const concepts: CatalogConcept[] = [];
  const unitIds = new Set<string>();
  const conceptIds = new Set<string>();

  for (const file of files) {
    const { subjectId } = file;
    if (!subjectIds.has(subjectId)) throw new Error(`Catálogo: el fichero de "${subjectId}" no corresponde a ninguna asignatura`);
    const ownUnits = new Set<string>();
    for (const unit of file.units) {
      if (unitIds.has(unit.id)) throw new Error(`Catálogo: tema duplicado "${unit.id}"`);
      unitIds.add(unit.id);
      ownUnits.add(unit.id);
      units.push({ ...unit, subjectId });
    }
    for (const concept of file.concepts) {
      if (conceptIds.has(concept.id)) throw new Error(`Catálogo: concepto duplicado "${concept.id}"`);
      if (!ownUnits.has(concept.unitId)) {
        throw new Error(`Catálogo: el concepto "${concept.id}" está en el tema "${concept.unitId}", que no es de "${subjectId}"`);
      }
      const unknown = concept.alsoIn.find((a) => !subjectIds.has(a.subjectId));
      if (unknown) throw new Error(`Catálogo: el concepto "${concept.id}" declara alsoIn en la asignatura desconocida "${unknown.subjectId}"`);
      conceptIds.add(concept.id);
      concepts.push({ ...concept, subjectId });
    }
  }

  const relations = files.flatMap((f) => f.relations);
  for (const r of relations) {
    for (const end of [r.source, r.target]) {
      if (!conceptIds.has(end)) throw new Error(`Catálogo: la relación ${r.source} -${r.type}-> ${r.target} apunta al concepto inexistente "${end}"`);
    }
  }
  return { subjects, units, concepts, relations };
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
const relationKey = (source: string, type: RelationType, target: string) => `${type} ${source} ${target}`;

/** Índice de solo lectura sobre un catálogo ya validado por `buildCatalog`. */
export class CatalogIndex {
  readonly catalog: Catalog;
  /** Asignaturas ordenadas por `order`. */
  readonly subjects: readonly Subject[];
  readonly subjectById: ReadonlyMap<string, Subject>;
  readonly unitById: ReadonlyMap<string, CatalogUnit>;
  readonly conceptById: ReadonlyMap<string, CatalogConcept>;
  /** Temas de cada asignatura por `number` (lista vacía si no tiene). */
  readonly unitsBySubject: ReadonlyMap<string, readonly CatalogUnit[]>;
  /** Conceptos de cada tema por `order` (lista vacía si no tiene). */
  readonly conceptsByUnit: ReadonlyMap<string, readonly CatalogConcept[]>;
  /** Posición global en orden de temario: asignatura (`order`), tema (`number`), concepto (`order`). */
  readonly syllabusRank: ReadonlyMap<string, number>;
  /** Requisitos directos (`requires`) de cada concepto, en orden de temario. */
  readonly requiresOf: ReadonlyMap<string, readonly string[]>;
  /** Conceptos que requieren directamente a cada concepto, en orden de temario. */
  readonly requiredBy: ReadonlyMap<string, readonly string[]>;
  /** Relaciones `related`, simétricas, en orden de temario. */
  readonly relatedOf: ReadonlyMap<string, readonly string[]>;

  private readonly conceptsBySubject: ReadonlyMap<string, readonly CatalogConcept[]>;
  private readonly reasons: ReadonlyMap<string, string>;

  constructor(catalog: Catalog) {
    this.catalog = catalog;
    this.subjects = [...catalog.subjects].sort(byOrder);
    this.subjectById = new Map(this.subjects.map((s) => [s.id, s]));
    this.unitById = new Map(catalog.units.map((u) => [u.id, u]));
    this.conceptById = new Map(catalog.concepts.map((c) => [c.id, c]));

    const unitsBySubject = new Map<string, CatalogUnit[]>(this.subjects.map((s) => [s.id, []]));
    for (const u of catalog.units) unitsBySubject.get(u.subjectId)?.push(u);
    for (const list of unitsBySubject.values()) list.sort((a, b) => a.number - b.number);
    this.unitsBySubject = unitsBySubject;

    const conceptsByUnit = new Map<string, CatalogConcept[]>(catalog.units.map((u) => [u.id, []]));
    for (const c of catalog.concepts) conceptsByUnit.get(c.unitId)?.push(c);
    for (const list of conceptsByUnit.values()) list.sort(byOrder);
    this.conceptsByUnit = conceptsByUnit;

    const conceptsBySubject = new Map<string, CatalogConcept[]>();
    const syllabusRank = new Map<string, number>();
    for (const s of this.subjects) {
      const list = unitsBySubject.get(s.id)!.flatMap((u) => conceptsByUnit.get(u.id)!);
      conceptsBySubject.set(s.id, list);
      for (const c of list) syllabusRank.set(c.id, syllabusRank.size);
    }
    this.conceptsBySubject = conceptsBySubject;
    this.syllabusRank = syllabusRank;

    const requiresOf = new Map<string, string[]>();
    const requiredBy = new Map<string, string[]>();
    const relatedOf = new Map<string, string[]>();
    for (const c of catalog.concepts) {
      requiresOf.set(c.id, []);
      requiredBy.set(c.id, []);
      relatedOf.set(c.id, []);
    }
    const link = (map: Map<string, string[]>, from: string, to: string) => {
      const list = map.get(from)!;
      if (!list.includes(to)) list.push(to);
    };
    const reasons = new Map<string, string>();
    for (const r of catalog.relations) {
      reasons.set(relationKey(r.source, r.type, r.target), r.reason);
      if (r.type === "requires") {
        link(requiresOf, r.source, r.target);
        link(requiredBy, r.target, r.source);
      } else {
        link(relatedOf, r.source, r.target);
        link(relatedOf, r.target, r.source);
      }
    }
    const bySyllabus = (a: string, b: string) => syllabusRank.get(a)! - syllabusRank.get(b)!;
    for (const map of [requiresOf, requiredBy, relatedOf]) for (const list of map.values()) list.sort(bySyllabus);
    this.requiresOf = requiresOf;
    this.requiredBy = requiredBy;
    this.relatedOf = relatedOf;
    this.reasons = reasons;
  }

  /** Motivo de una relación; `related` se busca en ambos sentidos. */
  reason(source: string, type: RelationType, target: string): string | undefined {
    return this.reasons.get(relationKey(source, type, target))
      ?? (type === "related" ? this.reasons.get(relationKey(target, type, source)) : undefined);
  }

  /** Conceptos propios de la asignatura, en orden de tema y de `order`. */
  conceptsOfSubject(subjectId: string): readonly CatalogConcept[] {
    return this.conceptsBySubject.get(subjectId) ?? [];
  }

  /** Asignatura propietaria seguida de las de `alsoIn`, sin repetir. */
  subjectsOfConcept(id: string): string[] {
    const concept = this.conceptById.get(id);
    if (!concept) return [];
    return [...new Set([concept.subjectId, ...concept.alsoIn.map((a) => a.subjectId)])];
  }
}
