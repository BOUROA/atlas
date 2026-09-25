// Capas SVG de la carta celeste. Cada capa es memo y solo depende de datos
// estables: el zoom y el arrastre no vuelven a pintar nada con React.
import { memo, type CSSProperties } from "react";
import { StarMark, type StarState } from "../../ui";
import { catalog } from "../../state/catalog";
import { useHover } from "./hover";
import { arcPath, dotPath, edgePath, type SkyModel, type WNode, type WUnit } from "./model";
import type { NodeVis, SkyState } from "./states";

export const DEFS_ID = "carta";

/* ───────── Retícula: separadores de franja y meridianos de profundidad ───────── */

export const GridLayer = memo(function GridLayer({ model }: { model: SkyModel }) {
  const x0 = -600;
  const x1 = model.width + 600;
  const seps = model.lanes.slice(1).map((l) => l.y - 12);
  const meridians: number[] = [];
  for (let L = 0; L <= model.maxLayer + 1; L += 5) meridians.push(model.left + L * model.colWidth);
  const top = -200;
  const bottom = model.height + 200;
  return (
    <g className="map-grid map-u" aria-hidden="true">
      <path className="map-grid-mer" d={meridians.map((x) => `M${x} ${top}V${bottom}`).join("")} />
      <path className="map-grid-sep" d={seps.map((y) => `M${x0} ${y}H${x1}`).join("")} />
      <path className="map-grid-edge" d={`M${x0} -12H${x1}M${x0} ${model.height + 12}H${x1}`} />
    </g>
  );
});

/* ───────── Lejos: constelaciones de temas ───────── */

const dotGroups = (model: SkyModel, sky: SkyState) => {
  const groups: Record<string, string[]> = { unseen: [], lit: [], cool: [], today: [], mastered: [] };
  const seen: Record<string, string[]> = {};
  for (const n of model.nodes) {
    const v = sky.vis.get(n.id)!;
    const d = dotPath(n.x, n.y);
    if (sky.todaySet.has(n.id)) groups.today.push(d);
    else if (v.cooling) groups.cool.push(d);
    else if (v.level === 3) groups.mastered.push(d);
    else if (v.lit) groups.lit.push(d);
    else if (v.level === 1) (seen[n.subjectId] ??= []).push(d);
    else groups.unseen.push(d);
  }
  return { groups, seen };
};

/** Lente Impacto de lejos: puntos por tramos de √dependientes (grosor) y encendidos o no (color). */
const IMPACT_BUCKETS = [0.12, 0.3, 0.55, 1.01];
const IMPACT_WIDTHS = [2, 4.5, 8, 12];
const impactDots = (model: SkyModel, sky: SkyState) => {
  const out: { key: string; d: string; w: number; lit: boolean }[] = [];
  for (let b = 0; b < IMPACT_BUCKETS.length; b++) {
    for (const lit of [false, true]) {
      const ds: string[] = [];
      for (const n of model.nodes) {
        const s = Math.sqrt(n.deps / model.maxDeps);
        const nb = IMPACT_BUCKETS.findIndex((t) => s < t);
        if (nb !== b || !!sky.vis.get(n.id)?.lit !== lit) continue;
        ds.push(dotPath(n.x, n.y));
      }
      if (ds.length) out.push({ key: `${b}-${lit}`, d: ds.join(""), w: IMPACT_WIDTHS[b], lit });
    }
  }
  return out;
};

