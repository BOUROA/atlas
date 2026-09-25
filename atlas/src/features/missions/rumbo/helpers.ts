// Ayudas puras del Rumbo (Principales): agrupar pasos, etiquetas, cuenta de
// preparación y pequeños cálculos compartidos por la Agenda y la Carta.
// Sin React: solo transforma los datos de src/domain/route.ts.
import type { CatalogIndex } from "../../../domain/catalog";
import { DEFAULT_FINAL_DAY, nextObjectives, type RouteStep, type RouteStepKind, type SubjectRoute } from "../../../domain/route";
import { addDays, dayKey, daysBetween, isoWeekKey, parseDayKey } from "../../../domain/time";
import type { ConceptProgress } from "../../../domain/tutor/mastery";
import { progressOf } from "../../../domain/tutor/mastery";
import type { Trial, TrialAttempt, UserState } from "../../../domain/types";
import { TRIAL_PASS, starsFor, trialScore } from "../../../domain/trials";

/** Proporción a partir de la cual un paso se considera "listo" (spec §6/§8: 70 %). */
export const READY_RATIO = 0.7;
/** Días de la ventana "próximos 7 días" de la Bitácora. */
export const WEEK_WINDOW_DAYS = 7;
/** Días de la ventana de "Resultados" en la columna derecha. */
export const RESULTS_WINDOW_DAYS = 10;
/** Umbral de "semana cargada": simulacros o nº de pasos. */
export const HEAVY_WEEK_SIMS = 5;
export const HEAVY_WEEK_STEPS = 15;

export const STEP_KIND_LABEL: Record<RouteStepKind, string> = {
  unit: "Tema",
  control: "Control",
  "sim-parcial": "Simulacro de parcial",
  "sim-final": "Simulacro de final",
  exam: "Examen",
};

/** Nombre corto de la asignatura ("Cálculo") para etiquetas compactas; el completo si no tiene. */
export function subjectShort(subjectId: string, index: CatalogIndex): string {
  const s = index.subjectById.get(subjectId);
  return s?.shortName ?? s?.name ?? subjectId;
}

/** Primera letra en minúscula ("Examen final" → "examen final"), sin tocar siglas ni el resto. */
export const lowerFirst = (s: string): string => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** Cuenta atrás en prosa: "es hoy" · "es mañana" · "faltan 12 días" · "ya pasó". */
export function countdownPhrase(daysLeft: number): string {
  if (daysLeft < 0) return "ya pasó";
  if (daysLeft === 0) return "es hoy";
  if (daysLeft === 1) return "es mañana";
  return `faltan ${daysLeft} días`;
}

