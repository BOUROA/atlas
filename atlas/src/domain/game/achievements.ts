// Insignias (logros; especificación §7). Todo se deriva del estado: la
// interfaz guarda en `state.achievements` la fecha en que se desbloquea cada una.
import type { CatalogIndex } from "../catalog";
import { campaignOf } from "../campaigns";
import type { Expedition, Legend, Profile, Trial, UserState } from "../types";
import { PASSING_GRADE, scoreOf } from "../expeditions";
import { legendProgress, profileProgress } from "../legends";
import { completedDayPlans } from "../plan";
import { isoWeekKey, parseDayKey } from "../time";
import { trialResult } from "../trials";
import { conceptImpact } from "../tutor/impact";
import { progressOf, type ConceptProgress } from "../tutor/mastery";
import { activeDaysFrom, dailyActivity, isAttemptedReview } from "./activity";
import { perfectWeeks } from "./goals";
import { longestStreak } from "./streak";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  /** XP que da al desbloquearse (100–500). */
  xp: number;
  /** Nombre de icono de lucide (kebab-case). */
  icon: string;
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "primer-paso", title: "Primer paso", description: "Registra tu primer estudio en Atlas.", xp: 100, icon: "footprints" },
  { id: "primera-sesion", title: "Primera sesión", description: "Completa tu primera sesión de estudio.", xp: 100, icon: "play" },
  { id: "diez-sesiones", title: "Diez sesiones", description: "Completa 10 sesiones de estudio.", xp: 150, icon: "repeat" },
  { id: "cincuenta-sesiones", title: "Cincuenta sesiones", description: "Completa 50 sesiones de estudio.", xp: 300, icon: "repeat-2" },
  { id: "cien-sesiones", title: "Cien sesiones", description: "Completa 100 sesiones de estudio.", xp: 500, icon: "infinity" },
  { id: "constancia-7", title: "Constancia · 7 días", description: "Mantén una racha de 7 días.", xp: 150, icon: "flame" },
  { id: "constancia-30", title: "Constancia · 30 días", description: "Mantén una racha de 30 días.", xp: 300, icon: "flame" },
  { id: "constancia-60", title: "Constancia · 60 días", description: "Mantén una racha de 60 días.", xp: 500, icon: "flame" },
  { id: "semana-perfecta", title: "Semana perfecta", description: "Cumple los tres objetivos de una semana.", xp: 200, icon: "calendar-check" },
  { id: "primer-dominio", title: "Primer dominio", description: "Domina tu primer concepto.", xp: 150, icon: "star" },
  { id: "tema-completo", title: "Tema completo", description: "Enciende todas las estrellas de un tema.", xp: 150, icon: "circle-check" },
  { id: "asignatura-25", title: "Constelación al 25 %", description: "Enciende el 25 % de las estrellas de una asignatura.", xp: 150, icon: "star-half" },
  { id: "asignatura-50", title: "Constelación al 50 %", description: "Enciende la mitad de las estrellas de una asignatura.", xp: 250, icon: "moon-star" },
  { id: "asignatura-75", title: "Constelación al 75 %", description: "Enciende el 75 % de las estrellas de una asignatura.", xp: 350, icon: "sparkle" },
  { id: "asignatura-100", title: "Constelación completa", description: "Enciende todas las estrellas de una asignatura.", xp: 500, icon: "sun" },
  { id: "cien-conceptos", title: "Cien estrellas", description: "Enciende 100 estrellas.", xp: 250, icon: "sparkles" },
  { id: "trescientos-conceptos", title: "Trescientas estrellas", description: "Enciende 300 estrellas.", xp: 500, icon: "galaxy" },
  { id: "dominio-50", title: "Cincuenta dominadas", description: "Domina 50 conceptos.", xp: 400, icon: "crown" },
  { id: "puente", title: "Puente", description: "Domina un concepto que se necesita en tres asignaturas o más.", xp: 250, icon: "link" },
  { id: "cadena-completa", title: "Cadena completa", description: "Enciende un concepto difícil junto con toda la cadena de bases que lo sostiene.", xp: 250, icon: "network" },
  { id: "explorador", title: "Explorador", description: "Ve al menos un concepto de cada asignatura del curso.", xp: 150, icon: "compass" },
  { id: "racha-aciertos-25", title: "Veinticinco seguidos", description: "Acierta 25 repasos seguidos.", xp: 200, icon: "target" },
  { id: "calibrado", title: "Calibrado", description: "Acierta al menos el 80 % de las respuestas en las que ibas seguro, con 30 o más.", xp: 250, icon: "gauge" },
  { id: "sin-miedo", title: "Sin miedo", description: "Registra 10 fallos: equivocarse también es estudiar.", xp: 100, icon: "shield" },
  { id: "mil-repasos", title: "Mil repasos", description: "Haz 1000 repasos.", xp: 300, icon: "layers" },
  { id: "maraton", title: "Maratón", description: "Haz 150 repasos en un mismo día.", xp: 300, icon: "zap" },
  { id: "madrugador", title: "Madrugador", description: "Completa una sesión entre las 5:00 y las 8:00.", xp: 100, icon: "sunrise" },
  { id: "noctambulo", title: "Noctámbulo", description: "Completa una sesión entre las 23:00 y las 5:00.", xp: 100, icon: "moon" },
  { id: "examen-preparado", title: "Examen preparado", description: "Llega a la víspera de un examen con una preparación prevista del 90 % o más.", xp: 300, icon: "shield-check" },
  { id: "primera-mision", title: "Primera misión", description: "Completa tu primera misión (examen real de otra universidad).", xp: 150, icon: "rocket" },
  { id: "mision-superada", title: "Misión superada", description: "Supera una misión con nota 7 o más.", xp: 200, icon: "award" },
  { id: "cinco-misiones", title: "Cinco misiones", description: "Completa 5 misiones.", xp: 300, icon: "orbit" },
  { id: "tres-universidades", title: "Tres universidades", description: "Completa misiones de 3 universidades distintas.", xp: 250, icon: "globe" },
  { id: "primera-guia", title: "Primera estrella guía", description: "Enciende toda la constelación de tu primera estrella guía.", xp: 200, icon: "telescope" },
  { id: "cinco-guias", title: "Cinco estrellas guía", description: "Enciende la constelación de 5 estrellas guía.", xp: 350, icon: "stars" },
  { id: "todas-las-guias", title: "Firmamento completo", description: "Enciende la constelación de todas las estrellas guía.", xp: 500, icon: "galaxy" },
  { id: "primera-prueba", title: "Primera prueba", description: "Completa tu primera prueba sintética.", xp: 100, icon: "clipboard-check" },
  { id: "control-perfecto", title: "Control perfecto", description: "Saca un 10 en un control de tema.", xp: 150, icon: "trophy" },
  { id: "tema-a-tema", title: "Tema a tema", description: "Supera todos los controles de una asignatura.", xp: 250, icon: "list-checks" },
  { id: "simulacro-superado", title: "Simulacro superado", description: "Supera un simulacro de final con nota 7 o más.", xp: 300, icon: "graduation-cap" },
  { id: "nivel-maximo", title: "Nivel máximo", description: "Saca un 9 o más en un simulacro de nivel Máximo.", xp: 400, icon: "gem" },
  { id: "cumbre", title: "Cumbre", description: "Supera el último peldaño de una campaña de élite.", xp: 500, icon: "mountain" },
  { id: "dia-redondo", title: "Día redondo", description: "Completa todas las misiones de una Misión del día.", xp: 100, icon: "calendar-check" },
  { id: "semana-redonda", title: "Semana redonda", description: "Completa la Misión del día los siete días de una semana.", xp: 300, icon: "calendar-range" },
  { id: "constancia-de-hierro", title: "Constancia de hierro", description: "Completa la Misión del día 30 días.", xp: 500, icon: "shield-check" },
];

