// Constancia (mapa de actividad de 26 semanas) y Evolución por asignatura
// (conceptos en nivel ≥ 2 a lo largo del tiempo, reconstruido desde levelUps).
import { useMemo } from "react";
import type { UserState } from "../../domain/types";
import { catalog, currentSubjects } from "../../state/catalog";
import type { Derived } from "../../state/derive-core";
import { EmptyState, Heatmap, Section, num, pluralWord, subjectColor } from "../../ui";
import { minutesByDay, wildcardsUsed, TERM_START } from "../today/helpers";

export function ConstancySection({ state, derived }: { state: UserState; derived: Derived }) {
  const values = useMemo(() => minutesByDay(state.events), [state.events]);
  const wildcards = useMemo(() => wildcardsUsed(derived.activeDays, derived.now), [derived.activeDays, derived.now]);

  return (
    <Section card aria-label="Constancia" eyebrow="Últimas 26 semanas" title="Constancia">
      <div className="progress-heat">
        <Heatmap values={values} weeks={26} today={derived.now} aria-label="Minutos de estudio de las últimas 26 semanas" />
        <div className="progress-heat-stats">
          <div className="progress-stat">
            <div className="progress-stat-v num">
              {num(derived.streak.current)}
              <small>{derived.streak.current === 1 ? "día" : "días"}</small>
            </div>
            <div className="progress-stat-k">racha actual</div>
          </div>
          <div className="progress-stat">
            <div className="progress-stat-v num">
              {num(derived.longestStreak)}
              <small>{derived.longestStreak === 1 ? "día" : "días"}</small>
            </div>
            <div className="progress-stat-k">mejor racha</div>
          </div>
          <div className="progress-stat">
            <div className="progress-stat-v num">{num(wildcards)}</div>
            <div className="progress-stat-k">{pluralWord(wildcards, "comodín usado", "comodines usados")}</div>
          </div>
        </div>
      </div>
    </Section>
  );
}

const CHART_W = 640;
const CHART_H = 200;

type EvoSeries = { subjectId: string; shortName: string; points: { t: number; count: number }[]; total: number };

export function EvolutionSection({ derived }: { derived: Derived }) {
  const now = derived.now.getTime();
  const tMin = new Date(`${TERM_START}T00:00:00`).getTime();

  const series = useMemo<EvoSeries[]>(
    () =>
      currentSubjects.map((s) => {
        const concepts = catalog.conceptsOfSubject(s.id);
        const times = concepts
          .map((c) => derived.progress.get(c.id)?.levelUps.find((u) => u.level === 2)?.at)
          .filter((at): at is string => !!at)
          .map((at) => Date.parse(at))
          .sort((a, b) => a - b);
        return {
          subjectId: s.id,
          shortName: s.shortName,
          points: times.map((t, i) => ({ t, count: i + 1 })),
          total: concepts.length,
        };
      }),
    [derived.progress],
  );

  const maxCount = Math.max(1, ...series.map((s) => s.points.at(-1)?.count ?? 0));
  const hasData = series.some((s) => s.points.length > 0);

  return (
    <Section card aria-label="Evolución por asignatura" eyebrow="Conceptos en nivel ≥ 2" title="Evolución por asignatura">
      {!hasData ? (
        <EmptyState size="sm" tone="dashed" title="Todavía no hay evolución" description="En cuanto domines tus primeros conceptos, aquí aparecerá su avance semana a semana." />
      ) : (
        <>
          <svg className="progress-evo" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Número de conceptos en nivel 2 o superior por asignatura, desde el inicio del curso">
            <g className="progress-evo-grid">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line key={f} x1={0} x2={CHART_W} y1={CHART_H - f * CHART_H} y2={CHART_H - f * CHART_H} />
              ))}
            </g>
            {series.map((s) => (
              <path key={s.subjectId} d={stepPath(s.points, tMin, now, CHART_W, CHART_H, maxCount)} style={{ stroke: subjectColor(s.subjectId) }} fill="none" />
            ))}
          </svg>
          <ul className="progress-evo-legend">
            {series
              .filter((s) => s.points.length > 0)
              .sort((a, b) => (b.points.at(-1)?.count ?? 0) - (a.points.at(-1)?.count ?? 0))
              .map((s) => (
                <li key={s.subjectId}>
                  <i style={{ background: subjectColor(s.subjectId) }} />
                  {s.shortName}
                  <em className="num">
                    {s.points.at(-1)?.count ?? 0} / {s.total}
                  </em>
                </li>
              ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function stepPath(points: { t: number; count: number }[], tMin: number, tMax: number, w: number, h: number, maxCount: number): string {
  const x = (t: number) => Math.max(0, Math.min(w, ((t - tMin) / Math.max(1, tMax - tMin)) * w));
  const y = (c: number) => h - (c / maxCount) * h;
  if (points.length === 0) return `M0 ${h} L${w} ${h}`;
  let d = `M0 ${y(0)}`;
  let prevY = y(0);
  for (const p of points) {
    const px = x(p.t);
    d += ` L${px} ${prevY} L${px} ${y(p.count)}`;
    prevY = y(p.count);
  }
  d += ` L${w} ${prevY}`;
  return d;
}
