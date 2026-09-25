// Rumbo de una asignatura: la secuencia ordenada y con fecha de pasos (temas,
// controles, simulacros y exámenes reales) que llevan a sus misiones
// principales (especificación §6). Puro y determinista: `now` llega siempre
// como parámetro.
import type { CatalogIndex } from "./catalog";
import { addDays, dayKey, daysBetween, parseDayKey } from "./time";
import { starsFor, trialResult, unitsReadiness } from "./trials";
import { subjectStateOf, type Assessment, type Settings, type Trial, type UserState } from "./types";
import type { ConceptProgress } from "./tutor/mastery";

/** Inicio de curso por defecto (grado online): sustituye a la antigua constante fija de pace.ts. */
export const DEFAULT_COURSE_START = "2026-10-21";
/** Final supuesto cuando una asignatura no tiene ninguna misión principal con fecha. */
export const DEFAULT_FINAL_DAY = "2027-02-08";
/** Días antes del final que cierran el reparto de controles (spec §6: "F − 21"). */
const CONTROLS_LEAD_DAYS = 21;
/** Días antes del parcial real que cierran los controles de los temas que cubre (spec §6: "P − 10"). */
const PARCIAL_LEAD_DAYS = 10;
/** Días tras el último control de la primera mitad en que cae el parcial virtual (sin parcial real). */
const VIRTUAL_PARCIAL_LEAD_DAYS = 10;
/** "MM-DD" festivos (cualquier año) en los que no cae ningún paso de preparación: Nochebuena, Navidad, Nochevieja, Año Nuevo, Reyes. */
const HOLIDAYS: ReadonlySet<string> = new Set(["12-24", "12-25", "12-31", "01-01", "01-06"]);
/** Días de margen (a cada lado) al buscar un hueco libre para un simulacro. */
const SPREAD_MAX_OFFSET = 7;

const isHoliday = (day: string): boolean => HOLIDAYS.has(day.slice(5));
/** El mismo día, o el anterior no festivo más cercano. */
const avoidHoliday = (day: string): string => {
  let d = day;
  while (isHoliday(d)) d = dayKey(addDays(parseDayKey(d), -1));
  return d;
};

/**
 * Día de inicio de curso: `settings.courseStart`, o `DEFAULT_COURSE_START` si no
 * se ha ajustado o no tiene forma "YYYY-MM-DD" (p. ej. "" al vaciar el campo o
 * una copia importada dañada): así el rumbo y el ritmo nunca fallan por él.
 */
export const courseStartOf = (settings: Pick<Settings, "courseStart">): string => {
  const day = settings.courseStart;
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : DEFAULT_COURSE_START;
};

export type RouteStepKind = "unit" | "control" | "sim-parcial" | "sim-final" | "exam";
/** `skipped`: paso de preparación sin hacer cuyo examen ya pasó (ya no aplica; no cuenta como atrasado). */
export type RouteStatus = "done" | "late" | "next" | "upcoming" | "skipped";
export type RouteStep = {
  key: string;
  subjectId: string;
  kind: RouteStepKind;
  trialId?: string;
  assessmentId?: string;
  unitIds: string[];
  title: string;
  /** Fecha objetivo "YYYY-MM-DD". */
  due: string;
  status: RouteStatus;
  /** Días hasta `due` (negativo si ya pasó). */
  daysLeft: number;
  /** Proporción de los conceptos de sus temas a nivel ≥ 2 (0–1). */
  readiness: number;
  best: number | null;
  first: number | null;
  stars: 0 | 1 | 2 | 3;
  /** true si la fecha es una plantilla o un final supuesto, no una fecha real todavía. */
  assumed?: boolean;
};
export type SubjectRoute = {
  subjectId: string;
  steps: RouteStep[];
  /** Misión principal más cercana sin superar (o la última, si todas lo están). */
  boss?: RouteStep;
  /** true si ningún paso está atrasado. */
  onTrack: boolean;
  /** Pasos no-examen superados / totales (los exámenes no cuentan en la preparación). */
  done: number;
  total: number;
  /** Pasos de preparación que ya no aplican porque su examen pasó sin hacerlos (fuera de `total`). */
  skipped: number;
};
export type RouteInput = {
  index: CatalogIndex;
  state: UserState;
  progress: ReadonlyMap<string, ConceptProgress>;
  trials: readonly Trial[];
  now: Date;
};

