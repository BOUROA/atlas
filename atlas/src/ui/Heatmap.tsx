import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cx } from "./cx";
import { capitalize, dateShort, dayKeyOf, minutes, month, num, toDate } from "./format";

export type HeatmapProps = {
  /** Minutos estudiados por día ("YYYY-MM-DD" → minutos). */
  values: Record<string, number>;
  /** Semanas visibles (por defecto 20). La última contiene `today`. */
  weeks?: number;
  /** Día de referencia (por defecto, hoy). */
  today?: string | Date;
  /** Días cubiertos por un comodín de racha. */
  wildcards?: Iterable<string>;
  /** Minutos a partir de los que se enciende cada uno de los 5 niveles. */
  thresholds?: readonly [number, number, number, number, number];
  /** Barras de horas por semana bajo la cuadrícula (por defecto sí). */
  weekTotals?: boolean;
  /** Leyenda Menos…Más · comodín · hoy (por defecto sí). */
  legend?: boolean;
  "aria-label"?: string;
  className?: string;
};

const P = 21; // paso entre días
const X0 = 24; // columna de iniciales
const Y0 = 22; // fila de meses
const RADII = [1.6, 2.7, 3.6, 4.5, 5.4, 6.4];
const DAY_LETTERS: Array<[number, string]> = [
  [0, "L"],
  [2, "X"],
  [4, "V"],
  [6, "D"],
];
const MOON = "M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z";

type Cell = { key: string; col: number; row: number; min: number; level: number; future: boolean; today: boolean; wildcard: boolean };

/**
 * Mapa de actividad: un punto por día que crece y brilla con los minutos, como un
 * campo de estrellas. Hoy lleva anillo dorado; los comodines, una luna.
 * Con el foco, las flechas recorren los días (← → semanas, ↑ ↓ días).
 */
