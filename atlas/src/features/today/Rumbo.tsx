// Tarjeta «Rumbo» de Hoy: los 3 próximos objetivos de todas las asignaturas.
// La misión principal (examen real) más cercana ya no se repite aquí: se
// marca en su fila de «Próximas fechas» (Sidebar.tsx) para no mostrar el
// mismo examen dos veces en la misma columna.
import { useMemo } from "react";
import { nextObjectives } from "../../domain/route";
import { catalog } from "../../state/catalog";
import { href } from "../../state/router";
import { useRoutes } from "../../state/derived";
import { EmptyState, ICON_SIZE, Icons, Section, SubjectTag, cx } from "../../ui";
import { unitsLabel } from "../missions/rumbo/helpers";
import { RUMBO_STEP_ICON, RUMBO_STEP_LABEL, dueLabel, rumboStepHref } from "./helpers";

const SIZE_ROW = { size: ICON_SIZE.row.size, strokeWidth: ICON_SIZE.row.strokeWidth };

export function RumboSection() {
  const routes = useRoutes();
  const next3 = useMemo(() => nextObjectives(routes, 3), [routes]);

  return (
    <Section
      card
      aria-label="Rumbo"
      title="Rumbo"
      action={
        <span className="today-rumbo-links">
          <a className="today-link" href={href("/misiones?tab=pruebas")}>
            <Icons.trials aria-hidden="true" {...SIZE_ROW} />
            Pruebas
          </a>
          <a className="today-link" href={href("/misiones")}>
            <Icons.rumbo aria-hidden="true" {...SIZE_ROW} />
            Rumbo <Icons.open aria-hidden="true" {...SIZE_ROW} />
          </a>
        </span>
      }
    >
      {next3.length === 0 ? (
        <EmptyState
          size="sm"
          tone="dashed"
          icon={<Icons.rumbo aria-hidden="true" />}
          title="Aún no hay rumbo"
          description="Añade tus evaluaciones en Ajustes o usa la plantilla online para que Atlas trace el camino."
          action={
            <a className="today-link" href={href("/ajustes?sec=calendario")}>
              Ir al calendario
            </a>
          }
        />
      ) : (
        <ul className="today-rumbo-list">
          {next3.map((step) => {
            const StepIcon = Icons[RUMBO_STEP_ICON[step.kind]];
            const meta = step.kind === "unit" ? unitsLabel(step, catalog) || RUMBO_STEP_LABEL.unit : RUMBO_STEP_LABEL[step.kind];
            return (
              <li key={step.key} className="today-rumbo-step">
                <a className="today-rumbo-step-link" href={href(rumboStepHref(step))}>
                  <StepIcon aria-hidden="true" className="today-rumbo-step-icon" {...SIZE_ROW} />
                  <span className="today-rumbo-step-title">{step.title}</span>
                  <span className={cx("today-t", step.status === "late" && "pill is-ember")}>
                    {step.status === "late" && <Icons.late aria-hidden="true" {...SIZE_ROW} />}
                    {dueLabel(step)}
                  </span>
                  <span className="today-rumbo-step-meta">
                    <SubjectTag subjectId={step.subjectId} variant="code" size="sm" />
                    {meta}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