export const FarLayer = memo(function FarLayer({ model, sky, impact }: { model: SkyModel; sky: SkyState; impact: boolean }) {
  const { groups, seen } = dotGroups(model, sky);
  const glow = [...groups.lit, ...groups.mastered, ...groups.today].join("");
  return (
    <g className="map-far">
      <g className="map-far-arcs map-u" aria-hidden="true">
        {model.unitArcs.map((a) => {
          const ua = model.unitBy.get(a.a)!;
          const ub = model.unitBy.get(a.b)!;
          return <path key={`${a.a}-${a.b}`} d={arcPath(ua.x, ua.y, ub.x, ub.y, 0.16)} style={{ strokeOpacity: Math.min(0.9, 0.3 + a.w * 0.07) } as CSSProperties} />;
        })}
      </g>
      {impact ? (
        <g className="map-far-dots map-u" aria-hidden="true">
          {impactDots(model, sky).map((g) => (
            <path key={g.key} className={`map-dot map-dot--imp${g.lit ? " is-lit" : ""}`} d={g.d} style={{ strokeWidth: `calc(var(--u) * ${g.w}px)` }} />
          ))}
        </g>
      ) : (
      <g className="map-far-dots map-u" aria-hidden="true">
        <path className="map-dot map-dot--unseen" d={groups.unseen.join("")} />
        {Object.entries(seen).map(([sid, ds]) => (
          <path key={sid} className="map-dot map-dot--seen" d={ds.join("")} style={{ stroke: `var(--s-${sid})` }} />
        ))}
        <path className="map-dot map-dot--glow" d={glow} />
        <path className="map-dot map-dot--cool" d={groups.cool.join("")} />
        <path className="map-dot map-dot--lit" d={groups.lit.join("")} />
        <path className="map-dot map-dot--mastered" d={groups.mastered.join("")} />
        <path className="map-dot map-dot--today" d={groups.today.join("")} />
      </g>
      )}
      <g className="map-far-links map-u" aria-hidden="true">
        {model.lanes.map((lane) => (
          <path
            key={lane.subjectId}
            d={model.unitLinks
              .filter((l) => l.subjectId === lane.subjectId)
              .map((l) => {
                const a = model.unitBy.get(l.a)!;
                const b = model.unitBy.get(l.b)!;
                return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
              })
              .join("")}
            style={{ stroke: `var(--s-${lane.subjectId})` }}
          />
        ))}
      </g>
      <g className="map-units">
        {model.units.map((u) => {
          const st = sky.units.get(u.id) ?? { lit: 0, seen: 0, total: u.nodeIds.length };
          return <UnitStar key={u.id} u={u} lit={st.lit} seen={st.seen} total={st.total} />;
        })}
      </g>
      <g className="map-ulbls" aria-hidden="true">
        {model.units.map((u) => {
          const st = sky.units.get(u.id) ?? { lit: 0, seen: 0, total: u.nodeIds.length };
          return <UnitLabel key={u.id} u={u} pct={st.total ? Math.round((st.lit / st.total) * 100) : 0} />;
        })}
      </g>
    </g>
  );
});

/** Radio base del anillo de un tema según su nº de conceptos. */
export const unitRadius = (total: number) => 6.5 + 3.2 * Math.sqrt(total / 12);

const UnitStar = memo(function UnitStar({ u, lit, seen, total }: { u: WUnit; lit: number; seen: number; total: number }) {
  const p = total ? lit / total : 0;
  const s = total ? seen / total : 0;
  const R = unitRadius(total);
  const C = 2 * Math.PI * R;
  return (
    <g className="map-unit" data-uid={u.id} transform={`translate(${u.x.toFixed(1)} ${u.y.toFixed(1)})`} style={{ "--c": `var(--s-${u.subjectId})` } as CSSProperties}>
      <g className="map-ts">
        <circle className="map-hit" r={R + 8} />
        {p > 0 && <circle className="map-unit-glow" r={R + 6 + 12 * p} fill={`url(#${DEFS_ID}-warm)`} />}
        <circle className="map-unit-ring" r={R} />
        {s > 0 && <circle className="map-unit-seen" r={R} strokeDasharray={`${(s * C).toFixed(2)} ${C.toFixed(2)}`} transform="rotate(-90)" />}
        {p > 0 && <circle className="map-unit-arc" r={R} strokeDasharray={`${(p * C).toFixed(2)} ${C.toFixed(2)}`} transform="rotate(-90)" />}
        {p >= 0.999 && <path className="map-unit-flare" d="M0-13 1.1-1.1 13 0 1.1 1.1 0 13-1.1 1.1-13 0-1.1-1.1Z" />}
        <circle className={p > 0 ? "map-unit-core is-lit" : s > 0 ? "map-unit-core is-seen" : "map-unit-core"} r={p > 0 ? 2.4 + 1.8 * p : 2.2} />
      </g>
    </g>
  );
});

