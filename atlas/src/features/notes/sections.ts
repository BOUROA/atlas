// Funciones puras sobre el Markdown de los apuntes (docs/apuntes-guia.md): sin
// React ni DOM, para poder testearlas con node:test (tests/notes.test.ts).

export type NoteSection = { id: string; title: string; body: string };
export type NotesDoc = { title: string; intro: string; sections: NoteSection[] };

const norm = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Slug estable: minúsculas, sin tildes, solo [a-z0-9-]. */
function slugify(s: string): string {
  const base = norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "seccion";
}

/**
 * Parte el Markdown de un tema en título (primera línea "# …"), entradilla (lo
 * que va antes de la primera sección) y secciones (líneas "## …" fuera de
 * bloques ```). Cada sección lleva un slug estable y único (si se repite el
 * título, "-2", "-3"…).
 */
export function splitNotes(md: string): NotesDoc {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let start = 0;
  let title = "";
  if (/^#\s+/.test(lines[0] ?? "")) {
    title = lines[0].replace(/^#\s+/, "").trim();
    start = 1;
  }

  type Raw = { title: string; lines: string[] };
  const raws: Raw[] = [];
  const introLines: string[] = [];
  let current: Raw | null = null;
  let inFence = false;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) inFence = !inFence;
    if (!inFence && /^##\s+/.test(line)) {
      current = { title: line.replace(/^##\s+/, "").trim(), lines: [] };
      raws.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else introLines.push(line);
  }

  const seen = new Map<string, number>();
  const sections: NoteSection[] = raws.map((r) => {
    const base = slugify(r.title);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { id: n === 0 ? base : `${base}-${n + 1}`, title: r.title, body: r.lines.join("\n").trim() };
  });

  return { title, intro: introLines.join("\n").trim(), sections };
}

/** Concepto mínimo que necesita `findConceptSection` (encaja con `Concept`/`CatalogConcept`). */
export type ConceptLike = { name: string; aliases?: readonly string[] };

/**
 * Sección que trata un concepto: la primera cuyo título contiene su nombre o
 * un alias (sin tildes, en minúsculas); si ninguna, la primera cuyo cuerpo lo
 * menciona; si ninguna, `null`.
 */
export function findConceptSection(sections: readonly NoteSection[], concept: ConceptLike): NoteSection | null {
  // El nombre del catálogo suele llevar notación al final («Reglas de la
  // conjunción (∧I, ∧E)») que el título escribe en LaTeX: se prueba también sin
  // ese paréntesis. Se busca por palabras enteras, para que un alias corto
  // («or», «and») no case dentro de «forma» o «normal».
  const variants = [concept.name, ...(concept.aliases ?? [])].flatMap((n) => [n, n.replace(/\s*\([^)]*\)\s*$/, "")]);
  const names = [...new Set(variants.map((n) => norm(n.trim())).filter(Boolean))];
  if (names.length === 0) return null;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = names.map((n) => new RegExp(`(^|[^a-z0-9])${escape(n)}($|[^a-z0-9])`));
  const mentions = (text: string) => {
    const t = norm(text);
    return patterns.some((p) => p.test(t));
  };
  return sections.find((s) => mentions(s.title)) ?? sections.find((s) => mentions(s.body)) ?? null;
}

const stripCode = (s: string): string => s.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]+`/g, " ");
const stripMath = (s: string): string => s.replace(/\$\$[\s\S]+?\$\$/g, " ").replace(/\$[^$\n]+\$/g, " ");

/** Palabras de prosa (sin código ni fórmulas): base del tiempo de lectura. */
export function wordCount(md: string): number {
  const prose = stripMath(stripCode(md));
  return (prose.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
}

/** Minutos de lectura a 200 palabras/min, redondeado y con mínimo 1. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}
