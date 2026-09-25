// Ayudas puras de la pantalla Prueba (#/prueba/:id): etiquetas, cronómetro,
// efecto en conceptos y siguiente paso del rumbo. Sin React.
import type { CatalogIndex } from "../../domain/catalog";
import type { SubjectRoute, RouteStep } from "../../domain/route";
import { bestFractionByConcept } from "../../domain/trials";
import type { StudyEvent, Trial, TrialAttempt, TrialKind, TrialLevel } from "../../domain/types";
import { store } from "../../state/store";

const gradeFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
/** Nota académica con como mínimo un decimal: 7 → "7,0" · 8.33 → "8,33". */
export const gradeNum = (n: number): string => gradeFmt.format(n);

const ptsFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
/** Puntos con hasta 2 decimales y sin ceros de más: 0.5 → "0,5" · 2 → "2". */
export const ptsNum = (n: number): string => ptsFmt.format(n);
/** "0,5 puntos" / "1 punto" / "2,5 puntos": como `plural` pero sin redondear los puntos a 0 decimales. */
export function ptsLabel(n: number): string {
  return `${ptsNum(n)} ${Math.abs(n) === 1 ? "punto" : "puntos"}`;
}

export const TRIAL_KIND_LABEL: Record<TrialKind, string> = {
  control: "Control de tema",
  parcial: "Simulacro de parcial",
  final: "Simulacro de final",
};

export const TRIAL_LEVEL_LABEL: Record<TrialLevel, string> = {
  1: "Rodaje",
  2: "Universidad",
  3: "Exigente",
  4: "Máximo",
};

