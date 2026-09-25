// "Adelantar": conceptos que otra asignatura ya necesita y la suya aún no ha
// dado (p. ej. Autovalores cuando Preprocesamiento llega a PCA). Puro.
import type { CatalogIndex } from "../catalog";
import { subjectStateOf, type UserState } from "../types";

export type NeededEarly = {
  /** Concepto que llega tarde en su asignatura. */
  conceptId: string;
  /** Asignatura que ya lo necesita. */
  bySubject: string;
  /** Primer concepto (orden de temario) de `bySubject` que lo requiere directamente. */
  via: string;
};

/** Asignatura con temario en marcha: `current` o con estado propio guardado. */
export const isSubjectInProgress = (index: CatalogIndex, state: UserState, subjectId: string): boolean =>
  index.subjectById.get(subjectId)?.status === "current" || subjectId in state.subjects;

/**
 * Conceptos `X` cuyo tema va por delante del "voy por el tema N" de su
 * asignatura y que requiere directamente un concepto `Y` de otra asignatura
 * (en marcha) cuyo tema ya se ha alcanzado, más el cierre transitivo: si `X`
 * se adelanta y un requisito directo suyo `P` de su misma asignatura está en
 * un tema todavía no alcanzado, `P` también se adelanta (con `via` = `X`),
 * recursivamente. Sin duplicados; cada concepto conserva el primer motivo con
 * el que se alcanza (temario de `X`, luego cierre transitivo en profundidad).
 */
export function neededEarly(index: CatalogIndex, state: UserState): NeededEarly[] {
  const unitNumber = (unitId: string) => index.unitById.get(unitId)?.number ?? Number.POSITIVE_INFINITY;
  /** Tema ya alcanzado: el 0 siempre; en una asignatura que no está en marcha, ninguno. */
  const reached = (subjectId: string, unitId: string) => {
    if (!isSubjectInProgress(index, state, subjectId)) return false;
    const n = unitNumber(unitId);
    return n === 0 || n <= subjectStateOf(state, subjectId).currentUnit;
  };
  const base: NeededEarly[] = [];
  for (const s of index.subjects) {
    for (const x of index.conceptsOfSubject(s.id)) {
      if (reached(s.id, x.unitId)) continue;
      for (const yId of index.requiredBy.get(x.id) ?? []) {
        const y = index.conceptById.get(yId);
        if (!y || y.subjectId === s.id || !reached(y.subjectId, y.unitId)) continue;
        base.push({ conceptId: x.id, bySubject: y.subjectId, via: y.id });
        break;
      }
    }
  }

  // Cierre transitivo: los requisitos directos de X en su propia asignatura,
  // si su tema tampoco está alcanzado, se adelantan también (bySubject = la
  // propia asignatura de X/P: distingue este caso del anterior para el motivo).
  const out: NeededEarly[] = [];
  const seen = new Set<string>();
  const expand = (entry: NeededEarly) => {
    if (seen.has(entry.conceptId)) return;
    seen.add(entry.conceptId);
    out.push(entry);
    const x = index.conceptById.get(entry.conceptId);
    if (!x) return;
    for (const reqId of index.requiresOf.get(entry.conceptId) ?? []) {
      const p = index.conceptById.get(reqId);
      if (!p || p.subjectId !== x.subjectId || seen.has(p.id) || reached(p.subjectId, p.unitId)) continue;
      expand({ conceptId: p.id, bySubject: p.subjectId, via: x.id });
    }
  };
  for (const entry of base) expand(entry);
  return out;
}
