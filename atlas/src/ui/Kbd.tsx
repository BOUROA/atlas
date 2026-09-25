import type { ReactNode } from "react";
import { cx } from "./cx";

export type KbdProps = {
  /** Una tecla (children) o una combinación (keys), p. ej. ["Ctrl", "K"]. */
  children?: ReactNode;
  keys?: string[];
  className?: string;
};

/** Tecla de atajo. Con `keys` pinta la combinación separada por un espacio fino. */
export function Kbd({ children, keys, className }: KbdProps) {
  if (keys && keys.length > 0) {
    return (
      <span className={cx("ui-kbd-group", className)}>
        {keys.map((k) => (
          <kbd key={k} className="ui-kbd">
            {k}
          </kbd>
        ))}
      </span>
    );
  }
  return <kbd className={cx("ui-kbd", className)}>{children}</kbd>;
}
