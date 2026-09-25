import { type CSSProperties, type ReactNode } from "react";
import { clamp, cx } from "./cx";
import { useSvgId } from "./hooks";
import { pct } from "./format";
import { subjectColor, subjectFg } from "./subjects";

export type BadgeProps = {
  /** Nombre de la insignia ("Doce noches"). */
  label: string;
  /** Condición o detalle ("12 días seguidos"). */
  sublabel?: ReactNode;
  /** Línea dorada en mono (fecha: "AYER", "21 SEP"). */
  meta?: ReactNode;
  /** Icono lineal (lucide) en el centro. */
  icon?: ReactNode;
  /** Alternativa al icono: iniciales en serif (estrellas guía). */
  monogram?: string;
  /** Color del medallón; por defecto oro. */
  color?: string;
  /** Atajo: medallón del color de la asignatura. */
  subjectId?: string;
  /** Aún no conseguida: trazo tenue, sin brillo y candado en el limbo. */
  locked?: boolean;
  /** 0–1: arco de progreso en el limbo (próxima insignia). */
  progress?: number;
  /** Diámetro del medallón en px (por defecto 64). */
  size?: number;
  /** Pie con nombre y detalle bajo el medallón (por defecto sí). */
  caption?: boolean;
  /** Texto grabado en el limbo superior (solo se pinta con size ≥ 96). */
  engraving?: string;
  /** Aparición con destello (para celebraciones). */
  celebrate?: boolean;
  className?: string;
};

// Marcas de reloj astronómico: 72 menores (cada 5°) y 12 mayores (cada 30°).
const MINOR_DASH = ".7 4.3";
const MAJOR_DASH = "1.4 28.6";

/** Cuerpo del grabado para que quepa en el arco de 240° (≈ 170 unidades). */
function engravingSize(text: string): number {
  const fit = (156 / Math.max(1, text.length) - 1.5) / 0.62;
  return Math.max(4.6, Math.min(6.6, Math.round(fit * 10) / 10));
}

/**
 * Insignia (logro): medallón circular con icono lineal dentro de un limbo
 * con marcas de reloj astronómico. Conseguida en oro; bloqueada, apagada.
 */
