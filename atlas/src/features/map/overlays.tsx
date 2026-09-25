// Elementos HTML que siguen a la cámara (nombres de franja, regla de
// profundidad, avisos del tutor y tooltip). Se recolocan escribiendo estilos
// directamente en cada fotograma; React solo los pinta cuando cambian sus datos.
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { catalog } from "../../state/catalog";
import { cx, Freshness, Icons, LevelBars, num, plural, pluralWord, subjectFg } from "../../ui";
import type { SkyModel } from "./model";
import type { SkyState } from "./states";
import { screenGlyph, type SkyView, type View } from "./view";
import { unitRadius } from "./layers";
import { getHover, setHover, useHover } from "./hover";

/* ───────── Nombres de franja (constelaciones) ───────── */

export type LaneBadge = { dep: number; pre: number };

export const LaneLabels = memo(function LaneLabels({
  model,
  sky,
  view,
  badges,
  dimmed,
  compact,
  topInset,
  bottomInset,
  onPick,
}: {
  model: SkyModel;
  sky: SkyState;
  view: SkyView | null;
  badges: ReadonlyMap<string, LaneBadge> | null;
  dimmed: ReadonlySet<string> | null;
  compact: boolean;
  topInset: number;
  bottomInset: number;
  onPick: (subjectId: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const heights = useRef(new Map<string, number>());
  const insets = useRef({ topInset, bottomInset });
  insets.current = { topInset, bottomInset };
  // Alturas medidas tras pintar (nunca en el bucle del zoom: forzaría un recálculo de estilos).
  useLayoutEffect(() => {
    for (const [id, el] of refs.current) heights.current.set(id, el.offsetHeight);
  });
  useEffect(() => {
    if (!view) return;
    return view.onChange((v: View) => {
      const top = insets.current.topInset;
      const bottom = v.h - insets.current.bottomInset;
      // En orden de franja: cada nombre se centra en su franja visible y empuja
      // al siguiente si no cabe (de lejos las franjas son muy estrechas).
      let prevBottom = -Infinity;
      for (const lane of model.lanes) {
        const el = refs.current.get(lane.subjectId);
        if (!el) continue;
        const a = lane.y * v.k + v.y;
        const b = (lane.y + lane.h) * v.k + v.y;
        const vt = Math.max(a, top);
        const vb = Math.min(b, bottom);
        const hh = heights.current.get(lane.subjectId) || 40;
        const c = (a + b) / 2;
        let y0 = Math.max(vt, Math.min(vb - hh, c - hh / 2));
        y0 = Math.max(y0, prevBottom + 2);
        if (vb - vt < 14 || y0 + hh > bottom + 4 || y0 > b) {
          el.style.visibility = "hidden";
          continue;
        }
        prevBottom = y0 + hh;
        el.style.visibility = "";
        el.style.transform = `translate3d(0, ${y0.toFixed(1)}px, 0)`;
      }
    });
  }, [view, model]);

  return (
    <div className={cx("map-lanes", compact && "is-compact")}>
      {model.lanes.map((lane) => {
        const st = sky.lanes.get(lane.subjectId) ?? { lit: 0, total: lane.nodeIds.length, cooling: 0, today: 0 };
        const badge = badges?.get(lane.subjectId);
        const pct = st.total ? Math.round((st.lit / st.total) * 100) : 0;
        const off = (badges && !badge) || dimmed?.has(lane.subjectId);
        return (
          <button
            key={lane.subjectId}
            type="button"
            ref={(el) => {
              if (el) refs.current.set(lane.subjectId, el);
              else refs.current.delete(lane.subjectId);
            }}
            className={cx("map-lane", off && "is-off")}
            style={{ "--c": `var(--s-${lane.subjectId})`, "--cf": subjectFg(lane.subjectId) } as CSSProperties}
            onClick={() => onPick(lane.subjectId)}
            aria-label={`${lane.name}: ${st.lit} de ${st.total} estrellas encendidas. Encajar la constelación`}
          >
            <span className="map-lane-name">
              <i aria-hidden="true" />
              {compact ? lane.abbr : lane.short}
            </span>
            {badge && !compact && (badge.dep > 0 || badge.pre > 0) ? (
              // Con una estrella elegida, la segunda línea dice cuánto de esta constelación está en su ruta.
              <span className="map-lane-badge num">
                {badge.dep > 0
                  ? `${plural(badge.dep, "concepto depende", "conceptos dependen")}`
                  : `${plural(badge.pre, "concepto es base", "conceptos son base")}`}
              </span>
            ) : (
              <span className="map-lane-meta num">{compact ? `${pct} %` : `${st.lit} de ${st.total} · ${pct} %`}</span>
            )}
          </button>
        );
      })}
    </div>
  );
});

/* ───────── Regla de profundidad (coordenadas de la carta) ───────── */

export const Ruler = memo(function Ruler({ model, view, leftInset }: { model: SkyModel; view: SkyView | null; leftInset: number }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const inset = useRef(leftInset);
  inset.current = leftInset;
  const layers = Array.from({ length: model.maxLayer + 1 }, (_, i) => i);
  useEffect(() => {
    if (!view) return;
    return view.onChange((v) => {
      const spacing = model.colWidth * v.k;
      const step = spacing >= 64 ? 1 : spacing >= 22 ? 5 : 10;
      for (const L of layers) {
        const el = refs.current[L];
        if (!el) continue;
        const x = (model.left + L * model.colWidth) * v.k + v.x;
        const show = L % step === 0 && x > inset.current + 8 && x < v.w - 16;
        // visibility (no display): no obliga a volver a disponer la página en cada fotograma
        if (!show) {
          if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
          continue;
        }
        if (el.style.visibility) el.style.visibility = "";
        el.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, model]);
  return (
    <div className="map-ruler" aria-hidden="true">
      {layers.map((L) => (
        <span
          key={L}
          ref={(el) => {
            refs.current[L] = el;
          }}
          className={cx("map-ruler-tick", L % 5 === 0 && "is-major")}
          style={{ visibility: "hidden" }}
        >
          {L}
        </span>
      ))}
    </div>
  );
});

/* ───────── Avisos del tutor anclados ───────── */

export type Notice = { id: string; kind: "late" | "cross"; title: string; body: string };

export const Notices = memo(function Notices({
  model,
  view,
  notices,
  safe,
  onPick,
}: {
  model: SkyModel;
  view: SkyView | null;
  notices: Notice[];
  safe: { top: number; bottom: number; left: number; right: number };
  onPick: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const sizes = useRef(new Map<string, { w: number; h: number }>());
  const safeRef = useRef(safe);
  safeRef.current = safe;
  useLayoutEffect(() => {
    for (const [id, el] of refs.current) sizes.current.set(id, { w: el.offsetWidth, h: el.offsetHeight });
  });
  useEffect(() => {
    if (!view) return;
    return view.onChange((v) => {
      const s = safeRef.current;
      const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
      for (const nt of notices) {
        const el = refs.current.get(nt.id);
        const n = model.byId.get(nt.id);
        if (!el || !n) continue;
        const ax = n.x * v.k + v.x;
        const ay = n.y * v.k + v.y;
        const w = sizes.current.get(nt.id)?.w || 260;
        const h = sizes.current.get(nt.id)?.h || 60;
        const inside = ax > s.left - 4 && ax < v.w - s.right + 4 && ay > s.top - 4 && ay < v.h - s.bottom + 4;
        if (!inside) {
          el.dataset.hidden = "";
          continue;
        }
        delete el.dataset.hidden;
        // A la derecha y por encima de la estrella; si no cabe, a la izquierda; nunca fuera de la zona libre.
        let x = ax + 26;
        let side = "r";
        if (x + w > v.w - s.right) {
          x = ax - 26 - w;
          side = "l";
        }
        let y = ay - h - 14;
        if (y < s.top) y = ay + 18;
        for (const p of placed) if (x < p.x1 && x + w > p.x0 && y < p.y1 && y + h > p.y0) y = p.y1 + 8;
        y = Math.min(y, v.h - s.bottom - h);
        placed.push({ x0: x, y0: y, x1: x + w, y1: y + h });
        el.dataset.side = side;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.style.setProperty("--ax", `${(ax - x).toFixed(1)}px`);
        el.style.setProperty("--ay", `${(ay - y).toFixed(1)}px`);
      }
    });
  }, [view, model, notices]);
  return (
    <div className="map-notices">
      {notices.map((nt) => (
        <button
          key={nt.id}
          type="button"
          data-hidden=""
          ref={(el) => {
            if (el) refs.current.set(nt.id, el);
            else refs.current.delete(nt.id);
          }}
          className={cx("map-notice", `map-notice--${nt.kind}`)}
          onClick={() => onPick(nt.id)}
        >
          <span className="map-notice-icon" aria-hidden="true">
            {nt.kind === "late" ? <Icons.late /> : <Icons.dependencies />}
          </span>
          <span className="map-notice-text">
            <b>{nt.title}</b>
            <span className="map-notice-body">: {nt.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

/* ───────── Tooltip de estrella y de tema ───────── */

export function HoverTip({ model, sky, view }: { model: SkyModel; sky: SkyState; view: SkyView | null }) {
  const h = useHover();
  const ref = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);
  useEffect(() => {
    if (!view) return;
    return view.onChange(() => {
      if (!getHover()) return;
      if (view.moving) setHover(null);
      else force((x) => x + 1);
    });
  }, [view]);

  if (!h || !view) return null;
  let ax = 0;
  let ay = 0;
  let r = 10;
  let body: React.ReactNode = null;
  if (h.kind === "node") {
    const n = model.byId.get(h.id);
    const v = sky.vis.get(h.id);
    if (!n || !v) return null;
    ax = n.x;
    ay = n.y;
    r = 12;
    const unit = catalog.unitById.get(n.unitId);
    body = (
      <>
        <span className="map-tip-eyebrow" style={{ color: subjectFg(n.subjectId) }}>
          {catalog.subjectById.get(n.subjectId)?.shortName} · tema {unit?.number}
        </span>
        <span className="map-tip-name">{n.name}</span>
        <span className="map-tip-row">
          <LevelBars level={v.level} subjectId={n.subjectId} cooling={v.cooling} showLabel="name" size="sm" />
          {v.r == null && v.level >= 1 ? <span className="map-tip-fresh">aún sin repaso</span> : <Freshness r={v.r} size="sm" />}
        </span>
        {n.deps > 0 && <span className="map-tip-foot">Desbloquea {plural(n.deps, "concepto", "conceptos")}</span>}
      </>
    );
  } else {
    const u = model.unitBy.get(h.id);
    if (!u) return null;
    const st = sky.units.get(u.id) ?? { lit: 0, seen: 0, total: u.nodeIds.length };
    ax = u.x;
    ay = u.y;
    r = unitRadius(u.nodeIds.length) + 6;
    body = (
      <>
        <span className="map-tip-eyebrow" style={{ color: subjectFg(u.subjectId) }}>
          {catalog.subjectById.get(u.subjectId)?.shortName} · tema {u.number}
        </span>
        <span className="map-tip-name">{u.title}</span>
        <span className="map-tip-foot">
          {num(st.lit)} de {num(st.total)} {pluralWord(st.total, "estrella encendida", "estrellas encendidas")} · {num(st.seen)} {pluralWord(st.seen, "vista", "vistas")}
        </span>
      </>
    );
  }
  const k = view.view.k;
  const x = ax * k + view.view.x;
  const y = ay * k + view.view.y;
  const scr = h.kind === "unit" ? r : r * screenGlyph(k);
  const below = y < 170;
  return (
    <div
      ref={ref}
      className={cx("map-tip", below && "is-below")}
      role="tooltip"
      style={{ transform: `translate3d(${x.toFixed(1)}px, ${(below ? y + scr + 10 : y - scr - 10).toFixed(1)}px, 0)` }}
    >
      <div className="map-tip-in">{body}</div>
    </div>
  );
}
