import type { CSSProperties } from "react";
import { cx } from "./cx";
import { num } from "./format";
import { subjectColor } from "./subjects";

export type BarSegment = {
  value: number;
  label: string;
  /** Color CSS; si no, el de `subjectId`. */
  color?: string;
  subjectId?: string;
  /** hatch: tramo rayado (pausas, huecos). */
  pattern?: "solid" | "hatch";
  id?: string;
};

export type SegmentedBarProps = {
  segments: BarSegment[];
  /** Altura en px (por defecto 7). */
  height?: number;
  /** Leyenda bajo la barra: punto + nombre + valor. */
  legend?: boolean;
  /** Formato del valor en leyenda y títulos (por defecto número). */
  format?: (v: number) => string;
  /** Resumen accesible; por defecto se compone con las etiquetas. */
  "aria-label"?: string;
  /** Resalta un segmento (p. ej. la asignatura más descuidada) con un anillo. */
  highlight?: string;
  className?: string;
};

/** Barra partida en tramos proporcionales (reparto por asignatura, plan de sesión). */
export function SegmentedBar({ segments, height = 7, legend = true, format = (v) => num(v), highlight, className, ...aria }: SegmentedBarProps) {
  const shown = segments.filter((s) => s.value > 0);
  const summary = aria["aria-label"] ?? shown.map((s) => `${s.label}: ${format(s.value)}`).join(" · ");
  return (
    <div className={cx("ui-segbar", className)} style={{ "--h": `${height}px` } as CSSProperties}>
      <div className="ui-segbar-track" role="img" aria-label={summary}>
        {shown.map((s, i) => {
          const key = s.id ?? `${s.label}-${i}`;
          const style = {
            "--v": s.value,
            "--c": s.color ?? (s.subjectId ? subjectColor(s.subjectId) : "var(--text-3)"),
          } as CSSProperties;
          return (
            <i
              key={key}
              style={style}
              title={`${s.label} · ${format(s.value)}`}
              className={cx(s.pattern === "hatch" && "is-hatch", highlight != null && highlight === (s.id ?? s.subjectId) && "is-highlight")}
            />
          );
        })}
      </div>
      {legend && (
        <ul className="ui-segbar-legend" aria-hidden="true">
          {shown.map((s, i) => (
            <li key={s.id ?? `${s.label}-${i}`} style={{ "--c": s.color ?? (s.subjectId ? subjectColor(s.subjectId) : "var(--text-3)") } as CSSProperties}>
              <span className={cx("ui-segbar-dot", s.pattern === "hatch" && "is-hatch")} />
              {s.label}
              <em className="num">{format(s.value)}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
