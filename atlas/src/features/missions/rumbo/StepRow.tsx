// Fila de un paso del Rumbo: usada en la lista de "próximos 7 días" y en la
// tarjeta de atrasados fijada arriba.
import { useState } from "react";
import { ChevronDown, ChevronRight, Play, BookOpen } from "lucide-react";
import type { RouteStep, SubjectRoute } from "../../../domain/route";
import { catalog, trialById } from "../../../state/catalog";
import { href } from "../../../state/router";
import type { Derived } from "../../../state/derive-core";
import { Button, ICON_SIZE, Icons, ProgressBar, Star, SubjectDot, num, pct, plural } from "../../../ui";
import { gradeNum } from "../helpers";
import { previousControl, stepEyebrow, stepHeading, stepHref, startCta, subjectShort, READY_RATIO } from "./helpers";
import { RouteMark } from "./RouteMark";

/** Máximo de tarjetas atrasadas que se muestran fijadas antes de plegar el resto. */
const MAX_PINNED_LATE = 3;

const conceptCountOf = (step: RouteStep): number => step.unitIds.reduce((n, id) => n + (catalog.conceptsByUnit.get(id)?.length ?? 0), 0);

/** Enlace de una fila: la prueba o la sesión de repaso; un examen real abre su asignatura. */
const rowHref = (step: RouteStep, derived: Derived): string =>
  href(step.kind === "exam" ? `/asignatura/${step.subjectId}` : stepHref(step, catalog, derived.progress));

function PrevScore({ prev }: { prev: RouteStep }) {
  const stars: (0 | 1 | 2)[] = [0, 1, 2];
  return (
    <span className="rumbo-prev">
      último <b className="num">{gradeNum(prev.best!)}</b>
      <span className="rumbo-stars" aria-label={`${prev.stars} de 3 estrellas`}>
        {stars.map((i) => (
          <Star key={i} state={i < prev.stars ? "mastered" : "unseen"} size={11} />
        ))}
      </span>
    </span>
  );
}

/** Asignatura (corta) + tipo de paso: "● Cálculo  CONTROL · TEMA 3". */
export function StepEyebrow({ step }: { step: RouteStep }) {
  return (
    <p className="rumbo-step-eyebrow">
      <SubjectDot subjectId={step.subjectId} />
      <span className="rumbo-step-subj">{subjectShort(step.subjectId, catalog)}</span>
      <span className="mono-label">{stepEyebrow(step, catalog)}</span>
      {step.assumed && <span className="rumbo-tag rumbo-tag--muted">fecha provisional</span>}
    </p>
  );
}

/** Qué es el paso, con icono: "{clock} 40′ · 4 problemas" (prueba), "{review} repaso del tema" o "{exam} misión principal". */
function StepWhat({ step }: { step: RouteStep }) {
  const row = ICON_SIZE.row;
  if (step.kind === "exam")
    return (
      <>
        <Icons.exam aria-hidden="true" size={row.size} strokeWidth={row.strokeWidth} /> misión principal
      </>
    );
  const trial = step.trialId ? trialById.get(step.trialId) : undefined;
  if (trial)
    return (
      <>
        <Icons.duration aria-hidden="true" size={row.size} strokeWidth={row.strokeWidth} /> {trial.durationMin}′ · {plural(trial.problems.length, "problema", "problemas")}
      </>
    );
  return (
    <>
      <Icons.review aria-hidden="true" size={row.size} strokeWidth={row.strokeWidth} /> repaso del tema
    </>
  );
}

/** Fila de un paso pendiente (próximos 7 días): glifo, título, preparación y enlace. */
export function StepRow({ route, step, derived }: { route: SubjectRoute; step: RouteStep; derived: Derived }) {
  const ready = step.readiness >= READY_RATIO;
  const conceptCount = conceptCountOf(step);
  const readyCount = Math.round(step.readiness * conceptCount);
  const prev = previousControl(route, step);
  const action = step.kind === "exam" ? "ver la asignatura" : step.trialId ? "abrir la prueba" : "repasar el tema";
  return (
    <li className={`rumbo-step${step.status === "next" ? " is-next" : ""}${ready ? " is-ready" : ""}${step.kind === "exam" ? " is-exam" : ""}`}>
      <a className="rumbo-step-link" href={rowHref(step, derived)} aria-label={`${stepHeading(step)} (${subjectShort(step.subjectId, catalog)}): ${action}`} />
      <RouteMark step={step} />
      <div className="rumbo-step-main">
        <StepEyebrow step={step} />
        <h4 className="rumbo-step-title">{stepHeading(step)}</h4>
        <p className="tone-3 rumbo-step-meta">
          <StepWhat step={step} />
          {prev && (
            <>
              {" · "}
              <PrevScore prev={prev} />
            </>
          )}
        </p>
      </div>
      <div className={`rumbo-step-prep${ready ? " is-ready" : ""}`}>
        {ready ? (
          <span className="rumbo-tag rumbo-tag--ready">Listo · {pct(step.readiness)}</span>
        ) : (
          <span className="rumbo-prep-label">
            <span>
              {conceptCount > 0 ? (
                <>
                  <b className="num">{readyCount}</b> de {conceptCount} listos
                </>
              ) : (
                "preparación"
              )}
            </span>
            <span className="num">{pct(step.readiness)}</span>
          </span>
        )}
        <ProgressBar value={step.readiness} tone={ready ? "gold" : "subject"} subjectId={step.subjectId} size="xs" label={`Preparación: ${pct(step.readiness)}`} />
      </div>
      <ChevronRight className="rumbo-step-chev" aria-hidden="true" />
    </li>
  );
}

