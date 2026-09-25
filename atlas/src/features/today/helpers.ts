// Funciones puras propias de Hoy: semana de curso, minutos por día, comodines
// históricos, "más cercana" para misiones y estrellas guía, y las fichas de
// motivo de la cola. No tocan el DOM.
import type { CatalogIndex } from "../../domain/catalog";
import { readiness, scoreOf, PASSING_GRADE, type Readiness as MissionReadiness } from "../../domain/expeditions";
import { ACHIEVEMENTS } from "../../domain/game/achievements";
import { legendProgress, profileProgress, type ConstellationProgress } from "../../domain/legends";
import { addDays, dayKey, daysBetween, isoWeekKey, parseDayKey, startOfDay } from "../../domain/time";
import { isAttemptedReview } from "../../domain/game/activity";
import type { ConceptProgress } from "../../domain/tutor/mastery";
import type { RouteStep, RouteStepKind, SubjectRoute } from "../../domain/route";
import type { Expedition, Legend, Profile, StudyEvent, UserState } from "../../domain/types";
import { catalog, isLegend } from "../../state/catalog";
import { plural, subjectAbbr, type IconName } from "../../ui";
import { courseWeekOf, seasonEnd } from "../missions/rumbo/helpers";

/**
 * Inicio del primer cuatrimestre 2026-27, para el eje de tiempo de "Evolución"
 * en Progreso (`ActivityEvolution.tsx`). No usar para la semana de curso de la
 * cabecera: esa cuenta usa `courseStartOf` (ajustes), igual que Misiones.
 */
export const TERM_START = "2026-09-14";

export type CourseWeekInfo =
  | { started: true; week: number; weeks: number }
  | { started: false; daysToStart: number };

/**
 * Semana de curso de la cabecera de Hoy: la misma cuenta que la cabecera de
 * Misiones (`PrincipalesTab.tsx`), desde `courseStartOf(settings)` hasta el
 * último final (real o supuesto) de `routes`. Antes, Hoy contaba desde un
 * lunes fijo ("2026-09-14") con un total fijo de 20 semanas, y por eso decía
 * una semana distinta a Misiones el mismo día.
 */
export function courseWeekInfo(now: Date, courseStart: string, routes: readonly SubjectRoute[]): CourseWeekInfo {
  const today = dayKey(now);
  if (today < courseStart) return { started: false, daysToStart: daysBetween(today, courseStart) };
  const weeks = courseWeekOf(seasonEnd(routes), courseStart);
  const week = Math.min(Math.max(1, courseWeekOf(today, courseStart)), Math.max(1, weeks));
  return { started: true, week, weeks: Math.max(1, weeks) };
}

const COOLING_HEADLINE_RE = /rescatar (?:un concepto|\d+ conceptos) que se está(?:n)? apagando\.$/;

/**
 * Sustituye la cifra de "conceptos que se están apagando" del titular del
 * tutor (`tutorHeadline`) por `cooling`: la misma cuenta que la ficha "se
 * enfrían" de la cabecera. Antes usaban umbrales distintos (la cola de hoy,
 * recortada al presupuesto de minutos, contra todo lo que está por debajo de
 * la retención deseada) y podían mostrar cifras distintas en el mismo pliegue.
 */
export function withCoolingCount(headline: string, cooling: number): string {
  if (!COOLING_HEADLINE_RE.test(headline)) return headline;
  const phrase = cooling === 1 ? "rescatar un concepto que se está apagando." : `rescatar ${cooling} conceptos que se están apagando.`;
  return headline.replace(COOLING_HEADLINE_RE, phrase);
}

const REVIEW_MINUTES = 1.5;

/**
 * Minutos de estudio por día (mismo criterio que `weeklyDistribution` del
 * dominio): la duración registrada (`ms`) de cada repaso o visto; un repaso
 * sin duración cuenta 1,5 min, un visto sin duración no cuenta.
 */