/**
 * Reparte `unitList` entre `startDay` y `endDay` por concepto acumulado,
 * redondeado al día (sin caer en festivo). Un tema sin conceptos pesa como uno
 * (si no, un temario aún vacío caería entero en `startDay`). Si la ventana está
 * invertida (`endDay` < `startDay`: examen a menos de 21 días del inicio de
 * curso, o anterior a él), todos van a `endDay`: nunca se invierte el orden de
 * los temas ni se deja un control para después del examen.
 */
function fillCumulativeDue(
  map: Map<string, string>,
  unitList: readonly { id: string }[],
  startDay: string,
  endDay: string,
  conceptCount: (unitId: string) => number,
): void {
  const weight = (unitId: string) => Math.max(1, conceptCount(unitId));
  const total = unitList.reduce((sum, u) => sum + weight(u.id), 0);
  const spanDays = Math.max(0, daysBetween(startDay, endDay));
  const start = parseDayKey(spanDays > 0 ? startDay : endDay);
  let cumulative = 0;
  for (const u of unitList) {
    cumulative += weight(u.id);
    map.set(u.id, avoidHoliday(dayKey(addDays(start, Math.round((spanDays * cumulative) / total)))));
  }
}

/** `n` fechas entre `startDay` y `endDay` (sin caer en festivo): una sola lleva `startDay`; con varias, se interpolan linealmente. */
function interpolateDates(startDay: string, endDay: string, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [avoidHoliday(startDay)];
  const start = parseDayKey(startDay);
  const span = daysBetween(startDay, endDay);
  return Array.from({ length: n }, (_, i) => avoidHoliday(dayKey(addDays(start, Math.round((span * i) / (n - 1))))));
}

const byLevel = (a: Trial, b: Trial): number => a.level - b.level || a.id.localeCompare(b.id);

type BuiltStep = { step: RouteStep; done: boolean; seq: number };
type MainMission = Assessment & { date: string };

/**
 * Misiones principales de una asignatura: sus evaluaciones con fecha y `kind`
 * parcial o final, por fecha. `finalMission` es la primera de tipo final;
 * `parcialMission`, el primer parcial con fecha posterior al inicio de curso
 * `C` y anterior a `F` (o al final supuesto si no hay ninguna final real): el
 * que reparte los controles. Un parcial anterior al inicio no reparte nada.
 */
