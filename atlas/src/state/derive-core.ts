// Núcleo de los derivados, sin React (se puede medir y probar en Node).
//
// El progreso se calcula de forma incremental: cada concepto guarda su lista de
// eventos y el resultado de reproducirla; al cambiar el registro solo se
// reproducen los conceptos cuya lista ha cambiado (en el caso habitual, añadir
// eventos al final, ni siquiera se reagrupa). La frescura (que depende de
// `now`) se recalcula aparte, una vez por minuto. Si cambia la retención
// deseada, se invalida todo.
import type { CatalogIndex } from "../domain/catalog";
import type { Expedition, Legend, Profile, SessionLog, StudyEvent, Trial, UserState } from "../domain/types";
import { createDayKeyer, dayKey } from "../domain/time";
import { createScheduler, type Scheduler } from "../domain/tutor/scheduler";
import { replayConcept, type ConceptProgress } from "../domain/tutor/mastery";
import { examReadiness } from "../domain/tutor/forecast";
import { upcomingAssessments } from "../domain/tutor/queue";
import { activeDaysFrom, isAttemptedReview, type DayActivity } from "../domain/game/activity";
import { goalsFrom, perfectWeeks, type WeeklyGoal } from "../domain/game/goals";
import { levelFromXp, rankOf, type PlayerLevel, type Rank } from "../domain/game/levels";
import { longestStreak, streakInfo, type StreakInfo } from "../domain/game/streak";
import { XP_RULES, type XpTotals } from "../domain/game/xp";
import { ACHIEVEMENT_BY_ID, evaluateAchievements } from "../domain/game/achievements";
import { completedDayPlans } from "../domain/plan";

/** Preparación prevista mínima la víspera de un examen para la insignia `examen-preparado`. */
const EXAM_READY_THRESHOLD = 0.9;

