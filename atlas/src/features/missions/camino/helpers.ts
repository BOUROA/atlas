// Ayudas puras del Camino (Misiones › Camino, spec 2026-09-25-mision-del-dia-camino
// §4): enlaces de los nodos, etiquetas cortas, cifras de la ficha de asignatura,
// la lista "Hasta el máximo" y el trazado del sendero (posiciones y curva).
// Sin React: solo transforma los datos de src/domain/camino.ts.
import type { PathNode, SubjectPath, SubjectPathLevel } from "../../../domain/camino";
import { TRIAL_PASS } from "../../../domain/trials";
import type { ConceptProgress } from "../../../domain/tutor/mastery";
import type { Subject } from "../../../domain/types";
import { catalog, expeditionById, trialById } from "../../../state/catalog";
import { href } from "../../../state/router";
import { hashString, minutes, minutesShort, pct, plural, seededRandom } from "../../../ui";
import { unitReviewHref } from "../rumbo/helpers";

/** Asignatura por defecto del Camino: la de mayor nivel (a igualdad, la primera del carril). */
export function defaultCaminoSubject(subjects: readonly Subject[], levels: Record<string, SubjectPathLevel>): string | undefined {
  let best: Subject | undefined;
  let bestLevel = -1;
  for (const s of subjects) {
    const level = levels[s.id]?.level ?? 0;
    if (level > bestLevel) {
      best = s;
      bestLevel = level;
    }
  }
  return best?.id;
}

/** Quita el prefijo "Control · " / "Tema N · " del título (como `stepHeading` del Rumbo). */
function stripPrefix(title: string): string {
  const i = title.indexOf(" · ");
  return i >= 0 ? title.slice(i + 3) : title;
}

/** Primera letra en mayúscula. */
const upperFirst = (s: string): string => (s ? s[0].toLocaleUpperCase("es-ES") + s.slice(1) : s);

/** Recorta un título largo para el sendero (el completo va siempre en el aria-label del nodo). */
const ELLIPSIS_AT = 34;
const truncate = (s: string): string => (s.length > ELLIPSIS_AT ? `${s.slice(0, ELLIPSIS_AT - 1).trimEnd()}…` : s);

/** Etiqueta corta de un nodo: "Bases" (control), "Aplicaciones de la derivada" (tema), "Parcial A" (simulacro), su título recortado (élite). */
export function nodeShortLabel(node: PathNode): string {
  if (node.kind === "sim-parcial" || node.kind === "sim-final") return upperFirst(stripPrefix(node.title).replace(/^simulacro de /i, ""));
  if (node.kind === "elite") return truncate(node.title);
  return truncate(stripPrefix(node.title));
}

/** Número de tema de un nodo de tema o control (para su rótulo compacto "T3"), o undefined (simulacro, élite). */
export function nodeUnitNumber(node: PathNode): number | undefined {
  if (node.kind === "unit") return catalog.unitById.get(node.id)?.number;
  if (node.kind === "control") {
    const unitId = node.trialId ? trialById.get(node.trialId)?.unitIds[0] : undefined;
    return unitId != null ? catalog.unitById.get(unitId)?.number : undefined;
  }
  return undefined;
}

/** Enlace del nodo: su prueba, la sesión de repaso del tema (sin prueba) o su misión de élite. */
export function nodeHref(node: PathNode, progress: ReadonlyMap<string, ConceptProgress>): string {
  if (node.kind === "elite") return href(node.expeditionId ? `/mision/${node.expeditionId}` : "/misiones?tab=elite");
  if (node.trialId) return href(`/prueba/${node.trialId}`);
  return href(unitReviewHref([node.id], catalog, progress));
}

/** Etiqueta del CTA dorado para empezar el nodo "estás aquí". */
export function nodeCta(node: PathNode): string {
  if (node.kind === "control") return "Empezar control";
  if (node.kind === "sim-parcial" || node.kind === "sim-final") return "Empezar simulacro";
  if (node.kind === "elite") return "Empezar misión";
  return "Empezar sesión";
}

/** Estado del nodo en prosa, para el aria-label del enlace. */
export function nodeStateLabel(node: PathNode, isHere: boolean): string {
  if (node.done) return node.stars > 0 ? `hecho, ${plural(node.stars, "estrella", "estrellas")} de 3` : "hecho";
  if (isHere) return "estás aquí";
  return "pendiente";
}

/* ───────── Ficha de asignatura ───────── */

export type CaminoStats = {
  starsEarned: number;
  starsMax: number;
  stepsDone: number;
  stepsTotal: number;
  controlsDone: number;
  controlsTotal: number;
  hasTrials: boolean;
};

/** Cifras de la ficha (estrellas de nota, pasos hechos, controles superados). */
export function caminoStats(path: SubjectPath): CaminoStats {
  let starsEarned = 0;
  let starsMax = 0;
  let controlsDone = 0;
  let controlsTotal = 0;
  for (const n of path.nodes) {
    if (n.trialId) {
      starsMax += 3;
      starsEarned += n.stars;
    }
    if (n.kind === "control") {
      controlsTotal++;
      if (n.done) controlsDone++;
    }
  }
  return {
    starsEarned,
    starsMax,
    stepsDone: path.nodes.filter((n) => n.done).length,
    stepsTotal: path.nodes.length,
    controlsDone,
    controlsTotal,
    hasTrials: starsMax > 0,
  };
}

/* ───────── "Hasta el máximo" ───────── */

export type ClimbRow = {
  key: string;
  kind: "simulacro" | "elite";
  label: string;
  tag?: string;
  meta: string;
  isMax: boolean;
};

