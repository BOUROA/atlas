// Trazado del mapa de conceptos en carriles (uno por asignatura) y columnas
// (una por capa de requisitos). Puro y determinista: sin React ni DOM.
import type { CatalogIndex } from "./catalog";
import { layers as computeLayers } from "./graph";
import type { CatalogConcept } from "./types";

export type MapNode = {
  id: string; subjectId: string; unitId: string;
  layer: number; row: number; x: number; y: number;
};
export type MapLane = { subjectId: string; y: number; height: number };
export type MapEdgeType = "requires" | "related";
export type MapEdge = { from: string; to: string; type: MapEdgeType };
export type MapLayout = { nodes: MapNode[]; lanes: MapLane[]; edges: MapEdge[]; width: number; height: number };

export type MapLayoutOptions = { colWidth: number; rowHeight: number; lanePadding: number; laneGap: number; left: number };

const DEFAULT_OPTIONS: MapLayoutOptions = { colWidth: 190, rowHeight: 64, lanePadding: 40, laneGap: 24, left: 220 };

type Item = { concept: CatalogConcept; layer: number; initialRow: number; row: number };

/**
 * Traza el mapa: un carril por asignatura (en `order`), columnas por capa de
 * requisitos (`graph.layers`). Dentro de cada carril y capa, orden inicial por
 * (número de tema, `order`) y dos pasadas de baricentro sobre la fila de los
 * requisitos del mismo carril en capas anteriores (desempate estable por el
 * orden inicial).
 */
export function layoutMap(index: CatalogIndex, opts: Partial<MapLayoutOptions> = {}): MapLayout {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const layerOf = computeLayers(index);

  const lanes: MapLane[] = [];
  const nodes: MapNode[] = [];
  let y = 0;

  for (const subject of index.subjects) {
    const concepts = index.conceptsOfSubject(subject.id);

    // Agrupa por capa, preservando el orden de temario (número de tema, order)
    // como orden inicial dentro de cada capa.
    const byLayer = new Map<number, Item[]>();
    for (const concept of concepts) {
      const layer = layerOf.get(concept.id) ?? 0;
      const item: Item = { concept, layer, initialRow: 0, row: 0 };
      const list = byLayer.get(layer);
      if (list) list.push(item);
      else byLayer.set(layer, [item]);
    }
    for (const list of byLayer.values()) list.forEach((item, i) => { item.initialRow = i; item.row = i; });

    const itemById = new Map<string, Item>();
    for (const list of byLayer.values()) for (const item of list) itemById.set(item.concept.id, item);

    const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);

    for (let pass = 0; pass < 2; pass++) {
      for (const layer of sortedLayers) {
        const list = byLayer.get(layer)!;
        const withBary = list.map((item) => {
          const reqRows = (index.requiresOf.get(item.concept.id) ?? [])
            .map((reqId) => itemById.get(reqId))
            .filter((r): r is Item => r !== undefined)
            .map((r) => r.row);
          const bary = reqRows.length > 0 ? reqRows.reduce((a, b) => a + b, 0) / reqRows.length : item.row;
          return { item, bary };
        });
        withBary.sort((a, b) => a.bary - b.bary || a.item.initialRow - b.item.initialRow);
        withBary.forEach(({ item }, i) => { item.row = i; });
        byLayer.set(layer, withBary.map((w) => w.item));
      }
    }

    let maxRows = 1;
    for (const list of byLayer.values()) maxRows = Math.max(maxRows, list.length);
    const height = 2 * o.lanePadding + (maxRows - 1) * o.rowHeight;
    lanes.push({ subjectId: subject.id, y, height });

    for (const layer of sortedLayers) {
      for (const item of byLayer.get(layer)!) {
        nodes.push({
          id: item.concept.id,
          subjectId: subject.id,
          unitId: item.concept.unitId,
          layer: item.layer,
          row: item.row,
          x: o.left + item.layer * o.colWidth,
          y: y + o.lanePadding + item.row * o.rowHeight,
        });
      }
    }

    y += height + o.laneGap;
  }

  const edges: MapEdge[] = index.catalog.relations.map((r) =>
    r.type === "requires"
      ? { from: r.target, to: r.source, type: "requires" as const }
      : { from: r.source, to: r.target, type: "related" as const },
  );

  const maxLayer = nodes.reduce((max, n) => Math.max(max, n.layer), 0);
  const width = o.left + (maxLayer + 1) * o.colWidth + 120;
  const totalHeight = lanes.length > 0 ? lanes[lanes.length - 1].y + lanes[lanes.length - 1].height : 0;

  return { nodes, lanes, edges, width, height: totalHeight };
}
