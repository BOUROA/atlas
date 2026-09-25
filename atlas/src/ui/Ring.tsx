import type { CSSProperties, ReactNode } from "react";
import { clamp, cx } from "./cx";
import { pct } from "./format";
import { subjectColor } from "./subjects";

export type RingTone = "auto" | "gold" | "star" | "frost" | "ember" | "subject";

export type RingProps = {
  /** Proporción 0–1. */
  value: number;
  /** Diámetro en px (por defecto 44). */
  size?: number;
  /** Grosor del arco en px; por defecto proporcional al tamaño. */
  thickness?: number;
  /** Contenido central; por defecto el porcentaje. null para vaciarlo. */
  label?: ReactNode;
  /**
   * Color del arco. auto: según el valor (< 50 % ascua · < 80 % dorado · ≥ 80 % luz de estrella).
   */
  tone?: RingTone;
  subjectId?: string;
  /** Color CSS explícito (tiene prioridad). */
  color?: string;
  /** Nombre accesible completo ("Preparación prevista: 64 %"). */
  "aria-label"?: string;
  /** Anima el arco al aparecer (por defecto sí). */
  animate?: boolean;
  className?: string;
};

function autoTone(v: number): Exclude<RingTone, "auto" | "subject"> {
  if (v < 0.5) return "ember";
  if (v < 0.8) return "gold";
  return "star";
}

/** Anillo de progreso (preparación, dominio). El número va dentro. */
export function Ring({
  value,
  size = 44,
  thickness,
  label,
  tone = "auto",
  subjectId,
  color,
  animate = true,
  className,
  ...aria
}: RingProps) {
  const v = clamp(Number.isFinite(value) ? value : 0, 0, 1);
  const t = thickness ?? Math.max(2.5, Math.round(size * 0.08 * 10) / 10);
  const r = 50 - (t / size) * 50 - 0.5;
  const resolvedTone = tone === "auto" ? autoTone(v) : tone;
  const arcColor =
    color ?? (resolvedTone === "subject" && subjectId ? subjectColor(subjectId) : `var(--ring-${resolvedTone === "subject" ? "gold" : resolvedTone})`);
  const style = {
    "--ring-size": `${size}px`,
    "--ring-c": arcColor,
    "--ring-font": `${Math.max(10, Math.round(size * 0.26))}px`,
  } as CSSProperties;
  const big = size >= 64;
  const pctNum = Math.round(v * 100);
  const center =
    label === undefined ? (
      <span className="ui-ring-value num">
        {pctNum}
        <small>%</small>
      </span>
    ) : (
      label
    );
  return (
    <span
      className={cx("ui-ring", big && "ui-ring--big", className)}
      style={style}
      role="img"
      aria-label={aria["aria-label"] ?? pct(v)}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="ui-ring-track" cx="50" cy="50" r={r} strokeWidth={(t / size) * 100} />
        {v > 0 && (
          <circle
            className={cx("ui-ring-arc", animate && "ui-ring-arc--in")}
            cx="50"
            cy="50"
            r={r}
            strokeWidth={(t / size) * 100}
            pathLength={100}
            strokeDasharray={`${v * 100} 100`}
          />
        )}
      </svg>
      {center != null && (
        <span className="ui-ring-center" aria-hidden="true">
          {center}
        </span>
      )}
    </span>
  );
}