function missionsOf(state: UserState, subjectId: string, C: string): { mainMissions: MainMission[]; finalMission?: MainMission; parcialMission?: MainMission; F: string } {
  const mainMissions = subjectStateOf(state, subjectId).assessments
    .filter((a): a is Assessment & { date: string } => Boolean(a.date) && (a.kind === "parcial" || a.kind === "final"))
    .map((a) => ({ ...a, date: dayKey(a.date) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const finalMission = mainMissions.find((a) => a.kind === "final");
  const F = finalMission?.date ?? DEFAULT_FINAL_DAY;
  const parcialMission = mainMissions.find((a) => a.kind === "parcial" && a.date > C && a.date < F);
  return { mainMissions, finalMission, parcialMission, F };
}

/**
 * Temas de la primera mitad del rumbo de una asignatura (los que reparte el
 * parcial): los del parcial real (los suyos de esta asignatura o, si no declara
 * ninguno, los `ceil(n/2)` primeros) o, sin parcial real, los `ceil(n/2)`
 * primeros. Misma regla que `subjectRoute`; la usa el Camino (camino.ts).
 */
export function firstHalfUnitIds(index: CatalogIndex, state: UserState, subjectId: string): string[] {
  const units = index.unitsBySubject.get(subjectId) ?? [];
  const structural = units.slice(0, Math.ceil(units.length / 2)).map((u) => u.id);
  const { parcialMission } = missionsOf(state, subjectId, courseStartOf(state.settings));
  if (!parcialMission) return structural;
  const own = parcialMission.unitIds.filter((id) => units.some((u) => u.id === id));
  return own.length > 0 ? units.filter((u) => own.includes(u.id)).map((u) => u.id) : structural;
}

/** Rumbo de una asignatura: pasos por tema, simulacros y misiones principales, ordenados por fecha. */
export function subjectRoute(input: RouteInput, subjectId: string): SubjectRoute {
  const { index, state, progress, trials, now } = input;
  const today = dayKey(now);
  const C = courseStartOf(state.settings);
  const units = index.unitsBySubject.get(subjectId) ?? [];
  const allUnitIds = units.map((u) => u.id);
  const conceptCount = (unitId: string) => (index.conceptsByUnit.get(unitId) ?? []).length;

  const subjectTrials = trials.filter((t) => t.subjectId === subjectId);
  const controlByUnit = new Map(subjectTrials.filter((t) => t.kind === "control" && t.unitIds.length === 1).map((t) => [t.unitIds[0], t]));
  const simParciales = subjectTrials.filter((t) => t.kind === "parcial").sort(byLevel);
  const simFinales = subjectTrials.filter((t) => t.kind === "final").sort(byLevel);

  const { mainMissions, finalMission, parcialMission, F } = missionsOf(state, subjectId, C);
  const FminusLead = dayKey(addDays(parseDayKey(F), -CONTROLS_LEAD_DAYS));
  // Primera mitad estructural (spec §4.2: `ceil(n/2)` temas): la de los simulacros
  // de parcial y la del parcial virtual.
  const structuralHalf = units.slice(0, Math.ceil(units.length / 2));
  // Temas del parcial real: los suyos de esta asignatura o, si no declara ninguno
  // (lo habitual al crearlo), la primera mitad, como el parcial virtual.
  const parcialUnitIds = (p: Assessment): string[] => {
    const own = p.unitIds.filter((id) => units.some((u) => u.id === id));
    return own.length > 0 ? own : structuralHalf.map((u) => u.id);
  };

  // Fechas objetivo de cada tema (control o, en su defecto, paso de tema): con un
  // parcial real, sus temas se reparten entre C y P−10 y el resto entre P y
  // F−21; sin él, todo el temario entre C y F−21.
  const unitDue = new Map<string, string>();
  if (parcialMission) {
    const covered = new Set(parcialUnitIds(parcialMission));
    const firstHalf = units.filter((u) => covered.has(u.id));
    const secondHalf = units.filter((u) => !covered.has(u.id));
    const PminusLead = dayKey(addDays(parseDayKey(parcialMission.date), -PARCIAL_LEAD_DAYS));
    fillCumulativeDue(unitDue, firstHalf, C, PminusLead, conceptCount);
    fillCumulativeDue(unitDue, secondHalf, parcialMission.date, FminusLead, conceptCount);
  } else {
    fillCumulativeDue(unitDue, units, C, FminusLead, conceptCount);
  }

  // Día del parcial (real, o virtual: último control de la primera mitad estructural + 10).
  let Pday: string;
  if (parcialMission) {
    Pday = parcialMission.date;
  } else {
    const lastOfHalf = structuralHalf[structuralHalf.length - 1];
    const lastDue = lastOfHalf ? unitDue.get(lastOfHalf.id) : undefined;
    Pday = dayKey(addDays(parseDayKey(lastDue ?? C), VIRTUAL_PARCIAL_LEAD_DAYS));
  }

  const ratioOf = (ids: readonly string[]) => unitsReadiness(ids, index, progress).ratio;
  let seq = 0;
  const built: BuiltStep[] = [];

  // 1. Un paso por tema: control si existe su prueba, si no un paso de tema.
  for (const unit of units) {
    const due = unitDue.get(unit.id) ?? C;
    const control = controlByUnit.get(unit.id);
    if (control) {
      const r = trialResult(control, state);
      built.push({
        seq: seq++,
        done: r.passed,
        step: {
          key: control.id, subjectId, kind: "control", trialId: control.id, unitIds: control.unitIds,
          title: control.title, due, status: "upcoming", daysLeft: daysBetween(today, due),
          readiness: ratioOf(control.unitIds), best: r.best, first: r.first, stars: r.stars,
        },
      });
    } else {
      // Hecho cuando el 70 % de sus conceptos está a nivel ≥ 2 (`ready`).
      const r = unitsReadiness([unit.id], index, progress);
      built.push({
        seq: seq++,
        done: r.ready,
        step: {
          key: unit.id, subjectId, kind: "unit", unitIds: [unit.id],
          title: `Tema ${unit.number} · ${unit.title}`, due, status: "upcoming", daysLeft: daysBetween(today, due),
          readiness: r.ratio, best: null, first: null, stars: 0,
        },
      });
    }
  }

  // 2. Simulacros de parcial (A, B…), repartidos entre P−7 y P−3.
  const parcialDates = interpolateDates(dayKey(addDays(parseDayKey(Pday), -7)), dayKey(addDays(parseDayKey(Pday), -3)), simParciales.length);
  simParciales.forEach((trial, i) => {
    const r = trialResult(trial, state);
    const due = parcialDates[i];
    built.push({
      seq: seq++,
      done: r.passed,
      step: {
        key: trial.id, subjectId, kind: "sim-parcial", trialId: trial.id, unitIds: trial.unitIds,
        title: trial.title, due, status: "upcoming", daysLeft: daysBetween(today, due),
        readiness: ratioOf(trial.unitIds), best: r.best, first: r.first, stars: r.stars,
      },
    });
  });

  // 4. Simulacros de final (A, B…), repartidos entre F−14 y F−5.
  const finalDates = interpolateDates(dayKey(addDays(parseDayKey(F), -14)), dayKey(addDays(parseDayKey(F), -5)), simFinales.length);
  simFinales.forEach((trial, i) => {
    const r = trialResult(trial, state);
    const due = finalDates[i];
    built.push({
      seq: seq++,
      done: r.passed,
      step: {
        key: trial.id, subjectId, kind: "sim-final", trialId: trial.id, unitIds: trial.unitIds,
        title: trial.title, due, status: "upcoming", daysLeft: daysBetween(today, due),
        readiness: ratioOf(trial.unitIds), best: r.best, first: r.first, stars: r.stars,
      },
    });
  });

  // 3 y 5. Misiones principales (parciales y finales reales), más el final supuesto si no hay ningún final con fecha.
  const examBuilt: BuiltStep[] = [];
  if (!finalMission) {
    const due = DEFAULT_FINAL_DAY;
    examBuilt.push({
      seq: seq++,
      done: due < today,
      step: {
        key: `${subjectId}:exam:supuesto`, subjectId, kind: "exam", unitIds: allUnitIds,
        title: "Examen final", due, status: "upcoming", daysLeft: daysBetween(today, due),
        readiness: ratioOf(allUnitIds), best: null, first: null, stars: 0, assumed: true,
      },
    });
  }
  {
    for (const a of mainMissions) {
      // Sin temas declarados: un final cubre todo el temario; un parcial, la primera mitad.
      const unitIds = a.unitIds.length > 0 ? a.unitIds : a.kind === "final" ? allUnitIds : parcialUnitIds(a);
      const best = a.grade ?? null;
      examBuilt.push({
        seq: seq++,
        done: best !== null || a.date < today,
        step: {
          key: `${subjectId}:exam:${a.id}`, subjectId, kind: "exam", assessmentId: a.id, unitIds,
          title: a.title, due: a.date, status: "upcoming", daysLeft: daysBetween(today, a.date),
          readiness: ratioOf(unitIds), best, first: best, stars: starsFor(best), assumed: Boolean(a.template),
        },
      });
    }
  }
  built.push(...examBuilt);

  // Orden final: por fecha; a igualdad, por el orden en que se han construido.
  built.sort((a, b) => a.step.due.localeCompare(b.step.due) || a.seq - b.seq);
  return finishRoute(subjectId, built, today);
}

/**
 * Asigna el estado de cada paso (ya en orden de fecha) y resume la
 * asignatura: "done" si está hecho; si no, "late" todo pendiente con fecha
 * ya pasada, "next" el primer pendiente con fecha de hoy en adelante y
 * "upcoming" el resto. Ningún examen (hecho si su fecha ya pasó) puede llegar
 * aquí sin hacer con `due < today`, así que nunca sale "atrasado".
 */
function finishRoute(subjectId: string, items: readonly { step: RouteStep; done: boolean }[], today: string): SubjectRoute {
  // Examen al que prepara cada paso: el primero en o después de él (los pasos ya van ordenados por fecha).
  const preparedExamDue: (string | undefined)[] = new Array(items.length);
  let nextExamDue: string | undefined;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].step.kind === "exam") nextExamDue = items[i].step.due;
    preparedExamDue[i] = nextExamDue;
  }
  let foundNext = false;
  items.forEach(({ step, done }, i) => {
    if (done) {
      step.status = "done";
      return;
    }
    const examDue = preparedExamDue[i];
    if (step.kind !== "exam" && examDue !== undefined && examDue < today) step.status = "skipped";
    else if (step.due < today) step.status = "late";
    else if (!foundNext) {
      step.status = "next";
      foundNext = true;
    } else step.status = "upcoming";
  });

  const steps = items.map((i) => i.step);
  const nonExam = steps.filter((s) => s.kind !== "exam");
  const examSteps = steps.filter((s) => s.kind === "exam");
  const boss = examSteps.find((s) => s.status !== "done") ?? examSteps[examSteps.length - 1];

  return {
    subjectId,
    steps,
    boss,
    onTrack: !steps.some((s) => s.status === "late"),
    done: nonExam.filter((s) => s.status === "done").length,
    total: nonExam.filter((s) => s.status !== "skipped").length,
    skipped: nonExam.filter((s) => s.status === "skipped").length,
  };
}