export function Heatmap({
  values,
  weeks = 20,
  today,
  wildcards,
  thresholds = [1, 45, 105, 180, 270],
  weekTotals = true,
  legend = true,
  className,
  ...aria
}: HeatmapProps) {
  const [active, setActive] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  // escala real del SVG: en pantallas estrechas se agranda el texto para que siga legible
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const todayKey = dayKeyOf(today ?? new Date());

  const data = useMemo(() => {
    const t = toDate(todayKey);
    const dow = (t.getDay() + 6) % 7; // lunes = 0
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow - (weeks - 1) * 7);
    const wild = new Set(wildcards ?? []);
    const cells: Cell[] = [];
    for (let col = 0; col < weeks; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + col * 7 + row);
        const key = dayKeyOf(d);
        const future = key > todayKey;
        const min = future ? 0 : Math.max(0, values[key] ?? 0);
        let level = 0;
        for (const th of thresholds) if (min >= th && min > 0) level++;
        cells.push({ key, col, row, min, level, future, today: key === todayKey, wildcard: wild.has(key) });
      }
    }
    const totals = Array.from({ length: weeks }, (_, c) => cells.slice(c * 7, c * 7 + 7).reduce((s, x) => s + x.min, 0));
    const months: Array<{ col: number; label: string }> = [];
    for (let c = 0; c < weeks; c++) {
      const first = toDate(cells[c * 7].key);
      const prev = c > 0 ? toDate(cells[(c - 1) * 7].key) : null;
      if (!prev || prev.getMonth() !== first.getMonth()) {
        if (!months.length || c - months[months.length - 1].col >= 3) months.push({ col: c, label: month(first, "short") });
      }
    }
    const done = cells.filter((x) => !x.future);
    return {
      cells,
      totals,
      months,
      lastIndex: cells.findIndex((x) => x.today),
      activeDays: done.filter((x) => x.min > 0).length,
      total: done.reduce((s, x) => s + x.min, 0),
    };
  }, [values, weeks, todayKey, wildcards, thresholds]);

  const W = X0 + weeks * P + 4;
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const svgW = Math.min(entry.contentRect.width, 560);
      if (svgW > 0) setScale(svgW / W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);
  const fs = (base: number) => Math.max(base, (base + 1.5) / Math.max(scale, 0.01)); // ≥ 11–12 px en pantalla
  const gridBottom = Y0 + 7 * P;
  const H = gridBottom + (weekTotals ? 50 : 4);
  const maxWeek = Math.max(1, ...data.totals);
  const bestWeek = data.totals.indexOf(Math.max(...data.totals));
  const cx0 = (c: number) => X0 + c * P + P / 2;
  const cy0 = (r: number) => Y0 + r * P + P / 2;

  const describe = (cell: Cell) => {
    const when = cell.today ? `Hoy, ${dateShort(cell.key)}` : capitalize(dateShort(cell.key));
    if (cell.wildcard && cell.min === 0) return `${when} · comodín: la racha sigue`;
    return `${when} · ${cell.min > 0 ? minutes(cell.min) : "sin estudio"}`;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    const col = Math.floor((x - X0) / P);
    const row = Math.floor((y - Y0) / P);
    if (col < 0 || col >= weeks || row < 0 || row > 6) return setActive(null);
    const idx = col * 7 + row;
    setKeyboard(false);
    setActive(data.cells[idx]?.future ? null : idx);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const cur = active ?? data.lastIndex;
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (e.key === "Escape") return setActive(null);
    if (step == null) return;
    e.preventDefault();
    setKeyboard(true);
    setActive(Math.min(data.lastIndex, Math.max(0, cur + step)));
  };

  const act = active != null ? data.cells[active] : null;
  const summary =
    aria["aria-label"] ??
    `Actividad de las últimas ${weeks} semanas: ${num(data.activeDays)} días con estudio, ${minutes(data.total)} en total. Usa las flechas para recorrer los días.`;

  return (
    <div className={cx("ui-heat", className)}>
      <div className="ui-heat-frame" ref={frameRef}>
        <svg
          className="ui-heat-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label={summary}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onFocus={(e) => {
            if (active == null && e.currentTarget.matches(":focus-visible")) {
              setKeyboard(true);
              setActive(data.lastIndex);
            }
          }}
          onBlur={() => setActive(null)}
        >
          {data.months.map((m) => (
            <text key={m.col} className="ui-heat-month" x={X0 + m.col * P + 2} y={13} fontSize={fs(10)}>
              {m.label}
            </text>
          ))}
          {DAY_LETTERS.map(([r, l]) => (
            <text key={l} className="ui-heat-day" x={2} y={cy0(r) + 3.5} fontSize={fs(9.5)}>
              {l}
            </text>
          ))}

          {data.cells.map((cell, i) => {
            const x = cx0(cell.col);
            const y = cy0(cell.row);
            if (cell.future) return <circle key={cell.key} cx={x} cy={y} r={1} className="ui-heat-future" />;
            if (cell.wildcard && cell.min === 0)
              return <svg key={cell.key} x={x - 6.5} y={y - 6.5} width={13} height={13} viewBox="0 0 24 24" className="ui-heat-moon"><path d={MOON} /></svg>;
            return (
              <g key={cell.key}>
                <circle cx={x} cy={y} r={RADII[cell.level]} className={`ui-heat-l${cell.level}`} />
                {cell.today && <circle cx={x} cy={y} r={7.4} className="ui-heat-today" />}
                {active === i && <circle cx={x} cy={y} r={9.2} className="ui-heat-cursor" />}
              </g>
            );
          })}
          {act?.wildcard && act.min === 0 && <circle cx={cx0(act.col)} cy={cy0(act.row)} r={9.2} className="ui-heat-cursor" />}

          {weekTotals && (
            <g className="ui-heat-weeks">
              <text className="ui-heat-day" x={2} y={H - 5} fontSize={fs(9.5)}>
                h
              </text>
              <line x1={X0} x2={W - 4} y1={H - 8.5} y2={H - 8.5} className="ui-heat-base" />
              {data.totals.map((v, c) => {
                const h = v > 0 ? Math.max(1.5, (v / maxWeek) * 30) : 0;
                const current = c === weeks - 1;
                return (
                  <g key={c}>
                    {h > 0 && (
                      <rect
                        x={cx0(c) - 5}
                        y={H - 9 - h}
                        width={10}
                        height={h}
                        rx={1.5}
                        className={current ? "ui-heat-wk-now" : c === bestWeek ? "ui-heat-wk-best" : "ui-heat-wk"}
                      />
                    )}
                    {c === bestWeek && v > 0 && (
                      <text className="ui-heat-wk-label" x={cx0(c)} y={H - 13 - h} textAnchor="middle" fontSize={fs(9.5)}>
                        {Math.round(v / 60)} h
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </svg>
        {act && (
          <span
            className="ui-heat-tip"
            style={{ left: `${(cx0(act.col) / W) * 100}%`, top: `${(cy0(act.row) / H) * 100}%` }}
            aria-hidden="true"
          >
            {describe(act)}
          </span>
        )}
        <span className="sr-only" aria-live="polite">
          {keyboard && act ? describe(act) : ""}
        </span>
      </div>

      {legend && (
        <div className="ui-heat-legend" aria-hidden="true">
          <span>Menos</span>
          <svg viewBox="0 0 76 14" width="76" height="14">
            {[1, 2, 3, 4, 5].map((l, i) => (
              <circle key={l} cx={7 + i * 15.5} cy={7} r={RADII[l]} className={`ui-heat-l${l}`} />
            ))}
          </svg>
          <span>Más</span>
          <i className="ui-heat-sep" />
          <svg viewBox="0 0 24 24" width="13" height="13" className="ui-heat-moon">
            <path d={MOON} />
          </svg>
          <span>Comodín</span>
          <i className="ui-heat-sep" />
          <svg viewBox="0 0 16 16" width="13" height="13">
            <circle cx="8" cy="8" r="6" className="ui-heat-today" />
          </svg>
          <span>Hoy</span>
        </div>
      )}
    </div>
  );
}
