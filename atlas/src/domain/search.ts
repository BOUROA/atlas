// Búsqueda de conceptos por nombre o alias, insensible a acentos y mayúsculas.
// Puro: sin React ni DOM.
import type { CatalogIndex } from "./catalog";

/** NFD, quita diacríticos, minúsculas, colapsa espacios, trim. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const ALIAS_PENALTY = 5;

/** Puntuación de `text` (ya normalizado) frente a `query` (ya normalizada, no vacía). */
function scoreText(text: string, query: string): number {
  if (text === query) return 100;
  if (text.startsWith(query)) return 80;
  const textWords = text.split(" ").filter(Boolean);
  const queryWords = query.split(" ").filter(Boolean);
  if (queryWords.every((qw) => textWords.some((tw) => tw.startsWith(qw)))) return 60;
  if (text.includes(query)) return 40;
  if (queryWords.every((qw) => text.includes(qw))) return 30;
  return 0;
}

/**
 * Busca conceptos por nombre o alias. Puntuación por concepto = máximo entre el
 * nombre y cada alias (los alias restan `ALIAS_PENALTY`). Desempate: nombre más
 * corto, luego `order` de asignatura. Devuelve como mucho `limit` ids.
 */
export function searchConcepts(index: CatalogIndex, query: string, limit = 20): string[] {
  const q = normalize(query);
  if (q === "") return [];

  const scored: { id: string; score: number; nameLength: number; subjectOrder: number }[] = [];
  for (const concept of index.catalog.concepts) {
    const nameScore = scoreText(normalize(concept.name), q);
    let best = nameScore;
    for (const alias of concept.aliases) {
      const aliasScore = scoreText(normalize(alias), q) - ALIAS_PENALTY;
      if (aliasScore > best) best = aliasScore;
    }
    if (best <= 0) continue;
    const subjectOrder = index.subjectById.get(concept.subjectId)?.order ?? Number.MAX_SAFE_INTEGER;
    scored.push({ id: concept.id, score: best, nameLength: concept.name.length, subjectOrder });
  }

  scored.sort((a, b) => b.score - a.score || a.nameLength - b.nameLength || a.subjectOrder - b.subjectOrder);
  return scored.slice(0, limit).map((s) => s.id);
}
