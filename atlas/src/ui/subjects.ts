// Identidad visual de las asignaturas (constelaciones): abreviatura, nombre y colores.
//
// FlipyERP Academy: todo sale de content/subjects.json (campos `abbr`, `name`,
// `color` y `colorLight`), en vez de una lista fija. Los colores se inyectan
// como variables CSS (--s-<id>, --s-<id>-soft, --s-<id>-fg) con las mismas
// reglas que tokens.css (installSubjectColors, desde main.tsx).

import subjectsJson from "../../content/subjects.json";
import type { Subject } from "../domain/types";

const SUBJECTS = subjectsJson as Subject[];

export const SUBJECT_IDS: readonly string[] = SUBJECTS.map((s) => s.id);
export type KnownSubjectId = string;

const fallbackAbbr = (id: string) => id.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase();

export const SUBJECT_ABBR: Record<string, string> = Object.fromEntries(SUBJECTS.map((s) => [s.id, s.abbr ?? fallbackAbbr(s.id)]));
/** Nombres completos (los de content/subjects.json). */
export const SUBJECT_NAMES: Record<string, string> = Object.fromEntries(SUBJECTS.map((s) => [s.id, s.name]));

export const isKnownSubject = (id: string): id is KnownSubjectId => id in SUBJECT_NAMES;

/** Abreviatura en versalitas; para ids desconocidos, las tres primeras letras. */
export function subjectAbbr(id: string): string {
  return SUBJECT_ABBR[id] ?? fallbackAbbr(id);
}

export function subjectName(id: string): string {
  return SUBJECT_NAMES[id] ?? id;
}

/** Color base de la asignatura (puntos, carriles, estrellas). */
export const subjectColor = (id: string): string => `var(--s-${id}, var(--text-3))`;
/** Fondo suave al 18 % (etiquetas). */
export const subjectSoft = (id: string): string => `var(--s-${id}-soft, var(--hover-2))`;
/** Color de texto legible sobre las superficies (AA en ambos temas). */
export const subjectFg = (id: string): string => `var(--s-${id}-fg, var(--text-2))`;

/** Solo ids seguros como nombre de variable CSS. */
const cssSafe = (id: string) => /^[a-z0-9-]+$/.test(id);

/** Genera las variables CSS de color de cada asignatura (mismas reglas que tokens.css). */
export function subjectColorsCss(subjects: readonly Subject[] = SUBJECTS): string {
  const list = subjects.filter((s) => cssSafe(s.id));
  const dark = list.map((s) => `--s-${s.id}: ${s.color};`).join(" ");
  const light = list.map((s) => `--s-${s.id}: ${s.colorLight ?? s.color};`).join(" ");
  const derived = list
    .map((s) =>
      `--s-${s.id}-soft: color-mix(in oklab, var(--s-${s.id}) 18%, transparent); ` +
      `--s-${s.id}-fg: color-mix(in oklab, var(--s-${s.id}) var(--fg-mix), var(--text));`)
    .join(" ");
  return [
    `:root, [data-theme="dark"] { ${dark} }`,
    `[data-theme="light"] { ${light} }`,
    `@media (prefers-color-scheme: light) { [data-theme="system"] { ${light} } }`,
    `:root, [data-theme] { ${derived} }`,
  ].join("\n");
}

/** Inyecta las variables de color en el documento (una vez). */
export function installSubjectColors(): void {
  if (typeof document === "undefined" || document.getElementById("subject-colors")) return;
  const style = document.createElement("style");
  style.id = "subject-colors";
  style.textContent = subjectColorsCss();
  document.head.appendChild(style);
}