/**
 * Rumbo de cada asignatura del curso actual, en el orden de carril (`order`),
 * con sus simulacros repartidos (`spreadSimulacros`) para que, como mucho,
 * haya uno por día entre todas. `subjectRoute` por sí solo no reparte: no
 * conoce las demás asignaturas.
 */
export function buildRoutes(input: RouteInput): SubjectRoute[] {
  const routes = input.index.subjects.filter((s) => s.status === "current").map((s) => subjectRoute(input, s.id));
  return spreadSimulacros(routes, input);
}

type SimRef = { routeIdx: number; step: RouteStep; lower: string; upper: string };

/**
 * Reparte los simulacros (sim-parcial y sim-final) de todas las asignaturas
 * para que, como mucho, haya uno por día: se procesan por (fecha, orden de
 * asignatura) y, si el día ya está ocupado, se prueba +1, −1, +2, −2… hasta
 * ±7 días (saltando festivos y días ya ocupados), acotado por arriba al día
 * anterior a la misión que prepara el simulacro (P−1 para los de parcial con
 * parcial real, F−1 para los de final, también con el final supuesto; sin
 * parcial real, fecha+7 pero nunca después de F−1) y por abajo a fecha−7. Sin
 * hueco libre, se conserva la fecha. Reordena y recalcula el estado de las
 * asignaturas afectadas.
 */
