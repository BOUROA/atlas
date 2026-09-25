// Identidad visual de las asignaturas: abreviatura, nombre corto y colores.
// Los colores viven en tokens.css (--s-<id>, --s-<id>-soft, --s-<id>-fg);
// aquí solo se construyen las referencias var(...).

export const SUBJECT_IDS = [
  "ia",
  "calculo",
  "logica",
  "algebra",
  "programacion",
  "algoritmia",
  "estructuras",
  "computacion",
  "operativos",
  "preprocesamiento",
] as const;

export type KnownSubjectId = (typeof SUBJECT_IDS)[number];

export const SUBJECT_ABBR: Record<KnownSubjectId, string> = {
  ia: "IAC",
  calculo: "CAL",
  logica: "LOG",
  algebra: "ALG",
  programacion: "FPR",
  algoritmia: "ALC",
  estructuras: "EDA",
  computacion: "TC",
  operativos: "MOE",
  preprocesamiento: "PMD",
};

/** Nombres completos (los mismos de content/subjects.json, en minúscula de frase). */
export const SUBJECT_NAMES: Record<KnownSubjectId, string> = {
  ia: "IA e ingeniería del conocimiento",
  calculo: "Cálculo y métodos numéricos",
  logica: "Lógica computacional",
  algebra: "Álgebra y matemática discreta",
  programacion: "Fundamentos de programación",
  algoritmia: "Algoritmia y complejidad",
  estructuras: "Estructuras de datos",
  computacion: "Teoría de la computación",
  operativos: "Métodos operativos y estadísticos",
  preprocesamiento: "Preprocesamiento y modelos de datos",
};

export const isKnownSubject = (id: string): id is KnownSubjectId =>
  (SUBJECT_IDS as readonly string[]).includes(id);

/** Abreviatura en versalitas; para asignaturas futuras, las tres primeras letras. */
export function subjectAbbr(id: string): string {
  if (isKnownSubject(id)) return SUBJECT_ABBR[id];
  return id.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase();
}

export function subjectName(id: string): string {
  return isKnownSubject(id) ? SUBJECT_NAMES[id] : id;
}

/** Color base de la asignatura (puntos, carriles, estrellas). */
export const subjectColor = (id: string): string => `var(--s-${id}, var(--text-3))`;
/** Fondo suave al 18 % (etiquetas). */
export const subjectSoft = (id: string): string => `var(--s-${id}-soft, var(--hover-2))`;
/** Color de texto legible sobre las superficies (AA en ambos temas). */
export const subjectFg = (id: string): string => `var(--s-${id}-fg, var(--text-2))`;