const sameList = (a: readonly StudyEvent[], b: readonly StudyEvent[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** true si `prev` es prefijo de `next` elemento a elemento (misma referencia). */
const isPrefix = (prev: readonly StudyEvent[], next: readonly StudyEvent[]): boolean => {
  if (prev.length > next.length) return false;
  for (let i = 0; i < prev.length; i++) if (prev[i] !== next[i]) return false;
  return true;
};

/** Caché incremental del progreso por concepto. */
export class ProgressCache {
  private retention = Number.NaN;
  private schedulerRef: Scheduler = createScheduler(0.9);
  private events: readonly StudyEvent[] | null = null;
  private lists = new Map<string, StudyEvent[]>();
  private base = new Map<string, ConceptProgress>();
  /** Cambia cada vez que cambia algún progreso base (nivel, tarjeta, subidas). */
  private versionRef = 0;
  private atMs = Number.NaN;
  private atVersion = -1;
  private at: Map<string, ConceptProgress> = new Map();

  get scheduler(): Scheduler {
    return this.schedulerRef;
  }
  get version(): number {
    return this.versionRef;
  }
  /** Progreso base: niveles y tarjetas (su `retrievability` no está al día; usa `progressAt`). */
  get baseProgress(): ReadonlyMap<string, ConceptProgress> {
    return this.base;
  }

  /** Sincroniza con el registro. Devuelve los conceptos reproducidos de nuevo. */
  sync(events: readonly StudyEvent[], retention: number, now: Date): string[] {
    if (retention !== this.retention) {
      this.retention = retention;
      this.schedulerRef = createScheduler(retention);
      this.events = null;
      this.lists = new Map();
      this.base = new Map();
      this.versionRef++;
    }
    if (events === this.events) return [];

    const dirty = new Set<string>();
    let removed = false;
    const prev = this.events;
    if (prev && isPrefix(prev, events)) {
      // Caso habitual: eventos añadidos al final.
      for (let i = prev.length; i < events.length; i++) {
        const e = events[i];
        const list = this.lists.get(e.conceptId);
        if (list) list.push(e);
        else this.lists.set(e.conceptId, [e]);
        dirty.add(e.conceptId);
      }
    } else {
      // Fusión, importación o deshacer: se reagrupa y se compara concepto a concepto.
      const next = new Map<string, StudyEvent[]>();
      for (const e of events) {
        const list = next.get(e.conceptId);
        if (list) list.push(e);
        else next.set(e.conceptId, [e]);
      }
      for (const [id, list] of next) {
        const old = this.lists.get(id);
        if (!old || !sameList(old, list)) dirty.add(id);
      }
      for (const id of this.lists.keys()) {
        if (!next.has(id)) {
          this.base.delete(id);
          removed = true;
        }
      }
      this.lists = next;
    }
    for (const id of dirty) this.base.set(id, replayConcept(id, this.lists.get(id)!, this.schedulerRef, now));
    this.events = events;
    if (dirty.size > 0 || removed) this.versionRef++;
    return [...dirty];
  }

  /** Progreso con la frescura calculada en `now` (misma instancia mientras no cambien `now` ni el registro). */
  progressAt(now: Date): Map<string, ConceptProgress> {
    const ms = now.getTime();
    if (ms === this.atMs && this.atVersion === this.versionRef) return this.at;
    const out = new Map<string, ConceptProgress>();
    for (const [id, p] of this.base) {
      out.set(id, p.card ? { ...p, retrievability: this.schedulerRef.retrievability(p.card, now) } : p);
    }
    this.at = out;
    this.atMs = ms;
    this.atVersion = this.versionRef;
    return out;
  }
}

type DayCounts = { reviews: number; seen: number; newConcepts: number };

/**
 * Pliegue incremental del registro: actividad por día (como `dailyActivity`) y
 * XP de los eventos por día (como la primera parte de `totalXp`). Añadir
 * eventos al final solo procesa la cola; cualquier otro cambio rehace el pliegue.
 * Equivalencia comprobada contra las funciones del dominio.
 */
export class EventFold {
  private events: readonly StudyEvent[] | null = null;
  private firstAt = new Map<string, number>();
  private counts = new Map<string, DayCounts>();
  private eventXp = new Map<string, number>();
  private toDay = createDayKeyer();
  private versionRef = 0;
  private activityMemo: { version: number; sessions: readonly SessionLog[]; value: Map<string, DayActivity> } | null = null;

  get version(): number {
    return this.versionRef;
  }
  /** XP de los eventos (`seen` y repasos intentados) por día. */
  get eventXpByDay(): ReadonlyMap<string, number> {
    return this.eventXp;
  }

  sync(events: readonly StudyEvent[]): void {
    if (events === this.events) return;
    const prev = this.events;
    let from = 0;
    if (prev && isPrefix(prev, events)) from = prev.length;
    else {
      this.firstAt = new Map();
      this.counts = new Map();
      this.eventXp = new Map();
    }
    for (let i = from; i < events.length; i++) this.fold(events[i]);
    this.events = events;
    this.versionRef++;
  }

  private day(key: string): DayCounts {
    let c = this.counts.get(key);
    if (!c) {
      c = { reviews: 0, seen: 0, newConcepts: 0 };
      this.counts.set(key, c);
    }
    return c;
  }

  private fold(e: StudyEvent): void {
    if (e.kind === "implicit") return;
    const t = Date.parse(e.at);
    const first = this.firstAt.get(e.conceptId);
    if (first === undefined || t < first) {
      if (first !== undefined) this.day(this.toDay(first)).newConcepts--;
      this.day(this.toDay(t)).newConcepts++;
      this.firstAt.set(e.conceptId, t);
    }
    let xp = 0;
    if (isAttemptedReview(e)) {
      this.day(this.toDay(t)).reviews++;
      xp = XP_RULES.review[e.grade!];
    } else if (e.kind === "seen") {
      this.day(this.toDay(t)).seen++;
      xp = XP_RULES.seen;
    }
    if (xp > 0) {
      const key = this.toDay(t);
      this.eventXp.set(key, (this.eventXp.get(key) ?? 0) + xp);
    }
  }

  /** Actividad por día con las sesiones completadas (misma forma que `dailyActivity`). */
  activity(sessions: readonly SessionLog[]): Map<string, DayActivity> {
    const m = this.activityMemo;
    if (m && m.version === this.versionRef && m.sessions === sessions) return m.value;
    const out = new Map<string, DayActivity>();
    for (const [key, c] of this.counts) {
      if (c.reviews === 0 && c.seen === 0 && c.newConcepts === 0) continue;
      out.set(key, { reviews: c.reviews, seen: c.seen, newConcepts: c.newConcepts, completedSessions: 0 });
    }
    for (const s of sessions) {
      if (!s.completed) continue;
      const key = this.toDay(s.endedAt);
      const a = out.get(key);
      if (a) a.completedSessions++;
      else out.set(key, { reviews: 0, seen: 0, newConcepts: 0, completedSessions: 1 });
    }
    this.activityMemo = { version: this.versionRef, sessions, value: out };
    return out;
  }
}

/**
 * XP total por día, igual que `totalXp` del dominio pero reutilizando el pliegue
 * incremental de eventos: el resto (subidas de nivel, sesiones, objetivo
 * diario, cofre semanal, Misión del día e insignias) es proporcional a
 * conceptos, días o sesiones, no al número de eventos. `completedDays` son los
 * días de Misión del día completados (`completedDayPlans`).
 */
export function xpFrom(
  eventXp: ReadonlyMap<string, number>,
  activity: ReadonlyMap<string, DayActivity>,
  state: Pick<UserState, "sessions" | "achievements">,
  progress: ReadonlyMap<string, ConceptProgress>,
  completedDays: readonly string[] = [],
): XpTotals {
  const toDay = createDayKeyer();
  const byDay: Record<string, number> = {};
  let total = 0;
  const give = (day: string, xp: number) => {
    if (xp <= 0) return;
    byDay[day] = (byDay[day] ?? 0) + xp;
    total += xp;
  };
  for (const [day, xp] of eventXp) give(day, xp);
  for (const p of progress.values()) for (const up of p.levelUps) give(toDay(up.at), XP_RULES.levelUp[up.level]);
  for (const s of state.sessions) if (s.completed) give(toDay(s.endedAt), XP_RULES.session);
  for (const [day, a] of activity) if (a.reviews + a.seen >= XP_RULES.dailyGoalEvents) give(day, XP_RULES.dailyGoal);
  for (const w of perfectWeeks(activity)) give(w.day, XP_RULES.weeklyChest);
  for (const day of completedDays) give(day, XP_RULES.dayPlan);
  for (const [id, at] of Object.entries(state.achievements)) {
    const achievement = ACHIEVEMENT_BY_ID.get(id);
    if (achievement) give(toDay(at), achievement.xp);
  }
  return { total, byDay };
}

export type Derived = {
  now: Date;
  scheduler: Scheduler;
  /** Progreso de los conceptos con eventos, con la frescura en `now`. Usa `progressOf` para los demás. */
  progress: Map<string, ConceptProgress>;
  xp: XpTotals;
  level: PlayerLevel;
  rank: Rank;
  /** Actividad por día (repasos, vistos, sesiones, conceptos nuevos). */
  activity: Map<string, DayActivity>;
  activeDays: Set<string>;
  streak: StreakInfo;
  longestStreak: number;
  /** Objetivos de la semana ISO en curso. */
  goals: WeeklyGoal[];
  /** Días ("YYYY-MM-DD", en orden) con la Misión del día completada. */
  completedDays: string[];
  /**
   * Insignias cuyo requisito se cumple ahora (incluida `examen-preparado`).
   * Se calcula al leerlo por primera vez (recorre todo el registro): léelo fuera
   * del camino crítico (efecto o tarea en reposo), como hace Celebrations.
   */
  readonly unlocked: string[];
};

export type DeriverOptions = {
  index: CatalogIndex;
  expeditions: readonly Expedition[];
  guides: readonly (Legend | Profile)[];
  trials: readonly Trial[];
};

type Memo<K extends unknown[], V> = { keys: K | null; value: V | undefined };
const memo = <K extends unknown[], V>(): Memo<K, V> => ({ keys: null, value: undefined });
function cached<K extends unknown[], V>(m: Memo<K, V>, keys: K, compute: () => V): V {
  if (m.keys && m.keys.length === keys.length && m.keys.every((k, i) => Object.is(k, keys[i]))) return m.value as V;
  const value = compute();
  m.keys = keys;
  m.value = value;
  return value;
}

/**
 * Crea una función `derive(state, now)` con memoria: cada pieza se recalcula
 * solo cuando cambian sus entradas (registro, sesiones, insignias, día…).
 */
export function createDeriver({ index, expeditions, guides, trials }: DeriverOptions) {
  const cache = new ProgressCache();
  const fold = new EventFold();
  const mActive = memo<[unknown], Set<string>>();
  const mLongest = memo<[unknown], number>();
  const mStreak = memo<[unknown, string], StreakInfo>();
  const mGoals = memo<[unknown, string], WeeklyGoal[]>();
  const mDays = memo<[unknown, unknown, unknown], string[]>();
  const mXp = memo<[number, unknown, unknown, unknown, number, unknown], XpTotals>();
  const mUnlocked = memo<[unknown, unknown, number, unknown, boolean, unknown, unknown], string[]>();
  const mExamReady = memo<[unknown, number, string], boolean>();
  let last: { state: UserState; ms: number; value: Derived } | null = null;

  return function derive(state: UserState, now: Date): Derived {
    if (last && last.state === state && last.ms === now.getTime()) return last.value;
    const today = dayKey(now);
    cache.sync(state.events, state.settings.desiredRetention, now);
    fold.sync(state.events);
    const version = cache.version;
    const base = cache.baseProgress;
    const progress = cache.progressAt(now);

    const activity = fold.activity(state.sessions);
    const activeDays = cached(mActive, [activity], () => activeDaysFrom(activity));
    const longest = cached(mLongest, [activeDays], () => longestStreak(activeDays));
    const streak = cached(mStreak, [activeDays, today], () => streakInfo(activeDays, now));
    const goals = cached(mGoals, [activity, today], () => goalsFrom(activity, now));
    // Misión del día: solo cambia con las instantáneas, el registro o los intentos de prueba.
    const completedDays = cached(mDays, [state.dayPlans, state.events, state.trials], () => completedDayPlans(state));
    const xp = cached(mXp, [fold.version, activity, state.sessions, state.achievements, version, completedDays], () =>
      xpFrom(fold.eventXpByDay, activity, state, base, completedDays),
    );
    const level = levelFromXp(xp.total);

    // Las insignias recorren todo el registro: se calculan solo si alguien las lee.
    const unlockedFor = (): string[] => {
      // `examen-preparado` lo decide la interfaz: víspera de un examen con preparación prevista ≥ 90 %.
      const examReady = cached(mExamReady, [state.subjects, version, today], () => {
        for (const list of upcomingAssessments(index, state, now).values()) {
          for (const up of list) {
            if (up.days !== 1 || up.assessment.unitIds.length === 0) continue;
            const r = examReadiness({ index, progress, scheduler: cache.scheduler, assessment: up.assessment });
            if (r.expected >= EXAM_READY_THRESHOLD) return true;
          }
        }
        return false;
      });
      return cached(mUnlocked, [state.events, state.sessions, version, state.expeditions, examReady, state.trials, state.dayPlans], () => {
        const ids = evaluateAchievements({ index, state, progress: base, expeditions, guides, trials });
        return examReady && !ids.includes("examen-preparado") ? [...ids, "examen-preparado"] : ids;
      });
    };

    let unlocked: string[] | null = null;
    const value: Derived = {
      now,
      scheduler: cache.scheduler,
      progress,
      xp,
      level,
      rank: rankOf(level.level),
      activity,
      activeDays,
      streak,
      longestStreak: longest,
      goals,
      completedDays,
      get unlocked() {
        return (unlocked ??= unlockedFor());
      },
    };
    last = { state, ms: now.getTime(), value };
    return value;
  };
}
