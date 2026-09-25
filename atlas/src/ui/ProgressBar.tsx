import type { CSSProperties, ReactNode } from "react";
import { clamp, cx } from "./cx";
import { num } from "./format";
import { subjectColor } from "./subjects";

export type ProgressTone = "gold" | "star" | "frost" | "ember" | "subject";

export type ProgressBarProps = {
  /** Valor alcanzado (incluye lo ganado hoy). */
  value: number;
  /** Máximo (por defecto 1). */
  max?: number;
  /** Parte de `value` ganada hoy: se pinta como tramo más brillante al final del relleno. */
  today?: number;
  /** Previsión (p. ej. XP de la sesión de hoy): rayado dorado claro a continuación. */
  preview?: number;
  /** xs 3 px · sm 4 px · md 6 px · lg 10 px (barra de XP). */
  size?: "xs" | "sm" | "md" | "lg";
  tone?: ProgressTone;
  subjectId?: string;
  /** Color CSS explícito para el relleno. */
  color?: string;
  /** Burbuja al final de la barra (p. ej. el siguiente nivel, "8"). */
  cap?: ReactNode;
  /** Nombre accesible ("XP del nivel 7"). */
  label: string;
  /** Texto accesible del valor; por defecto "value de max". */
  valueText?: string;
  className?: string;
};

/** Barra de progreso con tramo de hoy y previsión rayada. */
export function ProgressBar({
  value,
  max = 1,
  today = 0,
  preview = 0,
  size = "sm",
  tone = "gold",
  subjectId,
  color,
  cap,
  label,
  valueText,
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const fill = clamp(value / safeMax, 0, 1);
  const todayFrac = clamp(today / safeMax, 0, fill);
  const previewFrac = clamp(preview / safeMax, 0, 1 - fill);
  const c = color ?? (tone === "subject" && subjectId ? subjectColor(subjectId) : undefined);
  const style = {
    "--bar-fill": `${fill * 100}%`,
    "--bar-today": `${todayFrac * 100}%`,
    "--bar-preview": `${previewFrac * 100}%`,
    ...(c ? { "--bar-c": c } : null),
  } as CSSProperties;
  return (
    <div
      className={cx("ui-bar", `ui-bar--${size}`, `ui-bar--${c ? "custom" : tone}`, cap != null && "ui-bar--capped", className)}
      style={style}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamp(value, 0, safeMax)}
      aria-valuetext={valueText ?? `${num(value)} de ${num(safeMax)}`}
    >
      {previewFrac > 0 && <span className="ui-bar-preview" aria-hidden="true" />}
      {fill > 0 && <span className="ui-bar-fill" aria-hidden="true" />}
      {todayFrac > 0 && <span className="ui-bar-today" aria-hidden="true" />}
      {fill > 0 && size === "lg" && <span className="ui-bar-cursor" aria-hidden="true" />}
      {cap != null && (
        <span className="ui-bar-cap num" aria-hidden="true">
          {cap}
        </span>
      )}
    </div>
  );
}