export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, Achievement> = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export type AchievementInput = {
  index: CatalogIndex;
  state: UserState;
  progress: ReadonlyMap<string, ConceptProgress>;
  /** Misiones conocidas: sin ellas, las insignias de misión (incluida `cumbre`) no se evalúan. */
  expeditions?: readonly Expedition[];
  /** Estrellas guía conocidas (leyendas y perfiles destacados): sin ellas, sus insignias no se evalúan. */
  guides?: readonly (Legend | Profile)[];
  /** Pruebas conocidas: sin ellas, sus insignias no se evalúan. */
  trials?: readonly Trial[];
};

const CORRECT_RUN = 25;
const CALIBRATION_MIN = 30;
const CALIBRATION_RATE = 0.8;
const MARATHON_REVIEWS = 150;
const FAILS_NEEDED = 10;
const BRIDGE_SUBJECTS = 3;
const HARD_DIFFICULTY = 3;
/** Días de Misión del día completados para «Constancia de hierro». */
const IRON_DAYS = 30;

/**
 * Ids de las insignias cuyo requisito se cumple ahora (en el orden de
 * `ACHIEVEMENTS`). Las rachas y marcas se miran sobre toda la historia; los
 * niveles, en su estado actual. `examen-preparado` depende de la previsión y
 * lo decide la interfaz. O(eventos + conceptos + relaciones).
 */
