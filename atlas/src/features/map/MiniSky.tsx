// MiniSky: fragmento no interactivo de la carta celeste para Hoy y el resumen de sesión.
// Props (contrato estable):
//   subjectIds?: asignaturas a mostrar (por defecto, las de los conceptos resaltados)
//   highlight?: ids de concepto que se encienden (p. ej. los de la sesión de hoy)
//   height?: alto en px (por defecto 260)
//   caption?: texto accesible que describe el fragmento
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./map.css";
import { catalog } from "../../state/catalog";
import { useDerived, useQueue } from "../../state/derived";
import { useUserState } from "../../state/store";
import { cx, StarDefs, StarMark, useSvgId } from "../../ui";
import { edgePath, labelWidth, skyModel, splitLabel, type WNode } from "./model";
import { computeSkyState, type NodeVis } from "./states";
import { placeLabels, type LabelCand } from "./labels";

export type MiniSkyProps = {
  subjectIds?: string[];
  highlight?: string[];
  height?: number;
  caption?: string;
};

type MiniNode = { n: WNode; x: number; y: number; hl: boolean; lines: string[]; lw: number };

/** Estrellas por franja como mucho (resaltadas + contexto) y resaltadas como mucho. */
const MAX_PER_LANE = 9;
const MAX_HL = 7;
/** Separación mínima entre columnas (px). */
const MIN_COL = 58;
/**
 * Radio a despejar alrededor de cada estrella para las etiquetas: el halo
 * real (`StarMark`, "halo de 17 px" a escala 1) a la escala 0,86 de MiniSky,
 * no solo su núcleo — con un radio más corto la etiqueta se consideraba "sin
 * choque" pero el halo (sobre todo el de una estrella resaltada) se pintaba
 * por debajo del texto: el solape que se veía a tamaño pequeño.
 */
const STAR_CLEAR = 15;
/** Separación entre el borde despejado y el texto. */
const LABEL_GAP = STAR_CLEAR + 2;

