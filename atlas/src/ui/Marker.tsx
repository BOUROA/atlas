import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import { subjectColor } from "./subjects";

export type MarkerProps = {
  children: ReactNode;
  /**
   * underline: subrayado dorado suave que se desvanece en los extremos ·
   * glow: palabra en oro con un resplandor tenue (titulares).
   * Úsalo con moderación: una palabra clave por bloque.
   */
  variant?: "underline" | "glow";
  /** Subrayado del color de la asignatura en vez de oro. */
  subjectId?: string;
  color?: string;
  /** Dibuja el subrayado al aparecer. */
  animate?: boolean;
  className?: string;
};

/** Realce de una palabra clave: subrayado dorado suave o brillo. */
export function Marker({ children, variant = "underline", subjectId, color, animate, className }: MarkerProps) {
  const c = color ?? (subjectId ? subjectColor(subjectId) : undefined);
  const style = c ? ({ "--mk": c } as CSSProperties) : undefined;
  return (
    <span className={cx("ui-marker", `ui-marker--${variant}`, animate && "ui-marker--animate", className)} style={style}>
      {children}
    </span>
  );
}
