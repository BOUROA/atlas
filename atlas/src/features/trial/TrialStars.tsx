// Las 3 estrellas de una prueba (1 desde 7, 2 desde 8,5 y 3 desde 9,5): las
// ganadas en oro; las que faltan, en contorno para que se lea "1 de 3".
import { cx } from "../../ui";

const SPARK = "M0-10 2.3-2.3 10 0 2.3 2.3 0 10-2.3 2.3-10 0-2.3-2.3Z";

export function TrialStars({ count, size = 16, className }: { count: number; size?: number; className?: string }) {
  return (
    <span className={cx("trial-stars", className)} role="img" aria-label={`${count} de 3 estrellas`}>
      {[0, 1, 2].map((i) => (
        <svg key={i} width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true" className={cx("trial-star", i < count && "is-on")}>
          <path d={SPARK} />
        </svg>
      ))}
    </span>
  );
}