export function MiniSky({ subjectIds, highlight, height = 260, caption = "Fragmento de la carta celeste" }: MiniSkyProps) {
  const model = useMemo(skyModel, []);
  const derived = useDerived();
  const user = useUserState((s) => s);
  const queue = useQueue();
  const sky = useMemo(() => computeSkyState(model, derived.progress, queue, user), [model, derived.progress, queue, user]);
  const defsId = useSvgId("mini");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hlKey = (highlight ?? []).join("|");
  const subjKey = (subjectIds ?? []).join("|");

  const layout = useMemo(() => {
    const hl = (highlight ?? []).filter((id) => model.byId.has(id));
    const hlSet = new Set(hl);
    const maxLanes = Math.max(1, Math.min(5, Math.floor(height / 58)));

    // Asignaturas: las pedidas, o las de lo resaltado (más resaltados primero), o las más encendidas.
    let subjects: string[];
    if (subjectIds && subjectIds.length) subjects = subjectIds.filter((s) => model.laneBy.has(s));
    else if (hl.length) {
      const count = new Map<string, number>();
      for (const id of hl) {
        const s = model.byId.get(id)!.subjectId;
        count.set(s, (count.get(s) ?? 0) + 1);
      }
      subjects = [...count].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    } else {
      subjects = model.lanes
        .map((l) => [l.subjectId, sky.lanes.get(l.subjectId)?.lit ?? 0] as const)
        .sort((a, b) => b[1] - a[1])
        .map(([s]) => s);
    }
    subjects = subjects.slice(0, maxLanes);
    const order = new Map(model.lanes.map((l, i) => [l.subjectId, i]));
    subjects.sort((a, b) => order.get(a)! - order.get(b)!);

    // Conceptos de cada franja: resaltados (los de más impacto primero, hasta MAX_HL),
    // completados con sus requisitos y dependientes directos de la misma franja; si la
    // franja no tiene resaltados, su frontera (lo último encendido y lo siguiente).
    const nameW = width >= 520 ? 150 : 58;
    const x0 = nameW + 22;
    const x1 = width - 26;
    // Columnas: las justas para que dos estrellas vecinas no se pisen.
    const maxCols = Math.max(3, Math.floor((x1 - x0) / MIN_COL) + 1);
    const perLane = Math.min(MAX_PER_LANE, maxCols + 2);
    const byImpact = (a: string, b: string) => model.byId.get(b)!.impact - model.byId.get(a)!.impact;
    const picked = new Map<string, string[]>();
    for (const s of subjects) {
      const own = hl.filter((id) => model.byId.get(id)!.subjectId === s).sort(byImpact).slice(0, Math.min(MAX_HL, perLane));
      const list: string[] = [...own];
      const add = (id: string) => {
        if (list.length >= perLane || list.includes(id)) return;
        if (model.byId.get(id)?.subjectId !== s) return;
        list.push(id);
      };
      if (own.length) {
        for (const id of own) for (const r of catalog.requiresOf.get(id) ?? []) add(r);
        for (const id of own) for (const r of catalog.requiredBy.get(id) ?? []) add(r);
      } else {
        const lane = model.laneBy.get(s)!;
        const lit = lane.nodeIds.filter((id) => sky.vis.get(id)!.level >= 1);
        for (const id of lit.slice(-4)) add(id);
        for (const id of lane.nodeIds) {
          const st = sky.vis.get(id)!.state;
          if (st === "today" || st === "next") add(id);
        }
        for (const id of lane.nodeIds) add(id);
      }
      picked.set(s, list);
    }

    // Columnas comprimidas: solo las capas presentes, equiespaciadas; si son
    // demasiadas, las vecinas se funden en una columna (y sus estrellas se apilan).
    const all = [...picked.values()].flat();
    const layers = [...new Set(all.map((id) => model.byId.get(id)!.layer))].sort((a, b) => a - b);
    const nCols = Math.min(layers.length, maxCols);
    const colOf = new Map(layers.map((l, i) => [l, layers.length <= maxCols ? i : Math.floor((i * nCols) / layers.length)]));
    const colW = nCols > 1 ? (x1 - x0) / (nCols - 1) : 0;
    const bandH = (height - 8) / Math.max(1, subjects.length);

    const nodes: MiniNode[] = [];
    const lanes = subjects.map((s, i) => ({ s, y: 4 + i * bandH, h: bandH, cy: 4 + i * bandH + bandH * 0.48 }));
    for (const lane of lanes) {
      const ids = picked.get(lane.s) ?? [];
      const sortedIds = [...ids].sort((a, b) => model.byId.get(a)!.y - model.byId.get(b)!.y);
      // Cuántas estrellas comparten cada columna en esta franja: con varias
      // apiladas, el paso vertical se reparte entre todas para que quepan en
      // el alto disponible (si no, con muchas en la misma columna se pisaban
      // unas a otras en vez de solo acercarse).
      const colCounts = new Map<number, number>();
      for (const id of sortedIds) {
        const col = colOf.get(model.byId.get(id)!.layer)!;
        colCounts.set(col, (colCounts.get(col) ?? 0) + 1);
      }
      const stepFor = (col: number) => {
        const rows = Math.ceil((colCounts.get(col) ?? 1) / 2); // pasos del centro al extremo
        const fit = rows > 0 ? (bandH * 0.42) / rows : STAR_CLEAR;
        return Math.max(12, Math.min(22, fit));
      };
      const perCol = new Map<number, number>();
      for (const id of sortedIds) {
        const n = model.byId.get(id)!;
        const col = colOf.get(n.layer)!;
        const k = perCol.get(col) ?? 0;
        perCol.set(col, k + 1);
        const off = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * stepFor(col);
        const lines = splitLabel(n.name, 22);
        nodes.push({
          n,
          x: nCols > 1 ? x0 + col * colW : (x0 + x1) / 2,
          y: lane.cy + off,
          hl: hlSet.has(id),
          lines,
          lw: labelWidth(lines, 6.3),
        });
      }
    }
    const byId = new Map(nodes.map((m) => [m.n.id, m]));

    // Aristas entre los conceptos mostrados.
    const edges: { d: string; cross: boolean; lit: boolean; subjectId: string }[] = [];
    for (const m of nodes) {
      for (const req of catalog.requiresOf.get(m.n.id) ?? []) {
        const a = byId.get(req);
        if (!a) continue;
        const [p, q] = a.x <= m.x ? [a, m] : [m, a];
        edges.push({
          d: edgePath(p.x, p.y, q.x, q.y),
          cross: a.n.subjectId !== m.n.subjectId,
          lit: !!sky.vis.get(a.n.id)?.lit && !!sky.vis.get(m.n.id)?.lit,
          subjectId: m.n.subjectId,
        });
      }
    }

    // Etiquetas sin solapes: primero lo resaltado.
    const cands: LabelCand[] = nodes.map((m) => ({
      id: m.n.id,
      wx: m.x,
      wy: m.y,
      prio: (m.hl ? 1000 : 0) + (sky.vis.get(m.n.id)!.lit ? 100 : 0) + m.n.impact,
      slots: [
        { dx: -m.lw / 2, dy: LABEL_GAP, w: m.lw, h: m.lines.length * 13 + 1, pos: "b" },
        { dx: -m.lw / 2, dy: -LABEL_GAP - m.lines.length * 13, w: m.lw, h: m.lines.length * 13 + 1, pos: "a" },
      ],
    }));
    const obstacles = [
      // las propias estrellas: ninguna etiqueta encima de otra estrella (ni de su halo)
      ...nodes.map((m) => ({ x0: m.x - STAR_CLEAR, y0: m.y - STAR_CLEAR, x1: m.x + STAR_CLEAR, y1: m.y + STAR_CLEAR })),
      { x0: -999, y0: -999, x1: nameW + 4, y1: 9999 },
      { x0: -999, y0: -999, x1: 9999, y1: 1 },
      { x0: -999, y0: height - 1, x1: 9999, y1: 9999 },
    ];
    const placed = placeLabels(cands, { x: 0, y: 0, k: 1, w: width, h: height }, obstacles, 0);

    return { lanes, nodes, edges, placed, nameW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, hlKey, subjKey, height, width, sky]);

  const compactNames = layout.nameW < 100;

  return (
    <div ref={wrapRef} className="map-mini" style={{ height }}>
      <svg className="map-mini-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption}>
        <title>{caption}</title>
        <StarDefs id={defsId} />
        <g className="map-mini-lanes" aria-hidden="true">
          {layout.lanes.map((l, i) => (
            <g key={l.s}>
              {i > 0 && <path className="map-mini-sep" d={`M0 ${l.y.toFixed(1)}H${width}`} />}
              <path className="map-mini-rail" d={`M${layout.nameW + 10} ${l.cy.toFixed(1)}H${width}`} style={{ stroke: `var(--s-${l.s})` }} />
            </g>
          ))}
        </g>
        <g className="map-mini-edges" aria-hidden="true">
          {layout.edges.map((e, i) => (
            <path
              key={i}
              d={e.d}
              className={cx("map-mini-edge", e.cross && "is-cross", e.lit && "is-lit")}
              style={e.cross ? ({ "--c": `var(--s-${e.subjectId})` } as CSSProperties) : undefined}
            />
          ))}
        </g>
        <g className="map-mini-names" aria-hidden="true">
          {layout.lanes.map((l) => {
            const st = sky.lanes.get(l.s);
            const lane = model.laneBy.get(l.s)!;
            const pctLit = st && st.total ? Math.round((st.lit / st.total) * 100) : 0;
            return (
              <g key={l.s} transform={`translate(0 ${l.cy.toFixed(1)})`}>
                <circle cx="5" cy={compactNames ? -4 : -5} r="3.5" style={{ fill: `var(--s-${l.s})` }} />
                <text className="map-mini-name" x="15" y={compactNames ? 0 : 1}>
                  {compactNames ? lane.abbr : lane.short}
                </text>
                {l.h >= 44 && (
                  <text className="map-mini-meta" x="15" y={compactNames ? 14 : 17}>
                    {compactNames ? `${pctLit} %` : `${st?.lit ?? 0} de ${st?.total ?? 0} · ${pctLit} %`}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        <g className="map-mini-stars">
          {layout.nodes.map((m, i) => {
            const v = sky.vis.get(m.n.id) as NodeVis;
            return (
              <g key={m.n.id} className={cx("map-mini-star", m.hl && "is-hl")} style={{ "--i": i } as CSSProperties}>
                {m.hl && v.state !== "today" && <circle className="map-mini-hl" cx={m.x} cy={m.y} r="11" />}
                <StarMark defsId={defsId} state={v.state} x={m.x} y={m.y} scale={0.86} subjectId={m.n.subjectId} tag={false} />
              </g>
            );
          })}
        </g>
        <g className="map-mini-labels" aria-hidden="true">
          {layout.nodes.map((m) => {
            const pl = layout.placed.get(m.n.id);
            if (!pl) return null;
            const pos = pl.pos;
            const lx = m.x + pl.shift;
            const v = sky.vis.get(m.n.id)!;
            const tone = m.hl ? "is-hl" : v.cooling ? "is-cool" : v.lit ? "is-lit" : v.level === 1 ? "is-seen" : "is-off";
            // Línea base del texto: coherente con el hueco (LABEL_GAP) que ya
            // despejó el propio slot frente al halo de la estrella.
            const y0 = pos === "b" ? m.y + LABEL_GAP + 11 : m.y - (LABEL_GAP + 2) - (m.lines.length - 1) * 13;
            return (
              <text key={m.n.id} className={cx("map-mini-lbl", tone)} x={lx} y={y0}>
                {m.lines.map((l, i) => (
                  <tspan key={i} x={lx} dy={i === 0 ? 0 : 13}>
                    {l}
                  </tspan>
                ))}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
