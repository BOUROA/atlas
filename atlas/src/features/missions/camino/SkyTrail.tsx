// El sendero de estrellas de una asignatura (Misiones › Camino): el cielo
// nocturno se sube de abajo arriba, con las estrellas (temas y controles),
// los planetas (simulacros) y la escalera de élite hasta la Cumbre. El SVG es
// decorativo; los nodos son enlaces reales superpuestos (accesibilidad).
import { useEffect, useMemo, useRef } from "react";
import { Check, Hourglass, Lock, MapPin, Mountain, Rocket } from "lucide-react";
import type { SubjectPath } from "../../../domain/camino";
import type { ConceptProgress } from "../../../domain/tutor/mastery";
import { cx, subjectColor } from "../../../ui";
import { backgroundStars, layoutTrail, levelRuler, nodeHref, nodeShortLabel, nodeStateLabel, nodeUnitNumber, splinePath, type Trail, type TrailPoint } from "./helpers";

const LEVEL_LABEL = ["", "Base", "Controles", "Parcial", "Exigente", "Final", "Máximo", "Élite"];

/** Estrella de 4 puntas (control/tema/élite), como la del cielo de la maqueta. */
function star4Path(r: number): string {
  const k = r * 0.3;
  return `M0 ${-r} C${k * 0.22} ${-k} ${k} ${-k * 0.22} ${r} 0 C${k} ${k * 0.22} ${k * 0.22} ${k} 0 ${r} C${-k * 0.22} ${k} ${-k} ${k * 0.22} ${-r} 0 C${-k} ${-k * 0.22} ${-k * 0.22} ${-k} 0 ${-r}Z`;
}

function StarNode({ p, done, here }: { p: TrailPoint; done: boolean; here: boolean }) {
  const { node, x, y, r } = p;
  const unitNo = nodeUnitNumber(node);
  const stars = node.kind === "control" ? node.stars : 0;
  const showStars = node.kind === "control";
  const fill = done ? "var(--gold-hi)" : here ? "var(--gold-hi)" : "var(--text-4)";
  return (
    <g>
      {(done || here) && <circle cx={x} cy={y} r={r + 12 + stars * 3} fill="url(#camino-halo)" opacity={done ? 0.55 : 0.75} />}
      <path d={star4Path(r)} transform={`translate(${x} ${y})`} fill={fill} />
      <circle cx={x} cy={y} r={1.6} fill="var(--star)" />
      {unitNo != null && (
        <text className="camino-glyph-tag" x={x} y={y - r - 8} textAnchor="middle">
          T{unitNo}
        </text>
      )}
      {showStars && (
        <g>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={star4Path(4)}
              transform={`translate(${x - 12 + i * 12} ${y + r + 10})`}
              fill={i < stars ? "var(--gold-hi)" : "none"}
              stroke={i < stars ? "none" : "var(--text-4)"}
              strokeWidth={1.4}
            />
          ))}
        </g>
      )}
    </g>
  );
}

function PlanetNode({ p, done, here, subjectId }: { p: TrailPoint; done: boolean; here: boolean; subjectId: string }) {
  const { node, x, y, r } = p;
  const label = nodeShortLabel(node);
  const left = x > VB_CENTER;
  const anchor = left ? "end" : "start";
  const labelX = left ? x - r * 1.7 - 12 : x + r * 1.7 + 12;
  const ring = done ? "var(--gold-hi)" : here ? "var(--gold-hi)" : "var(--text-4)";
  return (
    <g>
      {here && (
        <>
          <circle cx={x} cy={y} r={r + 36} fill="url(#camino-halo)" opacity={0.5} />
          <circle cx={x} cy={y} r={r + 12} fill="none" stroke="var(--gold-hi)" strokeOpacity={0.5} />
        </>
      )}
      {done && <circle cx={x} cy={y} r={r + 15} fill="url(#camino-halo)" opacity={0.55} />}
      <circle cx={x} cy={y} r={r} fill={done ? "url(#camino-pl-done)" : "url(#camino-pl-up)"} stroke={done ? "none" : ring} strokeWidth={here ? 2 : 1.2} strokeOpacity={done ? 1 : 0.7} />
      <ellipse cx={x} cy={y} rx={r * 1.75} ry={r * 0.46} transform={`rotate(-18 ${x} ${y})`} fill="none" stroke={subjectColor(subjectId)} strokeWidth={1.3} strokeOpacity={done || here ? 0.85 : 0.45} />
      {done ? (
        <Check x={x - 7} y={y - 7} width={14} height={14} color="var(--gold-ink)" strokeWidth={2.4} />
      ) : (
        <Hourglass x={x - 6.5} y={y - 6.5} width={13} height={13} color={here ? "var(--gold-hi)" : "var(--text-3)"} strokeWidth={1.8} />
      )}
      <text className="camino-glyph-name" x={labelX} y={y - 1} textAnchor={anchor} style={{ fill: done ? "var(--text-2)" : here ? "var(--text)" : "var(--text-2)" }}>
        {label}
      </text>
      <text className="camino-glyph-sub" x={labelX} y={y + 15} textAnchor={anchor}>
        {LEVEL_LABEL[node.level ?? 0]}
      </text>
    </g>
  );
}

