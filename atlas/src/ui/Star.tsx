import { type CSSProperties, type SVGProps } from "react";
import { useSvgId } from "./hooks";
import { cx } from "./cx";
import { subjectColor } from "./subjects";

/** Estados de una estrella (concepto) en la carta celeste. */
export type StarState = "unseen" | "seen" | "understood" | "mastered" | "cooling" | "today" | "locked" | "next";

export const STAR_STATE_LABELS: Record<StarState, string> = {
  unseen: "Sin ver",
  seen: "Vista",
  understood: "La entiendes",
  mastered: "La dominas",
  cooling: "Se está enfriando",
  today: "En la sesión de hoy",
  locked: "Bloqueada: le faltan requisitos",
  next: "Siguiente",
};

const DEFAULT_TAGS: Partial<Record<StarState, string>> = { today: "HOY", next: "SIGUIENTE" };

/**
 * Degradados compartidos por las estrellas de un mismo <svg>. En la carta celeste
 * se pinta una vez (<StarDefs id="carta" />) y cada <StarMark defsId="carta" /> lo usa.
 */
export function StarDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-warm`}>
        <stop offset="0" style={{ stopColor: "var(--star-halo)", stopOpacity: 0.9 }} />
        <stop offset=".28" style={{ stopColor: "var(--gold)", stopOpacity: 0.3 }} />
        <stop offset="1" style={{ stopColor: "var(--gold)", stopOpacity: 0 }} />
      </radialGradient>
      <radialGradient id={`${id}-cool`}>
        <stop offset="0" style={{ stopColor: "var(--frost-fg)", stopOpacity: 0.6 }} />
        <stop offset="1" style={{ stopColor: "var(--frost)", stopOpacity: 0 }} />
      </radialGradient>
    </defs>
  );
}

const tagWidth = (text: string) => Math.round(text.length * 5.7 + 12);

export type StarMarkProps = Omit<SVGProps<SVGGElement>, "color"> & {
  state: StarState;
  /** Id de los degradados (<StarDefs id=…/>) en el mismo <svg>. */
  defsId: string;
  x?: number;
  y?: number;
  /** Escala del glifo (1 ≈ núcleo de 3,5 px y halo de 17 px). */
  scale?: number;
  /** Color de la asignatura para los estados que lo usan (visto, siguiente). */
  subjectId?: string;
  color?: string;
  /** Etiqueta HOY / SIGUIENTE (por defecto en esos estados). false la oculta; un texto la sustituye. */
  tag?: boolean | string;
  tagPlacement?: "below" | "above";
};

/** Estrella como grupo SVG, para colocarla dentro de otro <svg> (carta celeste, leyendas). */
export function StarMark({
  state,
  defsId,
  x = 0,
  y = 0,
  scale = 1,
  subjectId,
  color,
  tag,
  tagPlacement = "below",
  className,
  style,
  ...rest
}: StarMarkProps) {
  const c = color ?? (subjectId ? subjectColor(subjectId) : "var(--text-3)");
  const tagText = tag === false ? null : typeof tag === "string" ? tag : tag === true || tag === undefined ? DEFAULT_TAGS[state] ?? null : null;
  const transform = `translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ""}`;
  const warm = `url(#${defsId}-warm)`;
  const cool = `url(#${defsId}-cool)`;
  return (
    <g
      transform={transform}
      className={cx("ui-star", `ui-star--${state}`, className)}
      style={{ ...style, "--c": c } as CSSProperties}
      {...rest}
    >
      {state === "unseen" && <circle className="ui-star-hollow" r="3.1" />}

      {state === "seen" && (
        <>
          <circle className="ui-star-seen-ring" r="5.2" />
          <circle className="ui-star-seen" r="2.9" />
        </>
      )}

      {state === "understood" && (
        <>
          <circle className="ui-star-glow" r="12.5" fill={warm} />
          <path className="ui-star-spikes" d="M-8 0H8M0-8V8" />
          <circle className="ui-star-core" r="3.6" />
        </>
      )}

      {state === "mastered" && (
        <g className="ui-star-twinkle">
          <circle className="ui-star-glow" r="17" fill={warm} />
          <circle className="ui-star-halo" r="8.2" />
          <path className="ui-star-flare" d="M0-15 1.25-1.25 15 0 1.25 1.25 0 15-1.25 1.25-15 0-1.25-1.25Z" />
          <path className="ui-star-flare ui-star-flare--minor" d="M-6.5-6.5.8-.8 6.5-6.5.8.8 6.5 6.5-.8.8-6.5 6.5-.8-.8Z" />
          <circle className="ui-star-core" r="4.4" />
        </g>
      )}

      {state === "cooling" && (
        <>
          <circle className="ui-star-glow" r="12" fill={cool} />
          <circle className="ui-star-frost-ring" r="7" />
          <circle className="ui-star-frost-core" r="3.4" />
        </>
      )}

      {state === "today" && (
        <>
          <circle className="ui-star-pulse" r="9" />
          <circle className="ui-star-spin" r="12" />
          <g className="ui-star-twinkle">
            <circle className="ui-star-today-disc" r="7" />
            <circle className="ui-star-today-core" r="3.4" />
          </g>
        </>
      )}

      {state === "locked" && (
        <>
          <circle className="ui-star-locked-ring" r="5.6" />
          <rect className="ui-star-lock" x="-2.3" y="-.7" width="4.6" height="3.6" rx=".8" />
          <path className="ui-star-shackle" d="M-1.45-.7V-2a1.45 1.45 0 0 1 2.9 0v1.3" />
        </>
      )}

      {state === "next" && (
        <>
          <circle className="ui-star-next-ring" r="7" />
          <circle className="ui-star-seen" r="2.9" />
        </>
      )}

      {tagText && (
        <g className={cx("ui-star-tag", state === "today" ? "ui-star-tag--solid" : "ui-star-tag--line")} transform={`translate(0 ${tagPlacement === "below" ? 19 : -19})`}>
          <rect x={-tagWidth(tagText) / 2} y="-6.5" width={tagWidth(tagText)} height="13" rx="6.5" />
          <text y="3" textAnchor="middle">
            {tagText}
          </text>
        </g>
      )}
    </g>
  );
}

export type StarProps = {
  state: StarState;
  /** Tamaño en px del recuadro del glifo (por defecto 28; el halo sobresale un poco). */
  size?: number;
  subjectId?: string;
  color?: string;
  /** Etiqueta HOY / SIGUIENTE. Por defecto oculta en la estrella suelta. */
  tag?: boolean | string;
  /** Nombre accesible; sin él la estrella es decorativa. */
  title?: string;
  className?: string;
};

/** Estrella suelta (leyendas, listas, chips). Para la carta celeste usa StarDefs + StarMark. */
export function Star({ state, size = 28, subjectId, color, tag = false, title, className }: StarProps) {
  const id = useSvgId("st");
  const tagText = tag === false ? null : typeof tag === "string" ? tag : DEFAULT_TAGS[state] ?? null;
  // recuadro de 30 unidades: el halo (r 17) desborda a propósito (overflow visible)
  const box = 30;
  const w = tagText ? Math.max(box, tagWidth(tagText) + 4) : box;
  const h = tagText ? box + 12 : box;
  return (
    <svg
      className={cx("ui-star-svg", className)}
      viewBox={`${-w / 2} ${-box / 2} ${w} ${h}`}
      width={(size * w) / box}
      height={(size * h) / box}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <StarDefs id={id} />
      <StarMark state={state} defsId={id} subjectId={subjectId} color={color} tag={tagText ?? false} />
    </svg>
  );
}