/** Título de los temas que cubre la prueba: "Tema 3 · Aplicaciones de la derivada". */
export function trialUnitsLabel(trial: Trial, index: CatalogIndex): string {
  return trial.unitIds
    .map((id) => index.unitById.get(id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => `Tema ${u.number} · ${u.title}`)
    .join(" · ");
}

/** Reloj "mm:ss" o "h:mm:ss" a partir de milisegundos (siempre positivos). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Puntos obtenidos de un problema en un intento, acotados a [0, points]. */
export function earnedOf(points: number, earned: number | undefined): number {
  return Math.max(0, Math.min(points, earned ?? 0));
}

export type TrialEffectItem = { conceptId: string; unseen: boolean };
export type TrialEffect = { reforzados: string[]; aRepasar: TrialEffectItem[] };

/**
 * Efecto de la corrección sobre los conceptos: reforzados (evento con nota
 * 3/2) y a repasar — un único grupo que junta el evento con nota 1 (ya
 * visto, fallado) y los de fracción < 0,5 que no generaron ningún evento
 * (aún no vistos), estos últimos marcados `unseen`.
 */
export function trialEffect(trial: Trial, attempt: TrialAttempt, events: readonly StudyEvent[]): TrialEffect {
  const fractions = bestFractionByConcept(trial, attempt);
  const order = [...new Set(trial.problems.flatMap((p) => p.concepts))];
  const eventByConcept = new Map(events.map((e) => [e.conceptId, e]));
  const reforzados: string[] = [];
  const aRepasar: TrialEffectItem[] = [];
  for (const conceptId of order) {
    const event = eventByConcept.get(conceptId);
    if (event) {
      if (event.grade === 3 || event.grade === 2) reforzados.push(conceptId);
      else if (event.grade === 1) aRepasar.push({ conceptId, unseen: false });
      continue;
    }
    const fraction = fractions.get(conceptId) ?? 1;
    if (fraction < 0.5 - 1e-9) aRepasar.push({ conceptId, unseen: true });
  }
  return { reforzados, aRepasar };
}

/** true si algún problema del intento ha sacado menos de la mitad de sus puntos. */
export function someProblemBelowHalf(trial: Trial, attempt: TrialAttempt): boolean {
  return trial.problems.some((p) => p.points > 0 && earnedOf(p.points, attempt.earned[p.n]) / p.points < 0.5 - 1e-9);
}

/** Ids (del catálogo) de los conceptos a repasar de un efecto: para la sesión "Repasar lo fallado". */
export function failedConceptIds(effect: TrialEffect, index: CatalogIndex): string[] {
  return effect.aRepasar.filter((item) => index.conceptById.has(item.conceptId)).map((item) => item.conceptId);
}

/** El primer paso pendiente del rumbo de una asignatura (ni hecho ni caducado), si lo hay. */
export function nextStepOf(routes: readonly SubjectRoute[], subjectId: string): RouteStep | undefined {
  const route = routes.find((r) => r.subjectId === subjectId);
  return route?.steps.find((s) => s.status !== "done" && s.status !== "skipped");
}

/** Enlace de la CTA de un paso: la prueba si tiene, si no el rumbo (Misiones). */
export function stepCtaHref(step: RouteStep): string {
  return step.trialId ? `/prueba/${encodeURIComponent(step.trialId)}` : "/misiones";
}

/** Etiqueta corta del tipo de paso, para la CTA del siguiente paso en el Resultado. */
export const ROUTE_STEP_LABEL: Record<RouteStep["kind"], string> = {
  unit: "Tema",
  control: "Control",
  "sim-parcial": "Simulacro de parcial",
  "sim-final": "Simulacro de final",
  exam: "Examen",
};

/** El intento sin corregir (sin endedAt) más reciente, si lo hay: la prueba "en marcha". */
export function openTrialAttempt(trialId: string, attempts: readonly TrialAttempt[]): TrialAttempt | undefined {
  const open = attempts.filter((a) => !a.endedAt);
  if (open.length === 0) return undefined;
  return open.reduce((a, b) => (Date.parse(b.startedAt) > Date.parse(a.startedAt) ? b : a));
}

/**
 * Descarta los intentos sin corregir de una prueba (los quita del estado): el
 * que está en marcha y cualquier otro abandonado antes, para que nunca quede más
 * de uno abierto. Pequeña acción propia de esta pantalla; también borra el
 * borrador local de esos intentos.
 */
export function discardOpenTrialAttempts(trialId: string): void {
  const open = (store.getState().trials?.[trialId] ?? []).filter((a) => !a.endedAt);
  if (open.length === 0) return;
  store.update((s) => {
    const all = s.trials ?? {};
    const list = all[trialId] ?? [];
    const next = list.filter((a) => a.endedAt);
    if (next.length === list.length) return s;
    return { ...s, trials: { ...all, [trialId]: next } };
  });
  for (const a of open) clearTrialDraft(a.id);
}

/* ───────── Borrador local del intento (este navegador) ─────────
   El dominio guarda `startedAt`, `checked` y, al corregir, `endedAt`. Dos datos
   de la fase de corrección no tienen sitio en `TrialAttempt` y viven aquí, por
   intento: cuándo se pulsó «Terminar y corregir» (para no contar el tiempo de
   corrección como tiempo de examen y para reanudar en la fase correcta) y los
   ajustes manuales aún sin guardar. Si se pierde, todo sigue funcionando. */

export type TrialDraft = { finishedAt?: string; overrides?: Record<string, number> };
const DRAFT_KEY = "atlas.trial-drafts";
const DRAFT_MAX = 40;

function readDrafts(): Record<string, TrialDraft & { at: number }> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, TrialDraft & { at: number }>) : {};
  } catch {
    return {};
  }
}

function writeDrafts(all: Record<string, TrialDraft & { at: number }>): void {
  try {
    const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, DRAFT_MAX);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // almacenamiento lleno o bloqueado: el borrador local es opcional
  }
}

export function trialDraft(attemptId: string): TrialDraft {
  const d = readDrafts()[attemptId];
  return d ? { finishedAt: d.finishedAt, overrides: d.overrides } : {};
}

export function saveTrialDraft(attemptId: string, patch: TrialDraft): void {
  const all = readDrafts();
  all[attemptId] = { ...all[attemptId], ...patch, at: Date.now() };
  writeDrafts(all);
}

export function clearTrialDraft(attemptId: string): void {
  const all = readDrafts();
  if (!(attemptId in all)) return;
  delete all[attemptId];
  writeDrafts(all);
}

/** Fase en la que se reanuda un intento abierto: corrección si ya se terminó (o ya hay criterios marcados). */
export function resumePhaseOf(attempt: TrialAttempt): "running" | "correcting" {
  if (trialDraft(attempt.id).finishedAt) return "correcting";
  return Object.values(attempt.checked ?? {}).some((list) => list.length > 0) ? "correcting" : "running";
}

/** Milisegundos de examen de un intento corregido: hasta «Terminar y corregir» si se sabe, si no hasta la corrección. */
export function examMsOf(attempt: TrialAttempt): number {
  const end = trialDraft(attempt.id).finishedAt ?? attempt.endedAt;
  return end ? Math.max(0, Date.parse(end) - Date.parse(attempt.startedAt)) : 0;
}
