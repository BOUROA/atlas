import { useMemo } from "react";
import { useSvgId } from "./hooks";
import { cx, seededRandom } from "./cx";

type Dot = { x: number; y: number; r: number; o: number; warm: boolean };

function makeTile(seed: number, size: number, count: number, rMin: number, rMax: number, oMin: number, oMax: number): Dot[] {
  const rnd = seededRandom(seed);
  const dots: Dot[] = [];
  for (let i = 0; i < count; i++) {
    const big = rnd() > 0.9;
    dots.push({
      x: Math.round(rnd() * size * 10) / 10,
      y: Math.round(rnd() * size * 10) / 10,
      r: Math.round((rMin + rnd() * (big ? rMax - rMin : (rMax - rMin) * 0.45)) * 100) / 100,
      o: Math.round((oMin + rnd() * (oMax - oMin)) * 100) / 100,
      warm: rnd() > 0.35,
    });
  }
  return dots;
}

// Gratícula de proyección polar (meridianos y paralelos) en un lienzo de 1600 × 1000.
const GRAT_CX = 1420;
const GRAT_CY = -260;
const PARALLELS = [320, 470, 620, 770, 920, 1070, 1220, 1370, 1520];
const MERIDIANS = Array.from({ length: 13 }, (_, i) => 100 + i * 7); // grados

export type StarFieldProps = {
  /** Semilla fija: el mismo cielo en cada visita. */
  seed?: number;
  /** Densidad relativa (1 = la de la maqueta). */
  density?: number;
  /** Cubre la ventana (fondo de la app) en vez de su contenedor. */
  fixed?: boolean;
  /** Titileo muy lento de la capa brillante (respeta movimiento reducido). */
  twinkle?: boolean;
  /** Retícula de coordenadas: auto = solo en «Carta impresa». */
  graticule?: "auto" | "always" | "never";
  className?: string;
};

/**
 * Campo de estrellas tenue de fondo, generado con semilla fija y repetido en
 * mosaico (no se deforma al cambiar el tamaño). Decorativo: aria-hidden.
 * La app lo monta una vez con `fixed`; las tarjetas pueden usar uno propio.
 */
export function StarField({ seed = 24, density = 1, fixed, twinkle = true, graticule = "auto", className }: StarFieldProps) {
  const id = useSvgId("sf");
  const tiles = useMemo(
    () => ({
      faint: makeTile(seed, 420, Math.round(58 * density), 0.45, 1.05, 0.15, 0.5),
      bright: makeTile(seed * 7 + 3, 690, Math.round(20 * density), 0.7, 1.6, 0.35, 0.8),
    }),
    [seed, density],
  );
  return (
    <div className={cx("ui-starfield", fixed && "ui-starfield--fixed", className)} aria-hidden="true">
      <svg className="ui-starfield-stars" width="100%" height="100%" focusable="false">
        <defs>
          <pattern id={`${id}-a`} width="420" height="420" patternUnits="userSpaceOnUse">
            {tiles.faint.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.o} className={d.warm ? "sf-w" : "sf-c"} />
            ))}
          </pattern>
          <pattern id={`${id}-b`} width="690" height="690" patternUnits="userSpaceOnUse" x="137" y="61">
            {tiles.bright.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.o} className={d.warm ? "sf-w" : "sf-c"} />
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-a)`} />
        <rect className={cx(twinkle && "ui-starfield-twinkle")} width="100%" height="100%" fill={`url(#${id}-b)`} />
      </svg>
      {graticule !== "never" && (
        <svg
          className={cx("ui-starfield-grat", graticule === "always" && "ui-starfield-grat--always")}
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          <g fill="none">
            {PARALLELS.map((r, i) => (
              <circle key={r} cx={GRAT_CX} cy={GRAT_CY} r={r} strokeDasharray={i % 2 ? "2 7" : undefined} />
            ))}
            {MERIDIANS.map((deg) => {
              const a = (deg * Math.PI) / 180;
              const x2 = GRAT_CX + Math.cos(a) * 1700;
              const y2 = GRAT_CY + Math.sin(a) * 1700;
              return <path key={deg} d={`M${GRAT_CX + Math.cos(a) * 320} ${GRAT_CY + Math.sin(a) * 320}L${x2.toFixed(1)} ${y2.toFixed(1)}`} />;
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
