// Camino hasta el máximo (spec 2026-09-25-mision-del-dia-camino §4): los
// niveles de una asignatura (0 · Sin empezar … 7 · Élite) y su camino visual,
// que sigue el orden del Rumbo (temas o controles y simulacros, sin los
// exámenes reales) y sube después por la campaña de élite. Puro: `now` llega
// siempre como parámetro.
import type { CatalogIndex } from "./catalog";
import { campaignOf } from "./campaigns";
import { buildRoutes, firstHalfUnitIds, subjectRoute, type SubjectRoute } from "./route";
import { starsFor, trialResult, unitsReadiness } from "./trials";
import type { Expedition, Trial, UserState } from "./types";
import type { ConceptProgress } from "./tutor/mastery";

export type PathLevel = {
  level: number;
  label: string;
  /** Qué hace falta para alcanzarlo (para «siguiente hito»). */
  hint: string;
};

/** Niveles del camino, del 0 al 7. */
export const PATH_LEVELS: readonly PathLevel[] = [
  { level: 0, label: "Sin empezar", hint: "Empieza a preparar sus temas." },
  { level: 1, label: "Base", hint: "La mitad de los temas con preparación del 70 % o más." },
  { level: 2, label: "Controles", hint: "Los controles de la primera mitad superados (o esos temas preparados, si no tienen control)." },
  { level: 3, label: "Parcial", hint: "El simulacro de parcial A superado." },
  { level: 4, label: "Parcial exigente", hint: "El simulacro de parcial B superado." },
  { level: 5, label: "Final", hint: "El resto de controles y el simulacro de final A superados." },
  { level: 6, label: "Máximo", hint: "El simulacro de final B con un 7 o más." },
  { level: 7, label: "Élite", hint: "La cumbre de su campaña de élite superada." },
];
const TOP_LEVEL = PATH_LEVELS.length - 1;

/** Proporción de temas preparados para el nivel 1 · Base. */
const BASE_SHARE = 0.5;

export type PathInput = {
  index: CatalogIndex;
  state: UserState;
  progress: ReadonlyMap<string, ConceptProgress>;
  trials: readonly Trial[];
  expeditions: readonly Expedition[];
  now: Date;
  /** Rumbos ya calculados (`buildRoutes`), para no repetirlos; si faltan, se calculan. */
  routes?: readonly SubjectRoute[];
};

export type SubjectPathLevel = {
  subjectId: string;
  /** Nivel actual (0–7): los niveles son consecutivos, no se salta ninguno. */
  level: number;
  label: string;
  /** Siguiente nivel si se puede alcanzar (existen sus pruebas o su campaña), o null. */
  nextLevel: number | null;
  /** Etiqueta de `nextLevel`, o null. */
  next: string | null;
  /** Qué hace falta para `nextLevel`, o null. */
  nextHint: string | null;
};

export type PathNodeKind = "unit" | "control" | "sim-parcial" | "sim-final" | "elite";
export type PathNode = {
  kind: PathNodeKind;
  /** Id de la prueba, del tema (paso de tema sin control) o de la misión de élite. */
  id: string;
  title: string;
  done: boolean;
  /** Estrellas de la mejor nota (0 en un paso de tema o sin superar). */
  stars: 0 | 1 | 2 | 3;
  /** La cumbre: el último peldaño de élite (o, sin campaña, el último nodo). */
  summit: boolean;
  /** Nivel del camino al que cuenta este nodo, si cuenta para alguno. */
  level?: number;
  trialId?: string;
  expeditionId?: string;
  /** Mejor nota (0–10), o null. */
  best: number | null;
  /** Preparación (0–1): conceptos a nivel ≥ 2 de sus temas o, en élite, de su territorio. */
  readiness: number;
  /** Fecha objetivo del Rumbo ("YYYY-MM-DD"); no la tienen los peldaños de élite. */
  due?: string;
};
export type SubjectPath = {
  subjectId: string;
  level: SubjectPathLevel;
  nodes: PathNode[];
  /** Índice del primer nodo sin hacer («estás aquí»), o -1 si están todos hechos. */
  current: number;
};

const byLevel = (a: Trial, b: Trial): number => a.level - b.level || a.id.localeCompare(b.id);

/** Lo que el nivel y el camino necesitan de una asignatura: sus temas, pruebas y campaña. */
function ladderOf(input: PathInput, subjectId: string) {
  const { index, state, progress, trials, expeditions } = input;
  const units = index.unitsBySubject.get(subjectId) ?? [];
  const own = trials.filter((t) => t.subjectId === subjectId);
  // Igual que el Rumbo: un control por tema (el último declarado si hubiera varios).
  const controlByUnit = new Map(own.filter((t) => t.kind === "control" && t.unitIds.length === 1).map((t) => [t.unitIds[0], t]));
  const simParciales = own.filter((t) => t.kind === "parcial").sort(byLevel);
  const simFinales = own.filter((t) => t.kind === "final").sort(byLevel);
  const firstHalf = new Set(firstHalfUnitIds(index, state, subjectId));
  const passed = (t: Trial | undefined) => t !== undefined && trialResult(t, state).passed;
  /** Paso de tema del Rumbo hecho: su control superado o, sin control, el tema preparado. */
  const unitDone = (unitId: string) => {
    const control = controlByUnit.get(unitId);
    return control ? passed(control) : unitsReadiness([unitId], index, progress).ready;
  };
  const campaign = campaignOf(subjectId, expeditions, state, progress);
  return { units, controlByUnit, simParciales, simFinales, firstHalf, passed, unitDone, campaign };
}