/** Rango de una semana compacto: "23–29 nov" o "30 nov – 6 dic". */
export function weekRangeLabel(start: string, end: string): string {
  const s = parseDayKey(start);
  const e = parseDayKey(end);
  const m = (d: Date) => MONTHS_SHORT[d.getMonth()];
  return s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ${m(e)}` : `${s.getDate()} ${m(s)} – ${e.getDate()} ${m(e)}`;
}
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Semana de curso (1 = la del inicio de curso, de lunes a domingo) de un día; ≤ 0 si es anterior. */
export function courseWeekOf(day: string, courseStart: string): number {
  return Math.floor(daysBetween(mondayOf(courseStart), day) / 7) + 1;
}

/** true si el paso es un control o un simulacro (tiene prueba con id). */
export const isTrialStep = (step: RouteStep): boolean => step.kind === "control" || step.kind === "sim-parcial" || step.kind === "sim-final";

/** Quita el prefijo "Control · " / "Tema N · " del título, cuando lo lleva, para el titular. */
function stripKindPrefix(title: string): string {
  const i = title.indexOf(" · ");
  return i >= 0 ? title.slice(i + 3) : title;
}

/** Titular del paso: el título sin repetir la etiqueta de tipo (los exámenes la llevan siempre). */
export function stepHeading(step: RouteStep): string {
  return step.kind === "exam" ? step.title : stripKindPrefix(step.title);
}

/**
 * Etiqueta de los temas de un paso: "Tema N" para un único tema, "Temas N–M" para un rango,
 * o "Todos los temas" cuando cubre el temario completo de la asignatura (simulacros de final).
 */
export function unitsLabel(step: Pick<RouteStep, "subjectId" | "unitIds">, index: CatalogIndex): string {
  const numbers = step.unitIds.map((id) => index.unitById.get(id)?.number).filter((n): n is number => n != null);
  if (numbers.length === 0) return "";
  if (numbers.length === 1) return `Tema ${numbers[0]}`;
  const allOfSubject = index.unitsBySubject.get(step.subjectId) ?? [];
  if (allOfSubject.length > 0 && numbers.length >= allOfSubject.length) return "Todos los temas";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return `Temas ${min}–${max}`;
}

/** Etiqueta pequeña ("Control · Tema 3") con el tipo de paso y el tema, si aplica. */
export function stepEyebrow(step: RouteStep, index: CatalogIndex): string {
  if (step.kind === "exam") return STEP_KIND_LABEL.exam;
  const tema = unitsLabel(step, index);
  // Un paso "unit" ya es "Tema N": no repetir la etiqueta de tipo delante.
  if (step.kind === "unit") return tema || STEP_KIND_LABEL.unit;
  return [STEP_KIND_LABEL[step.kind], tema].filter(Boolean).join(" · ");
}

/** Etiqueta de la CTA para empezar un paso atrasado (control o simulacro). */
export const startCta = (step: RouteStep): string => (step.kind === "control" ? "Empezar control" : "Empezar simulacro");

/** Conceptos de un tema todavía por debajo de nivel 2, en orden de temario. */
export function unitConceptsBelowLevel(unitId: string, index: CatalogIndex, progress: ReadonlyMap<string, ConceptProgress>): string[] {
  return (index.conceptsByUnit.get(unitId) ?? []).filter((c) => progressOf(progress, c.id).level < 2).map((c) => c.id);
}

/**
 * Enlace "Repasar el tema": la sesión a medida con los conceptos del tema aún no listos
 * (si ya lo están todos, con todos los del tema, para no abrir una sesión vacía).
 */
export function unitReviewHref(unitIds: readonly string[], index: CatalogIndex, progress: ReadonlyMap<string, ConceptProgress>): string {
  let ids = unitIds.flatMap((id) => unitConceptsBelowLevel(id, index, progress));
  if (ids.length === 0) ids = unitIds.flatMap((id) => (index.conceptsByUnit.get(id) ?? []).map((c) => c.id));
  return `/sesion?ids=${ids.map(encodeURIComponent).join(",")}`;
}

/** Enlace del CTA de un paso: la prueba si tiene, si no la sesión de repaso del tema. */
export function stepHref(step: RouteStep, index: CatalogIndex, progress: ReadonlyMap<string, ConceptProgress>): string {
  if (step.trialId) return `/prueba/${encodeURIComponent(step.trialId)}`;
  return unitReviewHref(step.unitIds, index, progress);
}

/** El control anterior (mismo tema, en orden) de un paso de control, si lo hay y tiene nota. */
export function previousControl(route: SubjectRoute, step: RouteStep): RouteStep | undefined {
  if (step.kind !== "control") return undefined;
  const controls = route.steps.filter((s) => s.kind === "control");
  const i = controls.findIndex((s) => s.key === step.key);
  const prev = i > 0 ? controls[i - 1] : undefined;
  return prev && prev.best != null ? prev : undefined;
}

/* ───────── Agrupaciones de la Bitácora ───────── */

export type DayGroup = { day: string; steps: RouteStep[] };

/** Pasos no atrasados agrupados por día, ordenados por fecha (asc). */
export function groupByDay(steps: readonly RouteStep[]): DayGroup[] {
  const map = new Map<string, RouteStep[]>();
  for (const s of steps) {
    const list = map.get(s.due);
    if (list) list.push(s);
    else map.set(s.due, [s]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, steps: list }));
}

export type WeekGroup = { weekKey: string; start: string; end: string; steps: RouteStep[]; simCount: number; heavy: boolean };

/** Lunes de la semana ISO que contiene `day`. */
function mondayOf(day: string): string {
  const d = parseDayKey(day);
  const isoDow = d.getDay() || 7; // lunes=1 ... domingo=7
  return dayKey(addDays(d, 1 - isoDow));
}

/** Pasos agrupados por semana ISO (lunes-domingo), ordenadas por fecha; marca las "cargadas". */
export function groupByWeek(steps: readonly RouteStep[]): WeekGroup[] {
  const map = new Map<string, RouteStep[]>();
  for (const s of steps) {
    const key = isoWeekKey(parseDayKey(s.due));
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()]
    .map(([weekKey, list]): WeekGroup => {
      const sorted = [...list].sort((a, b) => a.due.localeCompare(b.due));
      const start = mondayOf(sorted[0].due);
      const simCount = sorted.filter((s) => s.kind === "sim-parcial" || s.kind === "sim-final").length;
      return { weekKey, start, end: dayKey(addDays(parseDayKey(start), 6)), steps: sorted, simCount, heavy: simCount >= HEAVY_WEEK_SIMS || sorted.length >= HEAVY_WEEK_STEPS };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Asignaturas distintas de un grupo de pasos, en el orden en que aparecen. */
export function subjectsIn(steps: readonly RouteStep[]): string[] {
  return [...new Set(steps.map((s) => s.subjectId))];
}

/* ───────── Rumbo global: cabecera y resumen ───────── */

export type GlobalStats = { doneSteps: number; totalSteps: number; stars: number; onTrack: number; subjects: number };

/** Agregado de todas las asignaturas: pasos hechos/totales, estrellas y asignaturas al día. */
export function globalStats(routes: readonly SubjectRoute[]): GlobalStats {
  let doneSteps = 0;
  let totalSteps = 0;
  let stars = 0;
  let onTrack = 0;
  for (const r of routes) {
    doneSteps += r.done;
    totalSteps += r.total;
    onTrack += r.onTrack ? 1 : 0;
    for (const s of r.steps) if (s.status === "done") stars += s.stars;
  }
  return { doneSteps, totalSteps, stars, onTrack, subjects: routes.length };
}

/** Fecha del próximo examen real (no supuesto ni de plantilla) pendiente de la asignatura, o su boss si no hay ninguno. */
export function nextRealExamDate(route: SubjectRoute): string | undefined {
  const real = route.steps
    .filter((s) => s.kind === "exam" && !s.assumed && s.status !== "done")
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  return real?.due ?? route.boss?.due;
}

/** Estrellas acumuladas en los pasos hechos de una asignatura. */
export function routeStars(route: SubjectRoute): number {
  let stars = 0;
  for (const s of route.steps) if (s.status === "done") stars += s.stars;
  return stars;
}

/** La misión principal (boss) pendiente de fecha más próxima entre todas las asignaturas, con su asignatura. */
export function nearestBoss(routes: readonly SubjectRoute[]): { route: SubjectRoute; boss: RouteStep } | undefined {
  let best: { route: SubjectRoute; boss: RouteStep } | undefined;
  for (const r of routes) {
    if (!r.boss || r.boss.status === "done") continue;
    if (!best || r.boss.due < best.boss.due) best = { route: r, boss: r.boss };
  }
  return best;
}

/** El primer boss pendiente y no supuesto (examen real, no de plantilla ni final por defecto) más próximo. */
export function nearestRealBoss(routes: readonly SubjectRoute[]): { route: SubjectRoute; boss: RouteStep } | undefined {
  let best: { route: SubjectRoute; boss: RouteStep } | undefined;
  for (const r of routes) {
    if (!r.boss || r.boss.status === "done" || r.boss.assumed) continue;
    if (!best || r.boss.due < best.boss.due) best = { route: r, boss: r.boss };
  }
  return best ?? nearestBoss(routes);
}

/** Fecha del último final del curso (la más lejana entre todas las asignaturas): el objetivo de temporada. */
export function seasonEnd(routes: readonly SubjectRoute[]): string {
  return routes.reduce((max, r) => {
    const due = r.boss?.due ?? DEFAULT_FINAL_DAY;
    return due > max ? due : max;
  }, DEFAULT_FINAL_DAY);
}

/**
 * Hasta `limit` pasos "adelantables": pendientes, no atrasados, no exámenes, por fecha objetivo,
 * prefiriendo los ya listos (preparación ≥ 70 %) — para sugerir qué hacer cuando hoy no vence nada.
 */
export function advanceCandidates(routes: readonly SubjectRoute[], limit: number): RouteStep[] {
  const pending = nextObjectives(routes, Number.POSITIVE_INFINITY).filter((s) => s.kind !== "exam" && s.status !== "late");
  const ready = pending.filter((s) => s.readiness >= READY_RATIO);
  const rest = pending.filter((s) => s.readiness < READY_RATIO);
  return [...ready, ...rest].slice(0, limit);
}

/* ───────── Resultados recientes (pruebas) ───────── */

/**
 * Una fila por prueba: su último intento corregido (dentro de la ventana), su nota,
 * cuántos intentos lleva hasta ese y la nota del primero (la honesta, spec §7).
 */
export type TrialResultRow = { trial: Trial; attempt: TrialAttempt; score: number; stars: 0 | 1 | 2 | 3; first: number; attemptNo: number };

/** Pruebas con algún intento corregido en los últimos `RESULTS_WINDOW_DAYS` días (una fila cada una), de la más a la menos reciente. */
export function recentTrialResults(trials: readonly Trial[], state: UserState, now: Date): TrialResultRow[] {
  const today = dayKey(now);
  const rows: TrialResultRow[] = [];
  for (const trial of trials) {
    const attempts = (state.trials?.[trial.id] ?? [])
      .filter((a) => a.endedAt && dayKey(a.endedAt) <= today)
      .sort((a, b) => a.endedAt!.localeCompare(b.endedAt!));
    if (attempts.length === 0) continue;
    const last = attempts[attempts.length - 1];
    if (daysBetween(dayKey(last.endedAt!), today) > RESULTS_WINDOW_DAYS) continue;
    const score = trialScore(trial, last);
    rows.push({ trial, attempt: last, score, stars: starsFor(score), first: trialScore(trial, attempts[0]), attemptNo: attempts.length });
  }
  return rows.sort((a, b) => b.attempt.endedAt!.localeCompare(a.attempt.endedAt!));
}

/** Contexto del intento: "a la primera" (aprobado en el primer intento), "primer intento" o "1.er intento 6,2". */
export function attemptContext(row: Pick<TrialResultRow, "attemptNo" | "score" | "first">, fmt: (n: number) => string): string {
  if (row.attemptNo > 1) return `1.er intento ${fmt(row.first)}`;
  return row.score >= TRIAL_PASS ? "a la primera" : "primer intento";
}

/* ───────── Plantilla ───────── */

/** true si alguna asignatura del curso actual no tiene todavía ninguna evaluación. */
export function someSubjectWithoutAssessments(state: UserState, index: CatalogIndex): boolean {
  return index.subjects.some((s) => (state.subjects[s.id]?.assessments.length ?? 0) === 0);
}