function spreadSimulacros(routes: SubjectRoute[], input: RouteInput): SubjectRoute[] {
  const refs: SimRef[] = [];
  const dayBefore = (day: string) => dayKey(addDays(parseDayKey(day), -1));
  routes.forEach((r, routeIdx) => {
    const { parcialMission, F } = missionsOf(input.state, r.subjectId, courseStartOf(input.state.settings));
    for (const step of r.steps) {
      if (step.kind !== "sim-parcial" && step.kind !== "sim-final") continue;
      // El final supuesto también es un paso del rumbo: ningún simulacro puede pasarlo.
      let upper = dayBefore(F);
      if (step.kind === "sim-parcial") {
        const own = parcialMission ? dayBefore(parcialMission.date) : dayKey(addDays(parseDayKey(step.due), SPREAD_MAX_OFFSET));
        if (own < upper) upper = own;
      }
      const lower = dayKey(addDays(parseDayKey(step.due), -SPREAD_MAX_OFFSET));
      refs.push({ routeIdx, step, lower, upper });
    }
  });
  if (refs.length === 0) return routes;
  refs.sort((a, b) => a.step.due.localeCompare(b.step.due) || a.routeIdx - b.routeIdx);

  const taken = new Set<string>();
  const movedTo = new Map<string, string>(); // key del paso → nuevo `due`
  for (const ref of refs) {
    const original = ref.step.due;
    const chosen = taken.has(original) ? findSlot(original, ref.lower, ref.upper, taken) ?? original : original;
    taken.add(chosen);
    if (chosen !== original) movedTo.set(ref.step.key, chosen);
  }
  if (movedTo.size === 0) return routes;

  const today = dayKey(input.now);
  return routes.map((r) => {
    let touched = false;
    const items = r.steps.map((s, i) => {
      const due = movedTo.get(s.key);
      if (due === undefined) return { step: s, done: s.status === "done", i };
      touched = true;
      return { step: { ...s, due, daysLeft: daysBetween(today, due) }, done: s.status === "done", i };
    });
    if (!touched) return r;
    // Mismo orden que `subjectRoute` (fecha y, a igualdad, orden de construcción):
    // el tipo reproduce ese orden entre grupos y la posición previa, dentro de cada uno.
    items.sort((a, b) => a.step.due.localeCompare(b.step.due) || BUILD_RANK[a.step.kind] - BUILD_RANK[b.step.kind] || a.i - b.i);
    return finishRoute(r.subjectId, items, today);
  });
}

