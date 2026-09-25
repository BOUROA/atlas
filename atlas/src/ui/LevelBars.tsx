import type { CSSProperties } from "react";
import { cx } from "./cx";
import { subjectColor } from "./subjects";

export type LevelValue = 0 | 1 | 2 | 3;

export const LEVEL_NAMES: Record<LevelValue, string> = {
  0: "Sin ver",
  1: "Visto",
  2: "Lo entiendo",
  3: "Lo domino",
};

export type LevelBarsProps = {
  level: LevelValue;
  /** Colorea los rombos con la asignatura; sin ella, luz de estrella. */
  subjectId?: string;
  /** Se está enfriando: los rombos pasan a escarcha. */
  cooling?: boolean;
  /** Texto al lado: "2/3" (fraction) o el nombre del nivel (name). */
  showLabel?: false | "fraction" | "name";
  size?: "sm" | "md";
  className?: string;
};

/** Dominio 0–3 como tres rombos que se encienden (nunca solo color: se ve cuántos). */
export function LevelBars({ level, subjectId, cooling, showLabel = false, size = "md", className }: LevelBarsProps) {
  const style = (subjectId && !cooling ? { "--lv-c": subjectColor(subjectId) } : undefined) as CSSProperties | undefined;
  const aria = `Dominio: ${LEVEL_NAMES[level]} (${level} de 3)${cooling ? ", se está enfriando" : ""}`;
  return (
    <span
      className={cx("ui-level", `ui-level--${size}`, cooling && "ui-level--cooling", subjectId && "ui-level--subject", className)}
      style={style}
      role="img"
      aria-label={aria}
      title={aria}
    >
      <span className="ui-level-pips" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= level ? "is-on" : undefined} />
        ))}
      </span>
      {showLabel === "fraction" && <span className="ui-level-label num" aria-hidden="true">{level}/3</span>}
      {showLabel === "name" && <span className="ui-level-label ui-level-label--name" aria-hidden="true">{LEVEL_NAMES[level]}</span>}
    </span>
  );
}