function EliteNode({ p, done }: { p: TrailPoint; done: boolean }) {
  const { node, x, y, r } = p;
  const left = x > VB_CENTER;
  const lx = left ? x - r - 12 : x + r + 12;
  return (
    <g>
      <path d={star4Path(r)} transform={`translate(${x} ${y})`} fill="none" stroke={done ? "var(--gold-hi)" : "var(--text-3)"} strokeWidth={1.3} />
      {done ? <Check x={x - 4.5} y={y + 8} width={9} height={9} color="var(--gold-hi)" strokeWidth={2.4} /> : <Lock x={x - 5} y={y + 9} width={10} height={10} color="var(--text-3)" strokeWidth={2.2} />}
      <g transform={`translate(${left ? lx - 12 : lx} ${y - 6})`}>
        <Rocket width={12} height={12} color="var(--text-3)" strokeWidth={2} />
      </g>
      <text className="camino-glyph-elite" x={left ? lx - 14 : lx + 14} y={y + 4} textAnchor={left ? "end" : "start"}>
        {nodeShortLabel(node)}
      </text>
    </g>
  );
}

function SummitNode({ p, done, subjectId }: { p: TrailPoint; done: boolean; subjectId: string }) {
  const { node, x, y, r } = p;
  const left = x > VB_CENTER;
  const labelX = left ? x - r * 1.75 - 12 : x + r * 1.75 + 12;
  return (
    <g>
      <circle cx={x} cy={y} r={r + 14} fill="none" stroke="var(--gold)" strokeOpacity={done ? 0.4 : 0.28} strokeDasharray="2 5" />
      {done && <circle cx={x} cy={y} r={r + 18} fill="url(#camino-halo)" opacity={0.6} />}
      <circle cx={x} cy={y} r={r} fill={done ? "url(#camino-pl-done)" : "url(#camino-pl-up)"} stroke={done ? "none" : "var(--text-3)"} strokeWidth={1.3} />
      <ellipse cx={x} cy={y} rx={r * 2.05} ry={r * 0.58} transform={`rotate(-18 ${x} ${y})`} fill="none" stroke={subjectColor(subjectId)} strokeWidth={1.4} strokeOpacity={done ? 0.85 : 0.45} />
      <Mountain x={x - 10} y={y - 10} width={20} height={20} color={done ? "var(--gold-ink)" : "var(--text-3)"} strokeWidth={1.7} />
      <text className="camino-glyph-name" style={{ fill: "var(--gold-hi)" }} x={labelX} y={y - 1} textAnchor={left ? "end" : "start"}>
        Cumbre
      </text>
      <text className="camino-glyph-sub" x={labelX} y={y + 15} textAnchor={left ? "end" : "start"}>
        {nodeShortLabel(node)}
      </text>
    </g>
  );
}

const VB_CENTER = 320;

function HerePin({ p }: { p: TrailPoint }) {
  const { x, y, r } = p;
  const w = 118;
  const x0 = Math.min(640 - 12 - w, Math.max(12, x - w / 2));
  const y0 = y - r - 56;
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y0} width={w} height={24} rx={12} fill="var(--gold-hi)" />
      <path d={`M${x - 6} ${y0 + 23}l6 8 6-8z`} fill="var(--gold-hi)" />
      <MapPin x={x0 + 10} y={y0 + 5} width={14} height={14} color="var(--gold-ink)" strokeWidth={2.2} />
      <text className="camino-here-pintext" x={x0 + 30} y={y0 + 16}>
        ESTÁS AQUÍ
      </text>
    </g>
  );
}

export type SkyTrailProps = {
  subjectId: string;
  path: SubjectPath;
  progress: ReadonlyMap<string, ConceptProgress>;
};

