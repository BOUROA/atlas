// Modelo estático de la carta celeste: se calcula una vez a partir del catálogo
// (trazado determinista de domain/map-layout) y lo comparten el mapa y MiniSky.
// Todo en coordenadas de mundo (las del trazado); nada depende del usuario.
import { catalog } from "../../state/catalog";
import { layoutMap, type MapLayout } from "../../domain/map-layout";
import { conceptImpact } from "../../domain/tutor/impact";
import { subjectAbbr } from "../../ui";

export type WNode = {
  id: string;
  name: string;
  subjectId: string;
  unitId: string;
  unitNumber: number;
  layer: number;
  x: number;
  y: number;
  /** Nombre partido en una o dos líneas para la etiqueta. */
  lines: string[];
  /** Ancho estimado de la etiqueta en px (13 px de cuerpo). */
  lw: number;
  /** Dependientes transitivos ("desbloquea"). */
  deps: number;
  /** Asignaturas ajenas donde se necesita. */
  needed: string[];
  /** Puntuación de impacto del tutor (0,5·log2(1+deps) + 0,5·asignaturas). */
  impact: number;
};

export type WLane = {
  subjectId: string;
  y: number;
  h: number;
  name: string;
  short: string;
  abbr: string;
  nodeIds: string[];
};

export type WUnit = {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  x: number;
  y: number;
  nodeIds: string[];
};

export type WEdge = { from: string; to: string };

export type SkyModel = {
  layout: MapLayout;
  nodes: WNode[];
  byId: ReadonlyMap<string, WNode>;
  lanes: WLane[];
  laneBy: ReadonlyMap<string, WLane>;
  units: WUnit[];
  unitBy: ReadonlyMap<string, WUnit>;
  /** Aristas `requires` orientadas requisito → dependiente (x creciente). */
  requires: WEdge[];
  /** Líneas de constelación entre temas de una misma asignatura (árbol). */
  unitLinks: { a: string; b: string; subjectId: string }[];
  /** Arcos tenues entre temas de asignaturas distintas (requisitos agregados). */
  unitArcs: { a: string; b: string; w: number }[];
  maxDeps: number;
  width: number;
  height: number;
  colWidth: number;
  rowHeight: number;
  /** Primera x del trazado (margen izquierdo del mundo). */
  left: number;
  maxLayer: number;
};

const COL_WIDTH = 190;
const ROW_HEIGHT = 64;
const LEFT = 220;
/** Caracteres por línea de etiqueta (≈ 165 px a 13 px). */
const LINE_CHARS = 24;
/** Ancho medio de carácter a 13 px en Hanken Grotesk. */
export const CHAR_W = 6.6;

/** Parte un nombre en 1–2 líneas equilibradas; recorta con "…" si no cabe. */
export function splitLabel(name: string, max = LINE_CHARS): string[] {
  if (name.length <= max) return [name];
  const words = name.split(" ");
  let best: string[] | null = null;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const over = Math.max(0, a.length - max) * 10 + Math.max(0, b.length - max) * 3;
    const score = over + Math.abs(a.length - b.length);
    if (score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  if (!best) return [name.slice(0, max - 1) + "…"];
  let [a, b] = best;
  if (a.length > max + 2) a = a.slice(0, max) + "…";
  if (b.length > max + 2) {
    const cut = b.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    b = (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,:;·-]+$/, "") + "…";
  }
  return [a, b];
}

export const labelWidth = (lines: string[], charW = CHAR_W) => Math.max(...lines.map((l) => l.length)) * charW + 4;

let cached: SkyModel | null = null;