export function minutesByDay(events: readonly StudyEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.kind !== "review" && e.kind !== "seen") continue;
    const m = e.ms && e.ms > 0 ? e.ms / 60000 : e.kind === "review" ? REVIEW_MINUTES : 0;
    if (m <= 0) continue;
    const key = dayKey(e.at);
    out[key] = (out[key] ?? 0) + m;
  }
  return out;
}

/**
 * Comodines consumidos en toda la historia (no solo en la racha actual):
 * recorre los días desde el primero activo hasta `now` reproduciendo la
 * misma regla que la racha (un comodín por semana ISO, solo si el día
 * anterior fue realmente activo).
 */
export function wildcardsUsed(activeDays: ReadonlySet<string>, now: Date): number {
  if (activeDays.size === 0) return 0;
  const first = parseDayKey([...activeDays].sort()[0]);
  const today = startOfDay(now);
  const usedWeeks = new Set<string>();
  let count = 0;
  for (let d = first; d.getTime() <= today.getTime(); d = addDays(d, 1)) {
    const key = dayKey(d);
    if (activeDays.has(key)) continue;
    const week = isoWeekKey(d);
    if (usedWeeks.has(week)) continue;
    if (activeDays.has(dayKey(addDays(d, -1)))) {
      usedWeeks.add(week);
      count++;
    }
  }
  return count;
}

export type NearestMission = { expedition: Expedition; readiness: MissionReadiness };

/** La misión no superada con mayor preparación (empate: la primera del catálogo). */
export function nearestMission(
  expeditions: readonly Expedition[],
  state: UserState,
  progress: ReadonlyMap<string, ConceptProgress>,
): NearestMission | null {
  let best: NearestMission | null = null;
  for (const exp of expeditions) {
    const attempts = state.expeditions?.[exp.id] ?? [];
    const passed = attempts.some((a) => a.endedAt && scoreOf(exp, a) >= PASSING_GRADE);
    if (passed) continue;
    const r = readiness(exp, progress);
    if (!best || r.ratio > best.readiness.ratio) best = { expedition: exp, readiness: r };
  }
  return best;
}

export type NearestGuide = { guide: Legend | Profile; progress: ConstellationProgress };

/** La estrella guía no completada con mayor progreso de constelación. */
export function nearestGuide(guides: readonly (Legend | Profile)[], progress: ReadonlyMap<string, ConceptProgress>): NearestGuide | null {
  let best: NearestGuide | null = null;
  for (const g of guides) {
    const p = isLegend(g) ? legendProgress(g, progress) : profileProgress(g, progress);
    if (p.completed || p.total === 0) continue;
    if (!best || p.ratio > best.progress.ratio) best = { guide: g, progress: p };
  }
  return best;
}

/** Asignatura actual con menor frescura media (para "practicar ejercicios de…" con la cola vacía). */
export function leastFreshSubject(
  index: CatalogIndex,
  subjects: readonly { id: string; shortName: string }[],
  progress: ReadonlyMap<string, ConceptProgress>,
): { id: string; shortName: string } | null {
  let worst: { id: string; shortName: string } | null = null;
  let worstAvg = Infinity;
  for (const s of subjects) {
    const concepts = index.conceptsOfSubject(s.id);
    const withCard = concepts.map((c) => progress.get(c.id)).filter((p): p is ConceptProgress => !!p?.card);
    if (withCard.length === 0) continue;
    const avg = withCard.reduce((sum, p) => sum + (p.retrievability ?? 0), 0) / withCard.length;
    if (avg < worstAvg) {
      worstAvg = avg;
      worst = s;
    }
  }
  return worst;
}

/** Dos iniciales en mayúsculas para un monograma (universidad, estrella guía…). */
export function initials(name: string, max = 2): string {
  const words = name.replace(/[()]/g, "").split(/\s+/).filter(Boolean);
  return words.slice(0, max).map((w) => w[0]?.toLocaleUpperCase("es-ES") ?? "").join("");
}

export type AchievementProgress = { value: number; target: number };