type Ladder = ReturnType<typeof ladderOf>;

/** Requisito de cada nivel (1–7) cumplido y alcanzable (existen las pruebas o la campaña que pide). */
function requirements(input: PathInput, l: Ladder): { met: boolean[]; reachable: boolean[] } {
  const { index, progress } = input;
  const withConcepts = l.units.filter((u) => (index.conceptsByUnit.get(u.id) ?? []).length > 0);
  const ready = withConcepts.filter((u) => unitsReadiness([u.id], index, progress).ready).length;
  const firstHalf = l.units.filter((u) => l.firstHalf.has(u.id));
  const secondHalf = l.units.filter((u) => !l.firstHalf.has(u.id));
  const [parcialA, parcialB] = l.simParciales;
  const [finalA, finalB] = l.simFinales;
  const met = [
    true,
    withConcepts.length > 0 && ready / withConcepts.length >= BASE_SHARE,
    firstHalf.length > 0 && firstHalf.every((u) => l.unitDone(u.id)),
    l.passed(parcialA),
    l.passed(parcialB),
    secondHalf.every((u) => l.unitDone(u.id)) && l.passed(finalA),
    l.passed(finalB),
    l.campaign.summitPassed,
  ];
  const reachable = [
    true,
    withConcepts.length > 0,
    firstHalf.length > 0,
    parcialA !== undefined,
    parcialB !== undefined,
    finalA !== undefined,
    finalB !== undefined,
    l.campaign.rungs.length > 0,
  ];
  return { met, reachable };
}

function levelFrom(subjectId: string, { met, reachable }: { met: boolean[]; reachable: boolean[] }): SubjectPathLevel {
  let level = 0;
  while (level < TOP_LEVEL && reachable[level + 1] && met[level + 1]) level++;
  const nextLevel = level < TOP_LEVEL && reachable[level + 1] ? level + 1 : null;
  return {
    subjectId,
    level,
    label: PATH_LEVELS[level].label,
    nextLevel,
    next: nextLevel === null ? null : PATH_LEVELS[nextLevel].label,
    nextHint: nextLevel === null ? null : PATH_LEVELS[nextLevel].hint,
  };
}

/**
 * Nivel del camino de una asignatura (spec §4): 1 · Base con ≥ 50 % de sus temas
 * (con conceptos) preparados; 2 · Controles con los pasos de tema de la primera
 * mitad hechos (la del parcial real o los `ceil(n/2)` primeros temas, como el
 * Rumbo: su control superado o, sin control, el tema preparado); 3 y 4 con los
 * simulacros de parcial A y B superados; 5 con el resto de pasos de tema y el
 * simulacro de final A; 6 con el final B ≥ 7; 7 con la cumbre de élite.
 * Consecutivos: un nivel sin sus pruebas no se puede alcanzar y corta la escalera.
 */
export function subjectPathLevel(input: PathInput, subjectId: string): SubjectPathLevel {
  return levelFrom(subjectId, requirements(input, ladderOf(input, subjectId)));
}

/**
 * Camino de una asignatura: los pasos de su Rumbo sin los exámenes reales (temas
 * o controles y simulacros), en el orden del Rumbo, y después los peldaños de su
 * campaña de élite; con el nivel actual y el primer nodo sin hacer.
 */
export function subjectPath(input: PathInput, subjectId: string): SubjectPath {
  const l = ladderOf(input, subjectId);
  const routes = input.routes ?? buildRoutes(input);
  const route = routes.find((r) => r.subjectId === subjectId) ?? subjectRoute(input, subjectId);
  const levelOfTrial = (trialId: string | undefined, list: readonly Trial[], levels: readonly number[]) => {
    const i = list.findIndex((t) => t.id === trialId);
    return i >= 0 && i < levels.length ? levels[i] : undefined;
  };

  const nodes: PathNode[] = [];
  for (const step of route.steps) {
    if (step.kind === "exam") continue;
    let level: number | undefined;
    if (step.kind === "unit" || step.kind === "control") level = l.firstHalf.has(step.unitIds[0]) ? 2 : 5;
    else if (step.kind === "sim-parcial") level = levelOfTrial(step.trialId, l.simParciales, [3, 4]);
    else level = levelOfTrial(step.trialId, l.simFinales, [5, 6]);
    nodes.push({
      kind: step.kind,
      id: step.trialId ?? step.key,
      title: step.title,
      done: step.status === "done",
      stars: step.stars,
      summit: false,
      ...(level !== undefined ? { level } : {}),
      ...(step.trialId ? { trialId: step.trialId } : {}),
      best: step.best,
      readiness: step.readiness,
      due: step.due,
    });
  }
  for (const rung of l.campaign.rungs) {
    nodes.push({
      kind: "elite",
      id: rung.expedition.id,
      title: rung.expedition.title,
      done: rung.passed,
      stars: starsFor(rung.best),
      summit: rung.isSummit,
      ...(rung.isSummit ? { level: 7 } : {}),
      expeditionId: rung.expedition.id,
      best: rung.best,
      readiness: rung.readiness.ratio,
    });
  }
  if (l.campaign.rungs.length === 0 && nodes.length > 0) nodes[nodes.length - 1].summit = true;

  return {
    subjectId,
    level: levelFrom(subjectId, requirements(input, l)),
    nodes,
    current: nodes.findIndex((n) => !n.done),
  };
}