const UnitLabel = memo(function UnitLabel({ u, pct }: { u: WUnit; pct: number }) {
  const R = unitRadius(u.nodeIds.length);
  return (
    <g className="map-ulbl" data-uid={u.id} transform={`translate(${u.x.toFixed(1)} ${u.y.toFixed(1)})`} style={{ "--ur": `${R + 7}px` } as CSSProperties}>
      <g className="map-ts">
        <text className="map-ulbl-n">
          <tspan className="map-ulbl-num">T{u.number}</tspan>
          {pct > 0 && (
            <tspan className="map-ulbl-pct" dx="6">
              {pct}&nbsp;%
            </tspan>
          )}
        </text>
        <text className="map-ulbl-t" y="15">
          {u.title.length > 30 ? `${u.title.slice(0, 29).replace(/[\s,:;-]+$/, "")}…` : u.title}
        </text>
      </g>
    </g>
  );
});

/* ───────── Líneas de constelación (requires), agrupadas en pocos <path> ───────── */

export type EdgeGroup = { key: string; d: string; cls: string; subjectId?: string };

/** Tramo inicial de una arista (salida o llegada), en unidades de mundo. */
const STUB_FROM = 11;
const STUB_TO = 58;

/**
 * Aristas agrupadas por tipo y estado. Las que cruzan de franja se dibujan como
 * dos arranques cortos en discontinuo (salida y llegada, color de destino): la
 * línea entera solo aparece al pasar por encima o al seleccionar, para que el
 * cielo no se convierta en una maraña. Con `full` (lente Examen, pocas
 * estrellas) se dibujan enteras.
 */