/** Modelo del cielo (memo de módulo: el catálogo es inmutable). */
export function skyModel(): SkyModel {
  if (cached) return cached;
  const layout = layoutMap(catalog, { colWidth: COL_WIDTH, rowHeight: ROW_HEIGHT, left: LEFT });
  const nodes: WNode[] = layout.nodes.map((n) => {
    const c = catalog.conceptById.get(n.id)!;
    const imp = conceptImpact(catalog, n.id);
    const lines = splitLabel(c.name);
    return {
      id: n.id,
      name: c.name,
      subjectId: n.subjectId,
      unitId: n.unitId,
      unitNumber: catalog.unitById.get(n.unitId)?.number ?? 0,
      layer: n.layer,
      x: n.x,
      y: n.y,
      lines,
      lw: labelWidth(lines),
      deps: imp.dependents,
      needed: imp.neededIn,
      impact: imp.score,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const lanes: WLane[] = layout.lanes.map((l) => {
    const s = catalog.subjectById.get(l.subjectId)!;
    return {
      subjectId: l.subjectId,
      y: l.y,
      h: l.height,
      name: s.name,
      short: s.shortName,
      abbr: subjectAbbr(l.subjectId),
      nodeIds: nodes.filter((n) => n.subjectId === l.subjectId).map((n) => n.id),
    };
  });
  const laneBy = new Map(lanes.map((l) => [l.subjectId, l]));

  // Temas: estrella mayor en el centroide de sus conceptos.
  const units: WUnit[] = [];
  for (const s of catalog.subjects) {
    for (const u of catalog.unitsBySubject.get(s.id) ?? []) {
      const ids = (catalog.conceptsByUnit.get(u.id) ?? []).map((c) => c.id).filter((id) => byId.has(id));
      if (ids.length === 0) continue;
      let sx = 0;
      let sy = 0;
      for (const id of ids) {
        const n = byId.get(id)!;
        sx += n.x;
        sy += n.y;
      }
      units.push({ id: u.id, subjectId: s.id, number: u.number, title: u.title, x: sx / ids.length, y: sy / ids.length, nodeIds: ids });
    }
  }
  const unitBy = new Map(units.map((u) => [u.id, u]));

  const requires: WEdge[] = [];
  for (const e of layout.edges) if (e.type === "requires" && byId.has(e.from) && byId.has(e.to)) requires.push({ from: e.from, to: e.to });

  // Pesos entre temas (requisitos agregados).
  const pairW = new Map<string, number>();
  for (const e of requires) {
    const a = byId.get(e.from)!.unitId;
    const b = byId.get(e.to)!.unitId;
    if (a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    pairW.set(key, (pairW.get(key) ?? 0) + 1);
  }

  // Líneas de constelación: árbol de expansión máximo por asignatura (Kruskal),
  // completado por cercanía para que cada asignatura sea una sola figura.
  const unitLinks: SkyModel["unitLinks"] = [];
  const dist = (a: WUnit, b: WUnit) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6);
  for (const s of catalog.subjects) {
    const us = units.filter((u) => u.subjectId === s.id);
    const parent = new Map(us.map((u) => [u.id, u.id]));
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      parent.set(x, r);
      return r;
    };
    const cands: { a: WUnit; b: WUnit; w: number; d: number }[] = [];
    // (todos los pares: ≤ 11 temas por asignatura)
    for (let i = 0; i < us.length; i++) {
      for (let j = i + 1; j < us.length; j++) {
        const a = us[i];
        const b = us[j];
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        cands.push({ a, b, w: pairW.get(key) ?? 0, d: dist(a, b) });
      }
    }
    // Árbol mínimo con coste = distancia / √(1 + requisitos): cercanía y afinidad.
    const cost = (c: { w: number; d: number }) => c.d / Math.sqrt(1 + c.w);
    cands.sort((p, q) => cost(p) - cost(q) || (p.a.id + p.b.id).localeCompare(q.a.id + q.b.id));
    for (const c of cands) {
      const ra = find(c.a.id);
      const rb = find(c.b.id);
      if (ra === rb) continue;
      parent.set(ra, rb);
      unitLinks.push({ a: c.a.id, b: c.b.id, subjectId: s.id });
    }
  }

  // Arcos entre asignaturas: pares de temas con ≥ 2 requisitos, los 70 más fuertes.
  const unitArcs: SkyModel["unitArcs"] = [];
  for (const [key, w] of pairW) {
    const [a, b] = key.split("|");
    const ua = unitBy.get(a);
    const ub = unitBy.get(b);
    if (!ua || !ub || ua.subjectId === ub.subjectId || w < 2) continue;
    // orienta de izquierda a derecha
    unitArcs.push(ua.x <= ub.x ? { a, b, w } : { a: b, b: a, w });
  }
  unitArcs.sort((p, q) => q.w - p.w);
  unitArcs.length = Math.min(unitArcs.length, 70);

  const maxDeps = nodes.reduce((m, n) => Math.max(m, n.deps), 1);
  const maxLayer = nodes.reduce((m, n) => Math.max(m, n.layer), 0);
  cached = {
    layout,
    nodes,
    byId,
    lanes,
    laneBy,
    units,
    unitBy,
    requires,
    unitLinks,
    unitArcs,
    maxDeps,
    width: layout.width,
    height: layout.height,
    colWidth: COL_WIDTH,
    rowHeight: ROW_HEIGHT,
    left: LEFT,
    maxLayer,
  };
  return cached;
}

/** Curva de requisito: horizontal en los extremos, de izquierda a derecha. */
export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, (x2 - x1) * 0.5);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + dx).toFixed(1)} ${y1.toFixed(1)} ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Arco suave entre dos puntos (combado hacia un lado). */
export function arcPath(x1: number, y1: number, x2: number, y2: number, bow = 0.18): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * bow;
  const cy = my + dx * bow;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Punto de longitud cero: con stroke-linecap redondo y trazo que no escala, un punto de tamaño fijo en pantalla. */
export const dotPath = (x: number, y: number) => `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
