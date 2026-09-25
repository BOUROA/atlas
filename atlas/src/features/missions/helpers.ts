// Formatos y pequeños cálculos compartidos por Misiones y Estrellas guía.
import type { Expedition, ExpeditionAttempt, Legend, Profile, UserState } from "../../domain/types";
import { scoreOf } from "../../domain/expeditions";
import { catalog } from "../../state/catalog";

const UNI_INITIALS: Record<string, string> = {
  MIT: "MIT",
  Stanford: "STA",
  "Stanford University": "STA",
  "UC Berkeley": "UCB",
  "Carnegie Mellon University": "CMU",
  "Princeton University": "PRI",
};

/** Monograma de 2-3 letras para el emblema de una universidad. */
export function universityInitials(name: string): string {
  const known = UNI_INITIALS[name];
  if (known) return known;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .filter((w) => !/^(de|of|the|university|universidad)$/i.test(w))
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const KIND_LABEL: Record<string, string> = { final: "Examen final", parcial: "Parcial", quiz: "Quiz" };
export const missionKindLabel = (kind: string): string => KIND_LABEL[kind] ?? kind;

const STAMP_KIND_LABEL: Record<string, string> = { premio: "Premio", hito: "Hito", titulo: "Título", competicion: "Competición" };
export const stampKindLabel = (kind: string): string => STAMP_KIND_LABEL[kind] ?? kind;

const gradeFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
/** Nota académica con como mínimo un decimal: 7 → "7,0" · 8.33 → "8,33". */
export const gradeNum = (n: number): string => gradeFmt.format(n);

/** Monograma de 2-3 letras para el medallón de una estrella guía, a partir de su nombre. */
export function guideInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Asignatura "principal" de una estrella guía: la de su primer concepto (ruta o territorio). */
export function guidePrimarySubject(guide: Legend | Profile): string | undefined {
  const firstId = "route" in guide ? guide.route[0] : guide.territory[0];
  return firstId ? catalog.conceptById.get(firstId)?.subjectId : undefined;
}

type AtlasFeatureInfo = { href: string; label: string };
const ATLAS_FEATURE: Record<string, AtlasFeatureInfo> = {
  streak: { href: "/hoy", label: "Cuida tu racha en Hoy" },
  exercise: { href: "/sesion", label: "Practica ejercicios en una sesión" },
  map: { href: "/mapa", label: "Explora la carta celeste" },
  mistakes: { href: "/progreso", label: "Revisa tu calibración en Progreso" },
  review: { href: "/sesion", label: "Repasa en una sesión" },
  explain: { href: "/sesion", label: "Explica en voz alta en una sesión" },
  expeditions: { href: "/misiones", label: "Ponte a prueba con una misión" },
  notes: { href: "/asignaturas", label: "Amplía tus apuntes desde una asignatura" },
};
export const atlasFeatureInfo = (feature: string | undefined): AtlasFeatureInfo | undefined => (feature ? ATLAS_FEATURE[feature] : undefined);

export type BestAttempt = { attempt: ExpeditionAttempt; score: number };

/** El intento ya corregido (con endedAt) de mayor nota; null si no hay ninguno. */
export function bestAttempt(exp: Expedition, state: UserState): BestAttempt | null {
  const attempts = (state.expeditions?.[exp.id] ?? []).filter((a) => a.endedAt);
  let best: BestAttempt | null = null;
  for (const attempt of attempts) {
    const score = scoreOf(exp, attempt);
    if (!best || score > best.score) best = { attempt, score };
  }
  return best;
}

/** El intento sin corregir (sin endedAt) más reciente, si lo hay: la misión "en marcha". */
export function openAttempt(exp: Expedition, state: UserState): ExpeditionAttempt | null {
  const attempts = (state.expeditions?.[exp.id] ?? []).filter((a) => !a.endedAt);
  if (attempts.length === 0) return null;
  return attempts.reduce((a, b) => (Date.parse(b.startedAt) > Date.parse(a.startedAt) ? b : a));
}