export function buildEdgeGroups(model: SkyModel, vis: ReadonlyMap<string, NodeVis>, only?: ReadonlySet<string>, full = false): EdgeGroup[] {
  const buckets = new Map<string, { d: string[]; cls: string; subjectId?: string }>();
  const push = (key: string, cls: string, d: string, subjectId?: string) => {
    let b = buckets.get(key);
    if (!b) {
      b = { d: [], cls, subjectId };
      buckets.set(key, b);
    }
    b.d.push(d);
  };
  const f = (v: number) => v.toFixed(1);
  for (const e of model.requires) {
    if (only && (!only.has(e.from) || !only.has(e.to))) continue;
    const a = model.byId.get(e.from)!;
    const b = model.byId.get(e.to)!;
    const lit = !!vis.get(a.id)?.lit && !!vis.get(b.id)?.lit;
    if (a.subjectId === b.subjectId) {
      push(lit ? "in-lit" : "in", lit ? "map-edge map-edge--in is-lit" : "map-edge map-edge--in", edgePath(a.x, a.y, b.x, b.y));
      continue;
    }
    const key = `${lit ? "x-lit" : "x"}:${b.subjectId}`;
    const cls = lit ? "map-edge map-edge--x is-lit" : "map-edge map-edge--x";
    if (full) {
      push(key, cls, edgePath(a.x, a.y, b.x, b.y), b.subjectId);
      continue;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const d =
      `M${f(a.x + ux * STUB_FROM)} ${f(a.y + uy * STUB_FROM)}L${f(a.x + ux * STUB_TO)} ${f(a.y + uy * STUB_TO)}` +
      `M${f(b.x - ux * STUB_FROM)} ${f(b.y - uy * STUB_FROM)}L${f(b.x - ux * STUB_TO)} ${f(b.y - uy * STUB_TO)}`;
    push(key, `${cls} is-stub`, d, b.subjectId);
  }
  return [...buckets].map(([key, b]) => ({ key, d: b.d.join(""), cls: b.cls, subjectId: b.subjectId }));
}

/** Aristas directas de la estrella bajo el puntero (entrantes y salientes, enteras). */
export function HoverEdges({ model }: { model: SkyModel }) {
  const h = useHover();
  if (!h || h.kind !== "node") return null;
  const n = model.byId.get(h.id);
  if (!n) return null;
  const inD: string[] = [];
  const outD: string[] = [];
  for (const r of catalog.requiresOf.get(n.id) ?? []) {
    const a = model.byId.get(r);
    if (a) inD.push(edgePath(a.x, a.y, n.x, n.y));
  }
  for (const r of catalog.requiredBy.get(n.id) ?? []) {
    const b = model.byId.get(r);
    if (b) outD.push(edgePath(n.x, n.y, b.x, b.y));
  }
  return (
    <g className="map-hover-edges map-u" aria-hidden="true">
      <path className="map-hover-edge map-hover-edge--in" d={inD.join("")} />
      <path className="map-hover-edge map-hover-edge--out" d={outD.join("")} />
    </g>
  );
}

export const EdgeLayer = memo(function EdgeLayer({ groups }: { groups: EdgeGroup[] }) {
  return (
    <g className="map-edges map-u" aria-hidden="true">
      {groups.map((g) => (
        <path key={g.key} className={g.cls} d={g.d} style={g.subjectId ? ({ "--c": `var(--s-${g.subjectId})` } as CSSProperties) : undefined} />
      ))}
    </g>
  );
});

/* ───────── Estrellas-concepto ───────── */

type StarNodeProps = { n: WNode; state: StarState; r: number | null; sz: number };

export const StarNode = memo(function StarNode({ n, state, r, sz }: StarNodeProps) {
  const style = { "--fr": r == null ? 1 : Math.max(0, Math.min(1, r)).toFixed(2) } as CSSProperties;
  return (
    <g className="map-node" data-id={n.id} transform={`translate(${n.x} ${n.y})`} style={style}>
      <g className="map-gs">
        <circle className="map-hit" r={Math.max(12, 10 * sz)} />
        <StarMark state={state} defsId={DEFS_ID} subjectId={n.subjectId} scale={sz} tag={false} />
      </g>
    </g>
  );
});

export const NodeLayer = memo(function NodeLayer({
  nodes,
  vis,
  sizes,
}: {
  nodes: WNode[];
  vis: ReadonlyMap<string, NodeVis>;
  sizes: ReadonlyMap<string, number>;
}) {
  return (
    <g className="map-nodes">
      {nodes.map((n) => {
        const v = vis.get(n.id)!;
        return <StarNode key={n.id} n={n} state={v.state} r={v.r} sz={sizes.get(n.id) ?? 1} />;
      })}
    </g>
  );
});

/* ───────── Etiquetas de concepto ───────── */

export const labelTone = (v: NodeVis | undefined, today: boolean) =>
  today ? "is-today" : !v ? "is-off" : v.cooling ? "is-cool" : v.lit ? "is-lit" : v.level === 1 ? "is-seen" : "is-off";

const TAGS: Partial<Record<StarState, string>> = { today: "HOY", next: "SIGUIENTE" };

/**
 * Etiqueta de concepto. La cadena de transformaciones deja el texto a tamaño
 * constante en pantalla y justo debajo (o encima) del glifo, sea cual sea el
 * zoom: .map-gs (escala del glifo) → desplazamiento del radio (estático, por
 * tamaño) → .map-lu (deshace la escala del glifo y la del mundo).
 */
const NodeLabel = memo(function NodeLabel({ n, tone, sz, tag }: { n: WNode; tone: string; sz: number; tag?: string }) {
  const style = { "--o": `${(9 * sz).toFixed(2)}px`, "--nl": n.lines.length - 1 } as CSSProperties;
  const tw = tag ? Math.round(tag.length * 5.7 + 12) : 0;
  return (
    <g className={`map-lbl ${tone}${tag ? ` has-tag has-tag--${tag === "HOY" ? "today" : "next"}` : ""}`} data-lid={n.id} transform={`translate(${n.x} ${n.y})`} style={style}>
      {tag && (
        <g className="map-gs">
          <g className="map-to">
            <g className="map-lu">
              <g className={`map-tag ui-star-tag ${tag === "HOY" ? "ui-star-tag--solid" : "ui-star-tag--line"}`}>
                <rect x={-tw / 2} y="-6.5" width={tw} height="13" rx="6.5" />
                <text y="3" textAnchor="middle">
                  {tag}
                </text>
              </g>
            </g>
          </g>
        </g>
      )}
      <g className="map-gs">
        <g className="map-lo">
          <g className="map-lu">
            <text className="map-lbl-t">
              {n.lines.map((l, i) => (
                <tspan key={i} x="0" dy={i === 0 ? 0 : "1.16em"}>
                  {l}
                </tspan>
              ))}
            </text>
          </g>
        </g>
      </g>
    </g>
  );
});

export const LabelLayer = memo(function LabelLayer({
  nodes,
  vis,
  sizes,
  todaySet,
}: {
  nodes: WNode[];
  vis: ReadonlyMap<string, NodeVis>;
  sizes: ReadonlyMap<string, number>;
  todaySet: ReadonlySet<string>;
}) {
  return (
    <g className="map-lbls" aria-hidden="true">
      {nodes.map((n) => (
        <NodeLabel key={n.id} n={n} tone={labelTone(vis.get(n.id), todaySet.has(n.id))} sz={sizes.get(n.id) ?? 1} tag={TAGS[vis.get(n.id)!.state]} />
      ))}
    </g>
  );
});

/* ───────── Selección: ruta de requisitos y dependientes ───────── */

export type Selection = {
  id: string;
  /** Requisitos transitivos con su distancia (1 = directo). */
  pre: ReadonlyMap<string, number>;
  /** Dependientes transitivos con su distancia. */
  dep: ReadonlyMap<string, number>;
};

/**
 * Se dibujan en oro los tres primeros pasos de la ruta, cada vez más tenues; lo
 * que está más lejos se queda bajo el velo. (Un concepto de base arrastra cientos
 * de dependientes: pintarlos todos encima convertiría el cielo en una maraña dorada
 * y haría lentísimo rasterizar la capa.)
 */
export const PATH_DEPTH = 3;
const BUCKETS = [1, 2, 3];
const bucketOf = (d: number) => Math.min(PATH_DEPTH, d);

export const HighlightLayer = memo(function HighlightLayer({
  model,
  selection,
  vis,
  sizes,
}: {
  model: SkyModel;
  selection: Selection;
  vis: ReadonlyMap<string, NodeVis>;
  sizes: ReadonlyMap<string, number>;
}) {
  const { id, pre, dep } = selection;
  const depthPre = (x: string) => (x === id ? 0 : pre.get(x));
  const depthDep = (x: string) => (x === id ? 0 : dep.get(x));
  const edges: string[][] = BUCKETS.map(() => []);
  for (const e of model.requires) {
    const a = model.byId.get(e.from)!;
    const b = model.byId.get(e.to)!;
    // hacia atrás: el requisito está un paso más lejos que el que lo pide
    const pa = depthPre(e.from);
    const pb = depthPre(e.to);
    if (pa !== undefined && pb !== undefined && pa === pb + 1) {
      if (pa <= PATH_DEPTH) edges[bucketOf(pa) - 1].push(edgePath(a.x, a.y, b.x, b.y));
      continue;
    }
    const da = depthDep(e.from);
    const db = depthDep(e.to);
    if (da !== undefined && db !== undefined && db === da + 1 && db <= PATH_DEPTH) edges[bucketOf(db) - 1].push(edgePath(a.x, a.y, b.x, b.y));
  }
  const byBucket: WNode[][] = BUCKETS.map(() => []);
  for (const [nid, d] of pre) if (d <= PATH_DEPTH) byBucket[d - 1].push(model.byId.get(nid)!);
  for (const [nid, d] of dep) if (d <= PATH_DEPTH) byBucket[d - 1].push(model.byId.get(nid)!);
  const sel = model.byId.get(id)!;
  const sv = vis.get(id)!;
  return (
    <g className="map-hl">
      <g className="map-u">
        {edges.map((ds, i) => (
          <path key={i} className={`map-hl-edge map-hl-edge--${i + 1}`} d={ds.join("")} />
        ))}
        <path className="map-hl-spark" d={edges[0].join("")} />
      </g>
      {byBucket.map((ns, i) => (
        <g key={i} className={`map-hl-nodes map-hl-nodes--${i + 1}`}>
          {ns.map((n) => {
            const v = vis.get(n.id)!;
            return <StarNode key={n.id} n={n} state={v.state} r={v.r} sz={sizes.get(n.id) ?? 1} />;
          })}
        </g>
      ))}
      <g className="map-sel" transform={`translate(${sel.x} ${sel.y})`}>
        <g className="map-gs">
          <circle className="map-sel-ring" r={15 * (sizes.get(id) ?? 1) + 3} />
          <circle className="map-sel-orbit" r={15 * (sizes.get(id) ?? 1) + 9} />
        </g>
      </g>
      <StarNode n={sel} state={sv.state} r={sv.r} sz={sizes.get(id) ?? 1} />
    </g>
  );
});

/* ───────── Estrella guía: su constelación en oro ───────── */

export const GuideLayer = memo(function GuideLayer({
  model,
  ids,
  vis,
  sizes,
}: {
  model: SkyModel;
  ids: string[];
  vis: ReadonlyMap<string, NodeVis>;
  sizes: ReadonlyMap<string, number>;
}) {
  const ns = ids.map((id) => model.byId.get(id)).filter((n): n is WNode => !!n);
  // Árbol mínimo euclídeo (Prim): la figura de la constelación.
  const links: [WNode, WNode][] = [];
  if (ns.length > 1) {
    const inTree = new Set([0]);
    while (inTree.size < ns.length) {
      let best: [number, number, number] | null = null;
      for (const i of inTree) {
        for (let j = 0; j < ns.length; j++) {
          if (inTree.has(j)) continue;
          const d = Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y);
          if (!best || d < best[2]) best = [i, j, d];
        }
      }
      if (!best) break;
      inTree.add(best[1]);
      links.push([ns[best[0]], ns[best[1]]]);
    }
  }
  return (
    <g className="map-guide">
      <g className="map-u">
        <path className="map-guide-line map-guide-line--glow" d={links.map(([a, b]) => `M${a.x} ${a.y}L${b.x} ${b.y}`).join("")} />
        <path className="map-guide-line" d={links.map(([a, b]) => `M${a.x} ${a.y}L${b.x} ${b.y}`).join("")} />
      </g>
      {ns.map((n) => {
        const v = vis.get(n.id)!;
        return (
          <g key={n.id}>
            <g className={`map-guide-mark${v.lit ? " is-lit" : ""}`} transform={`translate(${n.x} ${n.y})`}>
              <g className="map-ts">
                <circle r="13" />
              </g>
            </g>
            <StarNode n={n} state={v.state} r={v.r} sz={sizes.get(n.id) ?? 1} />
          </g>
        );
      })}
    </g>
  );
});

/* ───────── Marcas de base externa (lente Examen) ───────── */

export const ExternalMarks = memo(function ExternalMarks({ model, ids }: { model: SkyModel; ids: string[] }) {
  return (
    <g className="map-ext" aria-hidden="true">
      {ids.map((id) => {
        const n = model.byId.get(id);
        if (!n) return null;
        return (
          <g key={id} transform={`translate(${n.x} ${n.y})`}>
            <g className="map-gs">
              <circle r="14" />
            </g>
          </g>
        );
      })}
    </g>
  );
});

/* ───────── Marcas de los avisos del tutor ───────── */

export const NoticeMarks = memo(function NoticeMarks({ model, marks }: { model: SkyModel; marks: { id: string; kind: string }[] }) {
  return (
    <g className="map-nmarks" aria-hidden="true">
      {marks.map(({ id, kind }) => {
        const n = model.byId.get(id);
        if (!n) return null;
        return (
          <g key={id} className={`map-nmark map-nmark--${kind}`} transform={`translate(${n.x} ${n.y})`}>
            <g className="map-ts">
              <circle className="map-nmark-ring" r="15" />
              <circle className="map-nmark-pulse" r="15" />
            </g>
          </g>
        );
      })}
    </g>
  );
});
