import type { CSSProperties } from "react";
import { cx } from "./cx";
import { pct } from "./format";

export type FreshnessBand = "none" | "fresca" | "buena" | "tibia" | "fria";

export type FreshnessInfo = { band: FreshnessBand; label: string; bars: 0 | 1 | 2 | 3 | 4 };

/** Tramos de frescura (recuperabilidad R): fresca ≥ 0,9 · buena ≥ 0,8 · tibia ≥ 0,65 · fría. */
export function freshnessBand(r: number | null | undefined): FreshnessInfo {
  if (r == null || Number.isNaN(r)) return { band: "none", label: "sin ver", bars: 0 };
  if (r >= 0.9) return { band: "fresca", label: "fresca", bars: 4 };
  if (r >= 0.8) return { band: "buena", label: "buena", bars: 3 };
  if (r >= 0.65) return { band: "tibia", label: "tibia", bars: 2 };
  return { band: "fria", label: "fría", bars: 1 };
}

export type FreshnessProps = {
  /** Recuperabilidad actual 0–1; null si aún no hay repasos. */
  r: number | null;
  /**
   * signal: 4 barras de cobertura + adjetivo en cursiva ·
   * track: barra fina dorada (escarcha si se enfría) + porcentaje, como la cola de la maqueta.
   */
  variant?: "signal" | "track";
  /** Adjetivo (fresca/buena/tibia/fría). Por defecto sí en signal. */
  showLabel?: boolean;
  /** Porcentaje. Por defecto sí en track. */
  showPct?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/** Frescura de un recuerdo: brilla dorada cuando está fresca y se vuelve escarcha al enfriarse. */
export function Freshness({ r, variant = "signal", showLabel, showPct, size = "md", className }: FreshnessProps) {
  const info = freshnessBand(r);
  const aria = info.band === "none" ? "Frescura: sin ver" : `Frescura ${pct(r)}: ${info.label}`;
  const labelOn = showLabel ?? variant === "signal";
  const pctOn = showPct ?? variant === "track";

  if (variant === "track") {
    const style = { "--v": `${Math.round((r ?? 0) * 100)}%` } as CSSProperties;
    return (
      <span className={cx("ui-fresh-track", `ui-fresh--${info.band}`, `ui-fresh--${size}`, className)} role="img" aria-label={aria} title={aria}>
        {info.band === "none" ? (
          <span className="ui-fresh-none" aria-hidden="true">sin ver</span>
        ) : (
          <>
            <span className="ui-fresh-rail" aria-hidden="true">
              <b style={style} />
            </span>
            {pctOn && <span className="ui-fresh-pct num" aria-hidden="true">{pct(r)}</span>}
            {labelOn && <em className="ui-fresh-word" aria-hidden="true">{info.label}</em>}
          </>
        )}
      </span>
    );
  }

  return (
    <span className={cx("ui-fresh", `ui-fresh--${info.band}`, `ui-fresh--${size}`, className)} role="img" aria-label={aria} title={aria}>
      <span className="ui-fresh-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className={i <= info.bars ? "is-on" : undefined} />
        ))}
      </span>
      {pctOn && info.band !== "none" && <span className="ui-fresh-pct num" aria-hidden="true">{pct(r)}</span>}
      {labelOn && <em className="ui-fresh-word" aria-hidden="true">{info.label}</em>}
    </span>
  );
}