/** Orden en que `subjectRoute` construye los pasos: temas y controles, simulacros de parcial, de final y exámenes. */
const BUILD_RANK: Record<RouteStepKind, number> = { unit: 0, control: 0, "sim-parcial": 1, "sim-final": 2, exam: 3 };

/** Primer hueco libre para `due` probando +1, −1, +2, −2… hasta ±7, dentro de [`lower`, `upper`] y sin festivo ni ocupar. */
function findSlot(due: string, lower: string, upper: string, taken: ReadonlySet<string>): string | undefined {
  const base = parseDayKey(due);
  for (let offset = 1; offset <= SPREAD_MAX_OFFSET; offset++) {
    for (const delta of [offset, -offset]) {
      const candidate = dayKey(addDays(base, delta));
      if (candidate < lower || candidate > upper) continue;
      if (isHoliday(candidate) || taken.has(candidate)) continue;
      return candidate;
    }
  }
  return undefined;
}

/** Todos los pasos no hechos de todas las asignaturas de `routes`, por fecha objetivo (a igualdad, orden de `routes`). */
export function nextObjectives(routes: readonly SubjectRoute[], limit: number): RouteStep[] {
  const pending: { step: RouteStep; routeIdx: number }[] = [];
  routes.forEach((r, routeIdx) => {
    for (const step of r.steps) if (step.status !== "done" && step.status !== "skipped") pending.push({ step, routeIdx });
  });
  pending.sort((a, b) => a.step.due.localeCompare(b.step.due) || a.routeIdx - b.routeIdx);
  return pending.slice(0, limit).map((p) => p.step);
}

/** Pasos no hechos de los próximos 7 días (incluidos los atrasados), en el mismo orden que `nextObjectives`. */
export function thisWeek(routes: readonly SubjectRoute[]): RouteStep[] {
  return nextObjectives(routes, Number.POSITIVE_INFINITY).filter((s) => s.daysLeft <= 7);
}