/** Cifras de un paso atrasado, en una línea: "0/12 meta 9 · 19 d tarde" (o "0/12 · listo" si tiene prueba). */
function LateMeta({ step }: { step: RouteStep }) {
  const total = conceptCountOf(step);
  const readyCount = Math.round(step.readiness * total);
  const ready = step.readiness >= READY_RATIO;
  return (
    <p className="tone-2 rumbo-pin-desc">
      {total > 0 && (
        <>
          <b className="num">{readyCount}</b>/<span className="num">{total}</span>
          {step.trialId ? (
            ready && <span className="rumbo-gold-word"> · listo</span>
          ) : (
            <>
              {" "}
              meta <b className="num">{Math.ceil(READY_RATIO * total)}</b>
            </>
          )}
          {" · "}
        </>
      )}
      <span className="rumbo-late-word">{plural(-step.daysLeft, "día", "días")} tarde</span>
    </p>
  );
}

/** Tarjeta fija de pasos atrasados, con su CTA (empezar prueba o repasar el tema). */
export function LatePinned({ routes, derived }: { routes: readonly { route: SubjectRoute; step: RouteStep }[]; derived: Derived }) {
  const [expanded, setExpanded] = useState(false);
  if (routes.length === 0) return null;
  const shown = expanded ? routes : routes.slice(0, MAX_PINNED_LATE);
  const restCount = routes.length - shown.length;
  return (
    <div className="rumbo-pin">
      <p className="mono-label rumbo-pin-eyebrow">
        Atrasados · <b className="num">{routes.length}</b>
        {routes.length > MAX_PINNED_LATE && <> — empieza por estos {num(Math.min(MAX_PINNED_LATE, routes.length))}</>}
      </p>
      <ul className="rumbo-pin-list">
        {shown.map(({ step }, i) => {
          const ready = step.readiness >= READY_RATIO;
          // Una sola acción dorada: la del primer atrasado (diseño: una protagonista por pantalla).
          const variant = i === 0 ? "primary" : "ghost";
          return (
            <li key={step.key} className="rumbo-pin-item">
              <RouteMark step={step} size={30} />
              <div className="rumbo-pin-main">
                <StepEyebrow step={step} />
                <h3 className="rumbo-pin-title">{stepHeading(step)}</h3>
                <LateMeta step={step} />
              </div>
              <div className="rumbo-pin-cta">
                {step.trialId ? (
                  <Button variant={variant} icon={<Play />} href={href(stepHref(step, catalog, derived.progress))}>
                    {startCta(step)}
                  </Button>
                ) : (
                  <Button variant={variant} icon={<Play />} href={href(stepHref(step, catalog, derived.progress))}>
                    Repasar el tema
                  </Button>
                )}
                {step.trialId && !ready && (
                  <Button variant="quiet" size="sm" icon={<BookOpen />} href={href(stepHref({ ...step, trialId: undefined }, catalog, derived.progress))}>
                    Repasar antes
                  </Button>
                )}
                <ProgressBar value={step.readiness} tone={ready ? "gold" : "ember"} size="xs" label={`Preparación: ${pct(step.readiness)}`} />
              </div>
            </li>
          );
        })}
      </ul>
      {restCount > 0 && (
        <Button variant="ghost" size="sm" icon={<ChevronDown />} className="rumbo-pin-more" onClick={() => setExpanded(true)}>
          Ver los {num(restCount)} atrasados restantes
        </Button>
      )}
      {expanded && routes.length > MAX_PINNED_LATE && (
        <Button variant="quiet" size="sm" className="rumbo-pin-less" onClick={() => setExpanded(false)}>
          Mostrar menos
        </Button>
      )}
    </div>
  );
}
