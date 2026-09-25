// Chip del "Ritmo del 10": cuántos días vas por delante (dorado) o por
// detrás (ascua) del avance lineal hacia el objetivo de la próxima evaluación.
// Cifra antes que frase: "6 d tarde" / "6 d antes", nunca "−6 d" (regla 9).
import type { Pace10 } from "../../domain/pace";
import { cx, Icons, ICON_SIZE, plural } from "../../ui";

export function PaceChip({ pace, size = "md" }: { pace: Pace10; size?: "sm" | "md" }) {
  const ahead = pace.daysAhead >= 0;
  const days = Math.abs(pace.daysAhead);
  const aria = days === 0
    ? "Ritmo del 10: justo al ritmo previsto"
    : `Ritmo del 10: vas ${plural(days, "día", "días")} ${ahead ? "por delante" : "por detrás"} del ritmo hacia el 10`;
  const Icon = ahead ? Icons.paceUp : Icons.paceDown;
  return (
    <span className={cx("subjects-pace", ahead ? "is-ahead" : "is-behind", `subjects-pace--${size}`)} title={aria} role="img" aria-label={aria}>
      <Icon aria-hidden="true" {...ICON_SIZE.row} />
      {days === 0 ? (
        <span>al día</span>
      ) : (
        <>
          <b className="num">{days}</b>
          <span>d {ahead ? "antes" : "tarde"}</span>
        </>
      )}
    </span>
  );
}