export type AchievementProgressInput = {
  index: CatalogIndex;
  state: UserState;
  progress: ReadonlyMap<string, ConceptProgress>;
  longestStreak: number;
  expeditions: readonly Expedition[];
  guides: readonly (Legend | Profile)[];
};

/**
 * Progreso (valor, objetivo) de las insignias que tienen una cifra natural
 * detrás: para la barra de "próximo logro" en Hoy y la cuadrícula de logros
 * en Progreso. Las que no tienen una cifra clara (declaradas una vez, cadenas
 * de requisitos, franja horaria…) no aparecen aquí: se muestran solo con su
 * condición, sin barra. Un resumen deliberadamente más ligero que
 * `evaluateAchievements` (que decide el desbloqueo real).
 */
export function achievementProgress({ index, state, progress, longestStreak, expeditions, guides }: AchievementProgressInput): Map<string, AchievementProgress> {
  const out = new Map<string, AchievementProgress>();
  const set = (id: string, value: number, target: number) => out.set(id, { value: Math.min(Math.max(0, value), target), target });

  let sessions = 0;
  for (const s of state.sessions) if (s.completed) sessions++;
  set("primera-sesion", sessions, 1);
  set("diez-sesiones", sessions, 10);
  set("cincuenta-sesiones", sessions, 50);
  set("cien-sesiones", sessions, 100);

  set("constancia-7", longestStreak, 7);
  set("constancia-30", longestStreak, 30);
  set("constancia-60", longestStreak, 60);

  let run = 0;
  let bestRun = 0;
  let sure = 0;
  let sureHits = 0;
  let fails = 0;
  let reviews = 0;
  const perDay = new Map<string, number>();
  const chronological = [...state.events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const e of chronological) {
    if (e.kind !== "review") continue;
    if (!isAttemptedReview(e)) {
      run = 0;
      continue;
    }
    reviews++;
    const key = dayKey(e.at);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    const hit = e.grade! >= 3;
    run = hit ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
    if (e.grade === 1) fails++;
    if (e.confidence === 3) {
      sure++;
      if (hit) sureHits++;
    }
  }
  set("racha-aciertos-25", bestRun, 25);
  set("sin-miedo", fails, 10);
  set("mil-repasos", reviews, 1000);
  set("calibrado", sure, 30);
  if (sure >= 30) set("calibrado", sureHits / sure, 0.8);
  const bestDay = Math.max(0, ...perDay.values());
  set("maraton", bestDay, 150);

  let lit = 0;
  let mastered = 0;
  const seenSubjects = new Set<string>();
  for (const p of progress.values()) {
    const concept = index.conceptById.get(p.conceptId);
    if (!concept) continue;
    if (p.level >= 1) seenSubjects.add(concept.subjectId);
    if (p.level >= 2) lit++;
    if (p.level === 3) mastered++;
  }
  set("cien-conceptos", lit, 100);
  set("trescientos-conceptos", lit, 300);
  set("dominio-50", mastered, 50);

  let bestUnitRatio = 0;
  for (const concepts of index.conceptsByUnit.values()) {
    if (concepts.length === 0) continue;
    const ratio = concepts.filter((c) => (progress.get(c.id)?.level ?? 0) >= 2).length / concepts.length;
    bestUnitRatio = Math.max(bestUnitRatio, ratio);
  }
  set("tema-completo", bestUnitRatio, 1);

  let bestShare = 0;
  const courseSubjects: string[] = [];
  for (const s of index.subjects) {
    const concepts = index.conceptsOfSubject(s.id);
    if (concepts.length === 0) continue;
    if (s.status === "current") courseSubjects.push(s.id);
    bestShare = Math.max(bestShare, concepts.filter((c) => (progress.get(c.id)?.level ?? 0) >= 2).length / concepts.length);
  }
  set("asignatura-25", bestShare, 0.25);
  set("asignatura-50", bestShare, 0.5);
  set("asignatura-75", bestShare, 0.75);
  set("asignatura-100", bestShare, 1);
  if (courseSubjects.length > 0) set("explorador", courseSubjects.filter((sid) => seenSubjects.has(sid)).length, courseSubjects.length);

  if (expeditions.length > 0) {
    const byId = new Map(expeditions.map((e) => [e.id, e]));
    let completed = 0;
    const universities = new Set<string>();
    for (const [expId, attempts] of Object.entries(state.expeditions ?? {})) {
      const exp = byId.get(expId);
      if (!exp) continue;
      for (const a of attempts) {
        if (!a.endedAt) continue;
        completed++;
        universities.add(exp.university);
      }
    }
    set("cinco-misiones", completed, 5);
    set("tres-universidades", universities.size, 3);
  }

  if (guides.length > 0) {
    let completedGuides = 0;
    for (const g of guides) {
      const gp = isLegend(g) ? legendProgress(g, progress) : profileProgress(g, progress);
      if (gp.completed) completedGuides++;
    }
    set("cinco-guias", completedGuides, 5);
    set("todas-las-guias", completedGuides, guides.length);
  }

  return out;
}