export function Badge({
  label,
  sublabel,
  meta,
  icon,
  monogram,
  color,
  subjectId,
  locked,
  progress,
  size = 64,
  caption = true,
  engraving,
  celebrate,
  className,
}: BadgeProps) {
  const uid = useSvgId("bd");
  const c = locked ? "var(--text-4)" : color ?? (subjectId ? subjectColor(subjectId) : "var(--gold)");
  const cHi = locked ? "var(--text-3)" : color ?? (subjectId ? subjectFg(subjectId) : "var(--gold-fg)");
  const style = { "--c": c, "--c-hi": cHi, "--size": `${size}px` } as CSSProperties;
  const p = progress == null ? null : clamp(progress, 0, 1);
  const showEngraving = !!engraving && size >= 96;
  const mono = monogram?.slice(0, 3);
  const aria = [label, locked ? "aún no conseguida" : null, p != null && !locked ? `progreso ${pct(p)}` : null]
    .filter(Boolean)
    .join(", ");

  const medal = (
    <svg
      className="ui-badge-medal"
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      role={caption ? undefined : "img"}
      aria-label={caption ? undefined : aria}
      aria-hidden={caption ? true : undefined}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${uid}-disc`} cx=".36" cy=".3" r=".85">
          <stop offset="0" style={{ stopColor: "var(--c)", stopOpacity: 0.16 }} />
          <stop offset=".7" style={{ stopColor: "var(--c)", stopOpacity: 0.02 }} />
          <stop offset="1" style={{ stopColor: "var(--c)", stopOpacity: 0 }} />
        </radialGradient>
        {/* arco superior de 240° (de las 8 a las 4 pasando por las 12) */}
        {showEngraving && <path id={`${uid}-arc`} d="M-35.07 20.25A40.5 40.5 0 1 1 35.07 20.25" />}
      </defs>

      {celebrate && <circle className="ui-badge-flash" r="47" />}

      {/* limbo exterior o arco de progreso */}
      {p == null ? (
        <circle className="ui-badge-limb" r="47.5" />
      ) : (
        <>
          <circle className="ui-badge-track" r="47" />
          {p > 0 && <circle className="ui-badge-progress" r="47" pathLength={100} strokeDasharray={`${p * 100} 100`} transform="rotate(-90)" />}
        </>
      )}

      {/* marcas del reloj */}
      {showEngraving ? (
        <>
          {/* marcas solo en el arco inferior de 120°; arriba va el grabado */}
          <path className="ui-badge-ticks-minor" d="M35.94 20.75A41.5 41.5 0 0 1-35.94 20.75" pathLength={120} strokeDasharray={MINOR_DASH} strokeDashoffset=".35" />
          <path className="ui-badge-ticks-major" d="M35.51 20.5A41 41 0 0 1-35.51 20.5" pathLength={120} strokeDasharray={MAJOR_DASH} strokeDashoffset=".7" />
          <text className="ui-badge-engraving" style={{ fontSize: engravingSize(engraving) }}>
            <textPath href={`#${uid}-arc`} startOffset="50%" textAnchor="middle">
              {engraving}
            </textPath>
          </text>
        </>
      ) : (
        <>
          <circle className="ui-badge-ticks-minor" r="41.5" pathLength={360} strokeDasharray={MINOR_DASH} strokeDashoffset=".35" />
          <circle className="ui-badge-ticks-major" r="41" pathLength={360} strokeDasharray={MAJOR_DASH} strokeDashoffset=".7" />
        </>
      )}
      {!showEngraving && <path className="ui-badge-cardinals" d="M0-46.2 1.5-44.3 0-42.4-1.5-44.3ZM46.2 0 44.3 1.5 42.4 0 44.3-1.5ZM0 46.2-1.5 44.3 0 42.4 1.5 44.3ZM-46.2 0-44.3-1.5-42.4 0-44.3 1.5Z" />}

      {/* disco */}
      <circle className="ui-badge-disc" r="35" />
      <circle r="35" fill={`url(#${uid}-disc)`} className="ui-badge-sheen" />
      <circle className="ui-badge-inner" r="29.5" />

      {/* centro */}
      {icon != null && (
        <svg className="ui-badge-icon" x="-16" y="-16" width="32" height="32" viewBox="0 0 24 24" overflow="visible">
          {icon}
        </svg>
      )}
      {icon == null && mono && (
        <text className="ui-badge-mono" y={mono.length > 1 ? 9 : 10.5} textAnchor="middle" fontSize={mono.length > 2 ? 22 : mono.length > 1 ? 27 : 32}>
          {mono}
        </text>
      )}

      {locked && (
        <g className="ui-badge-lockmark" transform="translate(0 47)">
          <circle r="7" />
          <rect x="-2.9" y="-.9" width="5.8" height="4.6" rx="1" />
          <path d="M-1.8-.9v-1.5a1.8 1.8 0 0 1 3.6 0v1.5" />
        </g>
      )}
    </svg>
  );

  return (
    <figure
      className={cx("ui-badge", locked ? "ui-badge--locked" : "ui-badge--earned", celebrate && "ui-badge--celebrate", className)}
      style={style}
      role={caption ? "group" : undefined}
      aria-label={caption ? aria : undefined}
    >
      {medal}
      {caption && (
        <figcaption className="ui-badge-caption">
          <b>{label}</b>
          {sublabel != null && <small>{sublabel}</small>}
          {meta != null && <em>{meta}</em>}
        </figcaption>
      )}
    </figure>
  );
}

export type RankGlyphProps = {
  /** Índice del rango 0–9 (Polvo estelar … Supernova). */
  rank: number;
  /** done: superado · now: actual (dorado con brillo) · todo: por llegar. */
  state?: "done" | "now" | "todo";
  /** px (por defecto 22). */
  size?: number;
  /** Nombre accesible; sin él es decorativo. */
  title?: string;
  className?: string;
};