export function evaluateAchievements({ index, state, progress, expeditions, guides, trials }: AchievementInput): string[] {
  const got = new Set<string>();
  const levelOf = (id: string) => progressOf(progress, id).level;

  // Eventos: aciertos seguidos (en orden cronológico), calibración, fallos y repasos.
  if (state.events.length > 0) got.add("primer-paso");
  const events = chronological(state.events);
  let run = 0;
  let bestRun = 0;
  let sure = 0;
  let sureHits = 0;
  let fails = 0;
  let reviews = 0;
  for (const e of events) {
    if (e.kind !== "review") continue;
    if (!isAttemptedReview(e)) {
      run = 0;
      continue;
    }
    reviews++;
    const hit = e.grade! >= 3;
    run = hit ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
    if (e.grade === 1) fails++;
    if (e.confidence === 3) {
      sure++;
      if (hit) sureHits++;
    }
  }
  if (bestRun >= CORRECT_RUN) got.add("racha-aciertos-25");
  if (sure >= CALIBRATION_MIN && sureHits / sure >= CALIBRATION_RATE) got.add("calibrado");
  if (fails >= FAILS_NEEDED) got.add("sin-miedo");
  if (reviews >= 1000) got.add("mil-repasos");

  // Sesiones.
  let sessions = 0;
  for (const s of state.sessions) {
    if (!s.completed) continue;
    sessions++;
    const hour = new Date(s.endedAt).getHours();
    if (hour >= 5 && hour < 8) got.add("madrugador");
    if (hour >= 23 || hour < 5) got.add("noctambulo");
  }
  if (sessions >= 1) got.add("primera-sesion");
  if (sessions >= 10) got.add("diez-sesiones");
  if (sessions >= 50) got.add("cincuenta-sesiones");
  if (sessions >= 100) got.add("cien-sesiones");

  // Actividad diaria: racha, maratón y semana perfecta.
  const activity = dailyActivity(state);
  const longest = longestStreak(activeDaysFrom(activity));
  if (longest >= 7) got.add("constancia-7");
  if (longest >= 30) got.add("constancia-30");
  if (longest >= 60) got.add("constancia-60");
  for (const a of activity.values()) if (a.reviews >= MARATHON_REVIEWS) got.add("maraton");
  if (perfectWeeks(activity).length > 0) got.add("semana-perfecta");

  // Misión del día: días completados, en total y por semana ISO.
  const completedDays = completedDayPlans(state);
  if (completedDays.length >= 1) got.add("dia-redondo");
  if (completedDays.length >= IRON_DAYS) got.add("constancia-de-hierro");
  const byWeek = new Map<string, number>();
  for (const day of completedDays) {
    const week = isoWeekKey(parseDayKey(day));
    byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
  }
  for (const n of byWeek.values()) if (n >= 7) got.add("semana-redonda");

  // Niveles.
  let lit = 0;
  let mastered = 0;
  const seenSubjects = new Set<string>();
  for (const p of progress.values()) {
    const concept = index.conceptById.get(p.conceptId);
    if (!concept) continue;
    if (p.level >= 1) seenSubjects.add(concept.subjectId);
    if (p.level >= 2) lit++;
    if (p.level === 3) {
      mastered++;
      if (conceptImpact(index, p.conceptId).neededIn.length + 1 >= BRIDGE_SUBJECTS) got.add("puente");
    }
    if (p.levelUps.some((u) => u.level === 3)) got.add("primer-dominio");
  }
  if (lit >= 100) got.add("cien-conceptos");
  if (lit >= 300) got.add("trescientos-conceptos");
  if (mastered >= 50) got.add("dominio-50");

  for (const concepts of index.conceptsByUnit.values()) {
    if (concepts.length > 0 && concepts.every((c) => levelOf(c.id) >= 2)) {
      got.add("tema-completo");
      break;
    }
  }
  let bestShare = 0;
  const courseSubjects: string[] = [];
  for (const s of index.subjects) {
    const concepts = index.conceptsOfSubject(s.id);
    if (concepts.length === 0) continue;
    if (s.status === "current") courseSubjects.push(s.id);
    bestShare = Math.max(bestShare, concepts.filter((c) => levelOf(c.id) >= 2).length / concepts.length);
  }
  for (const [share, id] of [[0.25, "asignatura-25"], [0.5, "asignatura-50"], [0.75, "asignatura-75"], [1, "asignatura-100"]] as const) {
    if (bestShare >= share) got.add(id);
  }
  if (courseSubjects.length > 0 && courseSubjects.every((sid) => seenSubjects.has(sid))) got.add("explorador");

  // Cadena completa: concepto difícil encendido con toda su cadena de bases encendida (memoizado).
  const chainLit = new Map<string, boolean>();
  const chainOk = (id: string): boolean => {
    const known = chainLit.get(id);
    if (known !== undefined) return known;
    const ok = (index.requiresOf.get(id) ?? []).every((req) => levelOf(req) >= 2 && chainOk(req));
    chainLit.set(id, ok);
    return ok;
  };
  for (const p of progress.values()) {
    const concept = index.conceptById.get(p.conceptId);
    if (!concept || concept.difficulty < HARD_DIFFICULTY || p.level < 2) continue;
    if ((index.requiresOf.get(p.conceptId) ?? []).length > 0 && chainOk(p.conceptId)) {
      got.add("cadena-completa");
      break;
    }
  }

  // Misiones: solo se evalúan si se pasa el catálogo de expediciones (para
  // conocer universidad/curso y poder calcular la nota de cada intento).
  if (expeditions && expeditions.length > 0) {
    const byId = new Map(expeditions.map((e) => [e.id, e]));
    let completedAttempts = 0;
    let anyPassed = false;
    const universities = new Set<string>();
    for (const [expId, attempts] of Object.entries(state.expeditions ?? {})) {
      const exp = byId.get(expId);
      if (!exp) continue;
      for (const attempt of attempts) {
        if (!attempt.endedAt) continue;
        completedAttempts++;
        universities.add(exp.university);
        if (scoreOf(exp, attempt) >= PASSING_GRADE) anyPassed = true;
      }
    }
    if (completedAttempts >= 1) got.add("primera-mision");
    if (anyPassed) got.add("mision-superada");
    if (completedAttempts >= 5) got.add("cinco-misiones");
    if (universities.size >= 3) got.add("tres-universidades");
    // Cumbre: el último peldaño de la campaña de élite de alguna asignatura, superado.
    for (const s of index.subjects) {
      if (campaignOf(s.id, expeditions, state, progress).summitPassed) {
        got.add("cumbre");
        break;
      }
    }
  }

  // Pruebas: solo se evalúan si se pasa el catálogo de pruebas.
  if (trials && trials.length > 0) {
    let anyFinished = false;
    const controlsBySubject = new Map<string, Trial[]>();
    for (const trial of trials) {
      const r = trialResult(trial, state);
      if (r.attempts > 0) anyFinished = true;
      if (trial.kind === "control") {
        const list = controlsBySubject.get(trial.subjectId);
        if (list) list.push(trial);
        else controlsBySubject.set(trial.subjectId, [trial]);
      }
      if (trial.kind === "control" && r.best === 10) got.add("control-perfecto");
      if (trial.kind === "final" && r.passed) got.add("simulacro-superado");
      if (trial.kind !== "control" && trial.level === 4 && r.best !== null && r.best >= 9) got.add("nivel-maximo");
    }
    if (anyFinished) got.add("primera-prueba");
    for (const controls of controlsBySubject.values()) {
      if (controls.length > 0 && controls.every((t) => trialResult(t, state).passed)) got.add("tema-a-tema");
    }
  }

  // Estrellas guía: solo se evalúan si se pasa el catálogo de leyendas/perfiles.
  if (guides && guides.length > 0) {
    let completedGuides = 0;
    for (const g of guides) {
      const gp = "route" in g ? legendProgress(g, progress) : profileProgress(g, progress);
      if (gp.completed) completedGuides++;
    }
    if (completedGuides >= 1) got.add("primera-guia");
    if (completedGuides >= 5) got.add("cinco-guias");
    if (completedGuides === guides.length) got.add("todas-las-guias");
  }

  return ACHIEVEMENTS.filter((a) => got.has(a.id)).map((a) => a.id);
}

/** Los eventos en orden cronológico (estable); sin copiar si ya lo están, como tras `mergeStates`. */
function chronological<T extends { at: string }>(events: readonly T[]): readonly T[] {
  const times = events.map((e) => Date.parse(e.at));
  if (times.every((t, i) => i === 0 || times[i - 1] <= t)) return events;
  return times
    .map((t, i) => [t, i] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([, i]) => events[i]);
}
