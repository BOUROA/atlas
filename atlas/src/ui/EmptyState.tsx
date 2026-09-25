import { type ReactNode } from "react";
import { useSvgId } from "./hooks";
import { cx } from "./cx";
import { StarDefs, StarMark } from "./Star";

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Botón o enlace para empezar. */
  action?: ReactNode;
  /** Sustituye la constelación por un icono propio. */
  icon?: ReactNode;
  size?: "sm" | "md";
  /** dashed: recuadro punteado (hueco por llenar dentro de una tarjeta). */
  tone?: "plain" | "dashed";
  className?: string;
};

/** Estado vacío con una pequeña constelación por descubrir. */
export function EmptyState({ title, description, action, icon, size = "md", tone = "plain", className }: EmptyStateProps) {
  return (
    <div className={cx("ui-empty", `ui-empty--${size}`, `ui-empty--${tone}`, className)}>
      <div className="ui-empty-art" aria-hidden="true">
        {icon ?? <EmptySky />}
      </div>
      <p className="ui-empty-title">{title}</p>
      {description != null && <p className="ui-empty-desc">{description}</p>}
      {action != null && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}

function EmptySky() {
  const id = useSvgId("es");
  return (
    <svg viewBox="0 0 150 76" width="150" height="76" focusable="false">
      <StarDefs id={id} />
      <g className="ui-empty-lines" fill="none">
        <path d="M22 50 58 28 92 40" />
        <path d="M92 40 128 22" strokeDasharray="2 4" />
        <path d="M58 28 70 62" strokeDasharray="2 4" />
      </g>
      <StarMark defsId={id} state="understood" x={22} y={50} scale={0.8} />
      <StarMark defsId={id} state="mastered" x={58} y={28} scale={0.75} />
      <StarMark defsId={id} state="seen" x={92} y={40} color="var(--gold)" />
      <StarMark defsId={id} state="unseen" x={128} y={22} />
      <StarMark defsId={id} state="unseen" x={70} y={62} />
    </svg>
  );
}
