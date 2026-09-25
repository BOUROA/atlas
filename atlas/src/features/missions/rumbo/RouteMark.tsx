// Glifos del Rumbo: la marca de un paso (estrella/rombo/planeta) según su
// tipo y estado, reutilizada en la Bitácora, la Carta y el panel de asignatura.
import type { RouteStep, RouteStatus } from "../../../domain/route";
import { subjectColor } from "../../../ui";

export type RouteMarkProps = {
  step: Pick<RouteStep, "kind" | "status" | "stars" | "subjectId">;
  size?: number;
  className?: string;
};

/** Planeta (misión principal / examen): disco con anillo, del color de la asignatura. */
export function Planet({ subjectId, size = 20, dim }: { subjectId: string; size?: number; dim?: boolean }) {
  const c = subjectColor(subjectId);
  return (
    <svg width={size} height={size} viewBox="-16 -16 32 32" aria-hidden="true" className="rumbo-planet" style={{ opacity: dim ? 0.7 : 1 }}>
      <circle r="14" fill={c} opacity=".1" />
      <ellipse rx="13" ry="3.8" fill="none" stroke={c} strokeOpacity=".8" strokeWidth="1.1" transform="rotate(-18)" />
      <circle r="6.5" fill={c} />
      <circle r="6.5" fill="#fff" opacity=".12" />
    </svg>
  );
}

const STATUS_LABEL: Record<RouteStatus, string> = { done: "hecho", late: "atrasado", next: "siguiente", upcoming: "próximo", skipped: "ya no aplica" };

/** Nombre accesible de un paso a partir de su estado y (si lo tiene) su nota en estrellas. */
export function stepStateLabel(step: Pick<RouteStep, "status" | "stars">): string {
  if (step.status === "done" && step.stars > 0) return `hecho, ${step.stars} de 3 estrellas`;
  return STATUS_LABEL[step.status];
}

/**
 * Marca de un paso: estrella (control/tema), rombo (simulacro) o planeta (examen),
 * coloreada por estado — hecho (más clara con más estrellas), siguiente (dorado),
 * atrasado (ascua) o próximo (hueca).
 */
export function RouteMark({ step, size = 22, className }: RouteMarkProps) {
  const c = subjectColor(step.subjectId);
  if (step.kind === "exam") return <Planet subjectId={step.subjectId} size={size} dim={step.status === "upcoming"} />;
  const isDiamond = step.kind === "sim-parcial" || step.kind === "sim-final";
  const big = step.kind === "sim-final";
  const r = isDiamond ? (big ? 6.2 : 5) : step.status === "done" ? 3.8 + step.stars * 0.8 : 4.2;

  if (step.status === "next") {
    return (
      <svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true" className={className}>
        <circle r="9" fill="none" stroke="var(--gold)" strokeOpacity=".55" strokeDasharray="2 3.2" />
        <circle r="5.4" fill="var(--gold-soft)" stroke="var(--gold)" strokeWidth="1.3" />
      </svg>
    );
  }
  if (step.status === "late") {
    return (
      <svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true" className={className}>
        <circle r="9" fill="var(--surface-solid)" stroke="var(--ember)" strokeWidth="1.4" />
        <circle r="3.4" fill="var(--ember)" />
      </svg>
    );
  }
  if (step.status === "skipped") {
    // Ya no aplica (su examen pasó sin hacerlo): marca tenue y tachada.
    return (
      <svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true" className={className} opacity={0.45}>
        {isDiamond ? <path d={`M0 -${r}L${r} 0L0 ${r}L-${r} 0Z`} fill="none" stroke="var(--text-3)" strokeWidth="1" /> : <circle r="3.4" fill="none" stroke="var(--text-3)" strokeWidth="1" />}
        <path d="M-5 5L5 -5" stroke="var(--text-3)" strokeWidth="1" />
      </svg>
    );
  }
  if (isDiamond) {
    const path = `M0 -${r}L${r} 0L0 ${r}L-${r} 0Z`;
    return (
      <svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true" className={className}>
        <path d={path} fill={step.status === "done" ? c : "none"} fillOpacity={step.status === "done" ? 0.7 : 1} stroke={c} strokeOpacity={step.status === "done" ? 0.95 : 0.55} strokeWidth={big ? 1.4 : 1.1} />
        {step.status === "done" && <circle r="1.6" fill={c} />}
      </svg>
    );
  }
  if (step.status === "done") {
    return (
      <svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true" className={className}>
        <circle r={r + 5} fill={c} opacity={0.16 + step.stars * 0.08} />
        <circle r={r} fill={c} opacity={0.75 + step.stars * 0.08} />
      </svg>
    );
  }
  // upcoming
  return (
    <svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true" className={className}>
      <circle r="3.4" fill="none" stroke={c} strokeOpacity=".55" strokeWidth="1.2" />
    </svg>
  );
}
