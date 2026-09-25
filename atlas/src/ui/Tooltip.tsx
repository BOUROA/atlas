import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react";
import { cx } from "./cx";

export type TooltipProps = {
  /** Texto de ayuda. Se enlaza al hijo con aria-describedby. */
  content: ReactNode;
  /** Un único elemento enfocable (botón, enlace…). */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  align?: "center" | "start" | "end";
  className?: string;
};

/**
 * Tooltip sencillo en CSS: aparece al pasar el ratón o al enfocar con teclado y
 * se cierra con Esc. Para botones de icono basta con IconButton (ya lo trae).
 */
export function Tooltip({ content, children, side = "top", align = "center", className }: TooltipProps) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  const described = [children.props["aria-describedby"], id].filter(Boolean).join(" ");
  return (
    <span
      className={cx("ui-tip-anchor", className)}
      data-dismissed={dismissed || undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !dismissed) {
          setDismissed(true);
          e.stopPropagation();
        }
      }}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {isValidElement(children) ? cloneElement(children, { "aria-describedby": described }) : children}
      <span role="tooltip" id={id} className={cx("ui-tip", `ui-tip--${side}`, `ui-tip--${align}`)}>
        {content}
      </span>
    </span>
  );
}