const RANK_ART: ReactNode[] = [
  // 0 · Polvo estelar
  <g key="0" className="ui-rank-fill">
    <circle cx="-3.2" cy="-2" r="1.15" />
    <circle cx="2.6" cy="-3.6" r=".8" />
    <circle cx="1" cy="3" r="1" />
    <circle cx="-1" cy="1" r=".55" />
    <circle cx="4.2" cy="1.6" r=".6" />
  </g>,
  // 1 · Nebulosa
  <g key="1" className="ui-rank-fill">
    <ellipse rx="6.4" ry="3.8" opacity=".3" transform="rotate(-12)" />
    <ellipse cx="1" rx="3.4" ry="2.2" opacity=".6" transform="rotate(-12)" />
    <circle cx="1.2" cy="-.3" r="1" />
  </g>,
  // 2 · Protoestrella
  <g key="2">
    <ellipse className="ui-rank-line" rx="7.2" ry="2.1" transform="rotate(-20)" />
    <circle className="ui-rank-fill" r="2.7" />
  </g>,
  // 3 · Estrella
  <g key="3">
    <path className="ui-rank-line" d="M0-6.6V6.6M-6.6 0H6.6" opacity=".7" />
    <path className="ui-rank-fill" d="M0-4 .9-.9 4 0 .9.9 0 4-.9.9-4 0-.9-.9Z" />
  </g>,
  // 4 · Gigante
  <g key="4">
    <circle className="ui-rank-fill" r="5" opacity=".85" />
    <circle className="ui-rank-line" r="7" opacity=".45" />
  </g>,
  // 5 · Supergigante
  <g key="5">
    <circle className="ui-rank-fill" r="6.2" opacity=".8" />
    <circle className="ui-rank-line" r="8.3" strokeDasharray="1.2 1.6" />
  </g>,
  // 6 · Púlsar
  <g key="6">
    <path className="ui-rank-line" d="M-6.5-6.5-2-2M2 2 6.5 6.5" />
    <path className="ui-rank-line" d="M-4.8 1.2a5 5 0 0 1 6-6M4.8-1.2a5 5 0 0 1-6 6" opacity=".6" />
    <circle className="ui-rank-fill" r="2" />
  </g>,
  // 7 · Cúmulo
  <g key="7" className="ui-rank-fill">
    <circle cx="-3" cy="-2.4" r="1.4" />
    <circle cx="2.2" cy="-3.2" r="1.1" />
    <circle cx="3.6" cy="1.8" r="1.4" />
    <circle cx="-.6" cy="3.6" r="1.1" />
    <circle cx="-3.8" cy="2" r=".8" />
    <circle cx=".4" cy=".2" r="1.2" />
  </g>,
  // 8 · Galaxia
  <g key="8">
    <path className="ui-rank-line" d="M0 0c3-1 5 1 4.4 3.6C3.6 7 -2 7.4 -5 4.6M0 0c-3 1-5-1-4.4-3.6C-3.6-7 2-7.4 5-4.6" />
    <circle className="ui-rank-fill" r="1.7" />
  </g>,
  // 9 · Supernova
  <g key="9">
    <path className="ui-rank-line" d="M0-7.4v3.6M0 3.8v3.6M-7.4 0h3.6M3.8 0h3.6M-5.2-5.2l2.5 2.5M2.7 2.7l2.5 2.5M5.2-5.2 2.7-2.7M-2.7 2.7l-2.5 2.5" />
    <circle className="ui-rank-fill" r="2.1" />
  </g>,
];

/** Icono de rango astronómico dentro de un disco (camino de rangos, medallón de nivel). */
export function RankGlyph({ rank, state = "done", size = 22, title, className }: RankGlyphProps) {
  const i = clamp(Math.round(rank), 0, RANK_ART.length - 1);
  return (
    <svg
      className={cx("ui-rank", `ui-rank--${state}`, className)}
      viewBox="-11 -11 22 22"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <circle className="ui-rank-disc" r="10.4" />
      {RANK_ART[i]}
    </svg>
  );
}
