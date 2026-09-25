import { createElement, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "./cx";

type BlockTag = "div" | "section" | "article" | "aside" | "li" | "header" | "footer";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: BlockTag;
  /** default: vidrio nocturno · glow: con resplandor dorado arriba · dashed: hueco por llenar · flat: sin sombra */
  tone?: "default" | "glow" | "dashed" | "flat";
  pad?: "none" | "sm" | "md" | "lg";
  /** Realza al pasar el ratón (para tarjetas que son un enlace o botón completo). */
  interactive?: boolean;
  ref?: Ref<HTMLElement>;
};

/** Tarjeta base: superficie --ink-2, borde --line, radio 20 y brillo interior sutil. */
export function Card({ as = "div", tone = "default", pad = "md", interactive, className, ref, ...rest }: CardProps) {
  return createElement(as, {
    ref,
    ...rest,
    className: cx("ui-card", `ui-card--${tone}`, `ui-pad--${pad}`, interactive && "ui-card--interactive", className),
  });
}

export type InkCardProps = HTMLAttributes<HTMLElement> & {
  as?: BlockTag;
  pad?: "none" | "sm" | "md" | "lg";
  /** Gratícula celeste de fondo (círculos y meridianos finos). Por defecto sí. */
  graticule?: boolean;
  ref?: Ref<HTMLElement>;
};

/**
 * Tarjeta protagonista (p. ej. «Sesión de hoy»): cielo más profundo, borde dorado
 * tenue y gratícula. Una por pantalla.
 */
export function InkCard({ as = "section", pad = "lg", graticule = true, className, children, ref, ...rest }: InkCardProps) {
  return createElement(
    as,
    { ref, ...rest, className: cx("ui-card", "ui-hero", `ui-pad--${pad}`, className) },
    graticule ? <HeroGraticule /> : null,
    <div className="ui-hero-body">{children}</div>,
  );
}

function HeroGraticule() {
  return (
    <svg className="ui-hero-grat" viewBox="0 0 880 340" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" className="ui-hero-grat-lines">
        <ellipse cx="760" cy="170" rx="330" ry="330" />
        <ellipse cx="760" cy="170" rx="250" ry="250" />
        <ellipse cx="760" cy="170" rx="170" ry="170" strokeDasharray="2 6" />
        <ellipse cx="760" cy="170" rx="330" ry="120" />
        <ellipse cx="760" cy="170" rx="330" ry="220" strokeDasharray="1 5" />
        <path d="M430 170H1100M760 -170V510M527 -63L993 403M527 403L993 -63" />
      </g>
      <g className="ui-hero-grat-stars">
        <circle cx="700" cy="304" r="1.1" opacity=".7" />
        <circle cx="512" cy="300" r=".9" opacity=".5" />
        <circle cx="860" cy="40" r="1.3" opacity=".8" />
        <circle cx="410" cy="250" r=".8" opacity=".5" />
        <circle cx="640" cy="318" r="1" opacity=".6" />
        <circle cx="360" cy="30" r=".8" opacity=".45" />
        <circle cx="270" cy="318" r=".9" opacity=".4" />
        <circle cx="560" cy="130" r=".8" opacity=".45" />
      </g>
    </svg>
  );
}

export type HeroNumberProps = {
  value: ReactNode;
  /** Etiqueta en negrita bajo la cifra ("repasos"). */
  label: ReactNode;
  /** Aclaración en gris ("9 se están enfriando"). */
  sub?: ReactNode;
  /** Cifra dorada con brillo (lo nuevo, lo que se enciende hoy). */
  accent?: boolean;
  size?: "md" | "lg";
  className?: string;
};

/** Cifra enorme en serif para la tarjeta protagonista. */
export function HeroNumber({ value, label, sub, accent, size = "lg", className }: HeroNumberProps) {
  return (
    <div className={cx("ui-heronum", `ui-heronum--${size}`, accent && "ui-heronum--accent", className)}>
      <div className="ui-heronum-value num">{value}</div>
      <div className="ui-heronum-label">
        <b>{label}</b>
        {sub != null && <span>{sub}</span>}
      </div>
    </div>
  );
}