/** Sendero de una asignatura: cielo con las estrellas de sus temas y controles, los planetas de sus simulacros y la escalera de élite hasta la Cumbre. */
export function SkyTrail({ subjectId, path, progress }: SkyTrailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trail: Trail = useMemo(() => layoutTrail(path.nodes, subjectId), [path.nodes, subjectId]);
  const stars = useMemo(() => backgroundStars(subjectId, 70, trail.width, trail.height), [subjectId, trail.width, trail.height]);
  const ruler = useMemo(() => levelRuler(trail.height), [trail.height]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hereY = path.current >= 0 ? (trail.points[path.current]?.y ?? 0) : 0;
    const frac = trail.height > 0 ? hereY / trail.height : 0;
    const id = requestAnimationFrame(() => {
      const target = frac * el.scrollHeight - el.clientHeight / 2;
      el.scrollTo({ top: Math.max(0, target), behavior: "auto" });
    });
    return () => cancelAnimationFrame(id);
  }, [subjectId, path.current, trail]);

  const doneSpline = trail.points.slice(0, path.current < 0 ? trail.points.length : path.current + 1);
  const todoSpline = path.current < 0 ? [] : trail.points.slice(path.current);

  return (
    <div className="camino-trailwrap" ref={scrollRef}>
      <div className="camino-trail" style={{ aspectRatio: `${trail.width} / ${trail.height}` }}>
        <svg className="camino-trail-svg" viewBox={`0 0 ${trail.width} ${trail.height}`} aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="camino-halo"><stop offset="0" stopColor="var(--gold-hi)" stopOpacity={0.5} /><stop offset="1" stopColor="var(--gold-hi)" stopOpacity={0} /></radialGradient>
            <radialGradient id="camino-pl-done" cx=".38" cy=".32"><stop offset="0" stopColor="var(--gold-hi)" /><stop offset=".6" stopColor="var(--gold)" /><stop offset="1" stopColor="var(--gold-lo)" /></radialGradient>
            <radialGradient id="camino-pl-up" cx=".38" cy=".32"><stop offset="0" stopColor="var(--ink-3)" /><stop offset="1" stopColor="var(--ink-1)" /></radialGradient>
          </defs>
          <g fill="var(--star)">
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
            ))}
          </g>
          {ruler.map((m) => (
            <g key={m.level}>
              <circle cx={26} cy={m.y} r={12} fill={m.level <= path.level.level ? "rgba(243,182,74,.14)" : "none"} stroke={m.level <= path.level.level ? "var(--gold-hi)" : "var(--text-4)"} strokeOpacity={m.level <= path.level.level ? 0.85 : 0.55} />
              <text className="camino-ruler-n" x={26} y={m.y + 5} textAnchor="middle" style={{ fill: m.level <= path.level.level ? "var(--gold-hi)" : "var(--text-4)" }}>{m.level}</text>
              <text className="camino-ruler-l" x={46} y={m.y + 3.5} style={{ fill: m.level <= path.level.level ? "var(--text-2)" : "var(--text-4)" }}>{LEVEL_LABEL[m.level]}</text>
            </g>
          ))}
          {doneSpline.length > 1 && (
            <>
              <path d={splinePath(doneSpline)} fill="none" stroke="var(--gold)" strokeWidth={6} strokeOpacity={0.32} />
              <path d={splinePath(doneSpline)} fill="none" stroke="var(--gold-hi)" strokeWidth={2} strokeLinecap="round" />
            </>
          )}
          {todoSpline.length > 1 && <path d={splinePath(todoSpline)} fill="none" stroke="rgba(170,188,235,.32)" strokeWidth={1.6} strokeDasharray="1.5 7" strokeLinecap="round" />}
          {trail.points.map((p, i) => {
            const done = p.node.done;
            const here = i === path.current;
            if (p.node.summit) return <SummitNode key={p.node.id} p={p} done={done} subjectId={subjectId} />;
            if (p.node.kind === "sim-parcial" || p.node.kind === "sim-final") return <PlanetNode key={p.node.id} p={p} done={done} here={here} subjectId={subjectId} />;
            if (p.node.kind === "elite") return <EliteNode key={p.node.id} p={p} done={done} />;
            return <StarNode key={p.node.id} p={p} done={done} here={here} />;
          })}
          {path.current >= 0 && trail.points[path.current] && <HerePin p={trail.points[path.current]} />}
        </svg>
        <ul className="camino-trail-nodes">
          {trail.points.map((p, i) => {
            const here = i === path.current;
            const size = p.node.summit ? "summit" : p.node.kind === "sim-parcial" || p.node.kind === "sim-final" ? "planet" : p.node.kind === "elite" ? "elite" : "star";
            return (
              <li key={p.node.id} className="camino-node-li" style={{ left: `${(p.x / trail.width) * 100}%`, top: `${(p.y / trail.height) * 100}%` }}>
                <a
                  href={nodeHref(p.node, progress)}
                  className={cx("camino-node", `camino-node--${size}`, p.node.done && "is-done", here && "is-here")}
                  aria-label={`${nodeShortLabel(p.node)}: ${nodeStateLabel(p.node, here)}`}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
