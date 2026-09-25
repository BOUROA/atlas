// Estado visual de cada estrella a partir del progreso del usuario y del plan de
// hoy. Puro (sin React): lo usan la carta celeste y MiniSky.
import type { ConceptProgress } from "../../domain/tutor/mastery";
import { progressOf } from "../../domain/tutor/mastery";
import type { QueueItem } from "../../domain/tutor/queue";
import { subjectStateOf, type Level, type UserState } from "../../domain/types";
import { catalog } from "../../state/catalog";
import type { StarState } from "../../ui";
import type { SkyModel } from "./model";

export type NodeVis = {
  state: StarState;
  level: Level;
  /** Frescura 0–1 (null si aún no tiene tarjeta). */
  r: number | null;
  lit: boolean;
  cooling: boolean;
};

export type Transition = { from: Level; to: Level | null };

export type SkyState = {
  vis: ReadonlyMap<string, NodeVis>;
  lit: number;
  cooling: number;
  seen: number;
  /** Conceptos del plan de hoy, en orden. */
  today: QueueItem[];
  todaySet: ReadonlySet<string>;
  lanes: ReadonlyMap<string, { lit: number; total: number; cooling: number; today: number }>;
  units: ReadonlyMap<string, { lit: number; seen: number; total: number }>;
};

/** Nivel 2 = "encendida" (vocabulario del sistema visual). */
export const LIT_LEVEL = 2;

/**
 * Estados de estrella:
 * hoy (en el plan) · se enfría (nivel ≥ 2 con frescura < retención) · domino ·
 * entiendo · visto · siguiente (primer nuevo propuesto de cada asignatura tras el
 * plan) · bloqueada (sin ver, tema en curso o el siguiente, con requisitos sin ver)
 * · sin ver.
 */
export function computeSkyState(
  model: SkyModel,
  progress: ReadonlyMap<string, ConceptProgress>,
  queue: { planned: QueueItem[]; items: QueueItem[] },
  user: UserState,
): SkyState {
  const retention = user.settings.desiredRetention;
  const todaySet = new Set(queue.planned.map((i) => i.conceptId));
  const plannedSet = new Set(queue.planned);
  const nextSet = new Set<string>();
  const nextBySubject = new Set<string>();
  for (const it of queue.items) {
    if (it.type !== "new" || plannedSet.has(it) || todaySet.has(it.conceptId)) continue;
    const s = model.byId.get(it.conceptId)?.subjectId;
    if (!s || nextBySubject.has(s)) continue;
    nextBySubject.add(s);
    nextSet.add(it.conceptId);
  }
  const currentUnit = new Map(model.lanes.map((l) => [l.subjectId, subjectStateOf(user, l.subjectId).currentUnit]));

  const vis = new Map<string, NodeVis>();
  const lanes = new Map<string, { lit: number; total: number; cooling: number; today: number }>();
  const units = new Map<string, { lit: number; seen: number; total: number }>();
  let lit = 0;
  let cooling = 0;
  let seen = 0;
  for (const n of model.nodes) {
    const p = progressOf(progress, n.id);
    const r = p.retrievability;
    const isLit = p.level >= LIT_LEVEL;
    const isCool = isLit && r != null && r < retention;
    let state: StarState;
    if (todaySet.has(n.id)) state = "today";
    else if (isCool) state = "cooling";
    else if (p.level === 3) state = "mastered";
    else if (p.level === 2) state = "understood";
    else if (p.level === 1) state = "seen";
    else if (nextSet.has(n.id)) state = "next";
    else if (
      n.unitNumber <= (currentUnit.get(n.subjectId) ?? 1) + 1 &&
      (catalog.requiresOf.get(n.id) ?? []).some((req) => progressOf(progress, req).level === 0)
    )
      state = "locked";
    else state = "unseen";
    vis.set(n.id, { state, level: p.level, r, lit: isLit, cooling: isCool });
    if (isLit) lit++;
    if (isCool) cooling++;
    if (p.level >= 1) seen++;
    const lane = lanes.get(n.subjectId) ?? { lit: 0, total: 0, cooling: 0, today: 0 };
    lane.total++;
    if (isLit) lane.lit++;
    if (isCool) lane.cooling++;
    if (todaySet.has(n.id)) lane.today++;
    lanes.set(n.subjectId, lane);
    const u = units.get(n.unitId) ?? { lit: 0, seen: 0, total: 0 };
    u.total++;
    if (isLit) u.lit++;
    if (p.level >= 1) u.seen++;
    units.set(n.unitId, u);
  }
  return { vis, lit, cooling, seen, today: queue.planned, todaySet, lanes, units };
}

/** Transición de nivel prevista si la tarjeta de hoy sale bien. */
export function transitionOf(item: QueueItem, p: ConceptProgress): Transition {
  if (item.type === "new") return { from: 0, to: 1 };
  if (item.type === "first") return { from: p.level, to: p.level < 2 ? 2 : null };
  if (p.level === 2 && p.practicePassed) return { from: 2, to: 3 };
  if (p.level < 2) return { from: p.level, to: 2 };
  return { from: p.level, to: null };
}
