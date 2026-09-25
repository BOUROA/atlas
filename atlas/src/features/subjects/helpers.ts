// Cálculos y formatos compartidos por la lista y el detalle de asignaturas.
// Puro donde se puede: solo lee el catálogo (inmutable), nunca el store.
import type { CatalogUnit } from "../../domain/types";
import type { ConceptProgress } from "../../domain/tutor/mastery";
import { catalog } from "../../state/catalog";

/** Nivel a partir del cual un concepto cuenta como "encendido" (dominio de asignatura, ritmo del 10…). */
export const LIT_LEVEL = 2;

const gradeFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
/** Cifra académica con como mínimo un decimal: 9 → "9,0" · 9.7 → "9,7" · 9.714 → "9,71". */
export const gradeNum = (n: number): string => gradeFmt.format(n);
/** Como gradeNum, pero sin decimales si la cifra es entera (el objetivo dentro de una frase: "El 10 ya no es posible"). */
export const targetNum = (n: number): string => (Number.isInteger(n) ? String(n) : gradeNum(n));

export type SubjectStats = {
  total: number;
  seen: number;
  lit: number;
  domainRatio: number;
  /** Media de frescura (retrievability) de los conceptos con tarjeta; null si ninguno tiene aún. */
  freshnessAvg: number | null;
};

/** Dominio, vistos y frescura media de una asignatura, a partir del progreso ya derivado (useDerived). */
export function subjectStats(subjectId: string, progress: ReadonlyMap<string, ConceptProgress>): SubjectStats {
  const concepts = catalog.conceptsOfSubject(subjectId);
  let seen = 0;
  let lit = 0;
  let freshSum = 0;
  let freshCount = 0;
  for (const c of concepts) {
    const p = progress.get(c.id);
    if (!p) continue;
    if (p.level >= 1) seen++;
    if (p.level >= LIT_LEVEL) lit++;
    if (p.retrievability != null) {
      freshSum += p.retrievability;
      freshCount++;
    }
  }
  return {
    total: concepts.length,
    seen,
    lit,
    domainRatio: concepts.length > 0 ? lit / concepts.length : 0,
    freshnessAvg: freshCount > 0 ? freshSum / freshCount : null,
  };
}

export const unitTitle = (subjectId: string, number: number): string =>
  (catalog.unitsBySubject.get(subjectId) ?? []).find((u) => u.number === number)?.title ?? `Tema ${number}`;

/** true si el tema ya está alcanzado por "voy por el tema N" (el tema 0, introductorio, siempre lo está). */
export const unitReached = (unit: CatalogUnit, currentUnit: number): boolean => unit.number === 0 || unit.number <= currentUnit;

export const CURSO_LABEL: Record<number, string> = { 1: "1.º curso", 2: "2.º curso", 3: "3.º curso", 4: "4.º curso" };

const KIND_LABEL: Record<string, string> = {
  concepto: "Concepto",
  definicion: "Definición",
  teorema: "Teorema",
  metodo: "Método",
  algoritmo: "Algoritmo",
  estructura: "Estructura",
  herramienta: "Herramienta",
};
export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? kind;

const ASSESSMENT_LABEL: Record<string, string> = {
  parcial: "Parcial",
  final: "Examen final",
  entrega: "Entrega",
  practica: "Práctica",
  otro: "Otro",
};
export const assessmentKindLabel = (kind: string): string => ASSESSMENT_LABEL[kind] ?? kind;