/** Hitos que faltan hasta el máximo: los simulacros pendientes y, si hay campaña, la élite como una sola fila. */
export function climbToMax(path: SubjectPath): ClimbRow[] {
  const rows: ClimbRow[] = [];
  const remaining = path.nodes.filter((n) => !n.done);
  for (const n of remaining) {
    if (n.kind !== "sim-parcial" && n.kind !== "sim-final") continue;
    const trial = n.trialId ? trialById.get(n.trialId) : undefined;
    const isMax = n.level === 6;
    rows.push({
      key: n.id,
      kind: "simulacro",
      label: nodeShortLabel(n),
      tag: isMax ? `Máximo · ≥ ${TRIAL_PASS}` : n.level === 4 ? "exigente" : undefined,
      meta: trial ? `${minutesShort(trial.durationMin)} · ${pct(n.readiness)}` : pct(n.readiness),
      isMax,
    });
  }
  const eliteRemaining = remaining.filter((n) => n.kind === "elite");
  if (eliteRemaining.length > 0) {
    rows.push({
      key: "elite",
      kind: "elite",
      label: "Élite",
      tag: plural(eliteRemaining.length, "peldaño", "peldaños"),
      meta: "Cumbre",
      isMax: false,
    });
  }
  return rows;
}

/** Minutos estimados hasta el máximo: la duración de los simulacros pendientes (+15′ de corrección cada uno). */
export function climbMinutesLabel(path: SubjectPath): string | undefined {
  const mins = path.nodes
    .filter((n) => !n.done && n.trialId && (n.kind === "sim-parcial" || n.kind === "sim-final"))
    .reduce((sum, n) => sum + (trialById.get(n.trialId!)?.durationMin ?? 0) + 15, 0);
  return mins > 0 ? `≈ ${minutes(mins)}` : undefined;
}

/** Nombre de la universidad (siglas) de una misión de élite, para el rótulo del nodo. */
export function expeditionUniversity(expeditionId: string | undefined): string | undefined {
  return expeditionId ? expeditionById.get(expeditionId)?.university : undefined;
}

/* ───────── Trazado del sendero (posiciones, curva y escala de niveles) ───────── */

export type TrailPoint = { node: PathNode; x: number; y: number; r: number };
export type Trail = { points: TrailPoint[]; width: number; height: number };

const VB_WIDTH = 640;
const MARGIN_X = 96;
// TOP_PAD holgado: dentro del hueco queda el aviso de la esquina (info + leyenda de
// estrellas), que es un overlay HTML en px de pantalla, no en unidades del viewBox.
const TOP_PAD = 118;
const BOTTOM_PAD = 46;

/** Separación vertical hasta el siguiente nodo, según su importancia. */
function gapAfter(node: PathNode): number {
  if (node.summit) return 108;
  if (node.kind === "sim-parcial" || node.kind === "sim-final") return 92;
  if (node.kind === "elite") return 66;
  return 62;
}

/** Radio del glifo del nodo. */
function radiusOf(node: PathNode): number {
  if (node.summit) return 23;
  if (node.kind === "sim-parcial" || node.kind === "sim-final") return node.level === 4 || node.level === 6 ? 19 : 17;
  if (node.kind === "elite") return 8;
  return 8.5;
}

/**
 * Posiciones de los nodos, de abajo arriba (el primero de `nodes` queda más abajo, el
 * último más arriba), meciéndose a los lados con una semilla estable por asignatura
 * (misma forma cada vez que se abre, distinta entre asignaturas).
 */
export function layoutTrail(nodes: readonly PathNode[], seedKey: string): Trail {
  const width = VB_WIDTH;
  const half = (width - MARGIN_X * 2) / 2;
  const centerX = width / 2 + half * 0.08;
  const rand = seededRandom(hashString(seedKey) || 1);
  let y = 0;
  let angle = 0.4;
  const raw: { node: PathNode; x: number; y: number; r: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (i > 0) y += gapAfter(node);
    angle += 0.62 + rand() * 0.48;
    const amp = half * (0.5 + 0.42 * Math.sin(i * 0.47 + 0.6));
    const x = centerX + Math.sin(angle) * amp;
    raw.push({ node, x, y, r: radiusOf(node) });
  }
  const maxY = raw.length > 0 ? raw[raw.length - 1].y : 0;
  const height = maxY + TOP_PAD + BOTTOM_PAD;
  const points = raw.map((p) => ({ ...p, y: maxY - p.y + TOP_PAD, x: clampX(p.x, p.r) }));
  return { points, width, height };
}

function clampX(x: number, r: number): number {
  return Math.min(VB_WIDTH - MARGIN_X * 0.4 - r, Math.max(MARGIN_X * 0.4 + r, x));
}

/** Curva suave (Catmull-Rom → Bézier) que une los puntos, de abajo arriba. */
export function splinePath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Estrellas de fondo del cielo, deterministas por asignatura. */
export function backgroundStars(seedKey: string, count: number, width: number, height: number): { x: number; y: number; r: number; o: number }[] {
  const rand = seededRandom((hashString(seedKey) || 1) * 2654435761);
  return Array.from({ length: count }, () => ({
    x: Math.round(rand() * width),
    y: Math.round(rand() * height),
    r: Math.round((0.5 + rand() * 0.9) * 10) / 10,
    o: Math.round((0.12 + rand() * 0.35) * 100) / 100,
  }));
}

/** Escala de niveles del margen izquierdo (0–7), repartida uniformemente a lo largo del sendero. */
export function levelRuler(height: number): { level: number; y: number }[] {
  const top = TOP_PAD * 0.65;
  const bottom = height - BOTTOM_PAD * 0.5;
  return Array.from({ length: 8 }, (_, level) => ({ level, y: bottom - ((bottom - top) * level) / 7 }));
}