/* ───────── Tarjeta «Rumbo» (próximos objetivos y misión más cercana) ───────── */

/** Etiqueta corta del tipo de paso del rumbo, para la tarjeta compacta de Hoy. */
export const RUMBO_STEP_LABEL: Record<RouteStepKind, string> = {
  unit: "Tema",
  control: "Control",
  "sim-parcial": "Simulacro de parcial",
  "sim-final": "Simulacro de final",
  exam: "Examen",
};

/** Icono del vocabulario para el tipo de paso del rumbo (`docs/diseno-visual.md`). */
export const RUMBO_STEP_ICON: Record<RouteStepKind, IconName> = {
  unit: "unit",
  control: "control",
  "sim-parcial": "simulacro",
  "sim-final": "simulacro",
  exam: "exam",
};

/** "en 3 días" / "hoy" / "mañana" / "26 d tarde" a partir de los días restantes de un paso. */
export function dueLabel(step: Pick<RouteStep, "daysLeft" | "status">): string {
  if (step.status === "late") return `${plural(-step.daysLeft, "d", "d")} tarde`;
  if (step.daysLeft === 0) return "hoy";
  if (step.daysLeft === 1) return "mañana";
  return `en ${plural(step.daysLeft, "día", "días")}`;
}

/** Enlace de la CTA de un objetivo del rumbo en Hoy: la prueba si la tiene, si no Misiones. */
export const rumboStepHref = (step: Pick<RouteStep, "trialId">): string => (step.trialId ? `/prueba/${encodeURIComponent(step.trialId)}` : "/misiones");

/** El examen real (no de plantilla ni final supuesto) pendiente más próximo entre todas las asignaturas. */
export function nearestRealExam(routes: readonly SubjectRoute[]): { route: SubjectRoute; boss: RouteStep } | undefined {
  let best: { route: SubjectRoute; boss: RouteStep } | undefined;
  for (const r of routes) {
    if (!r.boss || r.boss.status === "done" || r.boss.assumed) continue;
    if (!best || r.boss.due < best.boss.due) best = { route: r, boss: r.boss };
  }
  return best;
}

/** La insignia no conseguida con más progreso (para "próximo logro" en Hoy). */
export function nextAchievement(
  earnedIds: ReadonlySet<string>,
  progress: ReadonlyMap<string, AchievementProgress>,
): { id: string; ratio: number } | null {
  let best: { id: string; ratio: number } | null = null;
  for (const a of ACHIEVEMENTS) {
    if (earnedIds.has(a.id)) continue;
    const p = progress.get(a.id);
    if (!p || p.target <= 0) continue;
    const ratio = Math.min(1, p.value / p.target);
    if (!best || ratio > best.ratio) best = { id: a.id, ratio };
  }
  return best;
}

/* ───────── Fichas de motivo «En la cola» (maqueta hoy-iconos.html) ───────── */

export type QueueReasonChip = { icon: IconName; text: string; tone?: "gold" | "ember" | "frost" };

const ADVANCE_RE = /^Adelántalo: (?:lo necesitas para|ya lo necesitas en) ([^(]+)/;
const EXAM_RE = /(?: hoy| mañana| en \d+ días)$/;
const COOLING_RE = /^(Se está apagando|Refuérzalo|Toca repasar)/;
const DECLARED_RE = /^Comprueba que ya lo dominas/;
const REINFORCE_RE = /^Reforzar tras/;
const NEXT_UNIT_RE = /^Siguiente del Tema (\S+) de/;
const SEEN_RE = /^Lo (viste|estudiaste|marcaste) (.+)$/;
const BASE_RE = /^Base directa de (\d+) conceptos?$/;
const USED_RE = /^Lo necesitarás en (.+)$/;

/** Ficha del motivo principal (fila de la cola): un icono del vocabulario + una etiqueta corta. */
function primaryReasonChip(reason: string): QueueReasonChip {
  const advance = reason.match(ADVANCE_RE);
  if (advance) return { icon: "unlocks", text: `para ${advance[1].trim()}`, tone: "gold" };
  if (EXAM_RE.test(reason)) return { icon: "examSoon", text: reason, tone: "ember" };
  if (DECLARED_RE.test(reason)) return { icon: "review", text: "comprobar dominio" };
  if (COOLING_RE.test(reason)) return { icon: "cooling", text: "se enfría", tone: "frost" };
  if (REINFORCE_RE.test(reason)) return { icon: "unlocks", text: "reforzar", tone: "gold" };
  const nextUnit = reason.match(NEXT_UNIT_RE);
  if (nextUnit) return { icon: "unit", text: `Tema ${nextUnit[1]}` };
  const seen = reason.match(SEEN_RE);
  if (seen) return { icon: "firstRecall", text: seen[2] };
  return { icon: "dependencies", text: reason };
}

let shortNameToCode: Map<string, string> | null = null;

/** "Preprocesamiento" → "PMD": para que las listas de asignaturas de la cola quepan en una ficha. */
function subjectCode(shortName: string): string {
  if (!shortNameToCode) shortNameToCode = new Map(catalog.subjects.map((s) => [s.shortName, subjectAbbr(s.id)]));
  return shortNameToCode.get(shortName) ?? shortName;
}

/** "Preprocesamiento, Algoritmia y 6 más" (nombres de `listNames`) → "PMD · ALC +6" (códigos). */
function codeList(text: string): string {
  const overflow = text.match(/^(.*?)\s+y\s+(\d+)\s+más$/);
  if (overflow) return `${overflow[1].split(", ").map(subjectCode).join(" · ")} +${overflow[2]}`;
  return text.split(/,\s*|\s+y\s+/).filter(Boolean).map(subjectCode).join(" · ");
}

/** Ficha de dependencias ("base de N" / "lo usan X"), si el motivo la trae. */
function dependencyChip(reason: string): QueueReasonChip | null {
  const base = reason.match(BASE_RE);
  if (base) return { icon: "dependencies", text: `base de ${base[1]}` };
  const used = reason.match(USED_RE);
  if (used) return { icon: "dependencies", text: `lo usan ${codeList(used[1])}` };
  return null;
}

/**
 * Hasta dos fichas por fila de la cola (regla de densidad §5): el motivo más
 * fuerte (`reasons[0]`), y la primera dependencia que aparezca en el resto
 * ("Base directa de N" / "Lo necesitarás en X"), si la hay.
 */
export function queueReasonChips(reasons: readonly string[]): QueueReasonChip[] {
  if (reasons.length === 0) return [];
  const chips = [primaryReasonChip(reasons[0])];
  for (let i = 1; i < reasons.length; i++) {
    const dep = dependencyChip(reasons[i]);
    if (dep) {
      chips.push(dep);
      break;
    }
  }
  return chips;
}
