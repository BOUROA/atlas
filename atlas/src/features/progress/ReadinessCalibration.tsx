// Preparación por evaluación y calibración (acierto según confianza declarada).
import { useMemo } from "react";
import { examReadiness } from "../../domain/tutor/forecast";
import { upcomingAssessments } from "../../domain/tutor/queue";
import type { Assessment, UserState } from "../../domain/types";
import { catalog } from "../../state/catalog";
import { href } from "../../state/router";
import type { Derived } from "../../state/derive-core";
import { EmptyState, Ring, Section, SubjectDot, dateLong, pct } from "../../ui";

const KIND_LABEL: Record<Assessment["kind"], string> = {
  parcial: "Parcial", final: "Final", entrega: "Entrega", practica: "Práctica", otro: "Evaluación",
};

export function ReadinessSection({ state, derived }: { state: UserState; derived: Derived }) {
  const rows = useMemo(() => {
    const map = upcomingAssessments(catalog, state, derived.now);
    const flat: { assessment: Assessment; subjectId: string; days: number; expected: number; coverage: number }[] = [];
    for (const [subjectId, list] of map) {
      for (const up of list) {
        const r = examReadiness({ index: catalog, progress: derived.progress, scheduler: derived.scheduler, assessment: up.assessment });
        flat.push({ assessment: up.assessment, subjectId, days: up.days, expected: r.expected, coverage: r.coverage });
      }
    }
    return flat.sort((a, b) => a.days - b.days);
  }, [state, derived]);

  return (
    <Section card aria-label="Preparación por evaluación" eyebrow="Frescura prevista el día del examen" title="Preparación por evaluación">
      {rows.length === 0 ? (
        <EmptyState
          size="sm"
          tone="dashed"
          title="Sin evaluaciones a la vista"
          description="Añade tus exámenes y entregas para ver aquí la preparación prevista de cada una."
          action={
            <a className="progress-link" href={href("/asignaturas")}>
              Ir a asignaturas
            </a>
          }
        />
      ) : (
        <ul className="progress-readiness">
          {rows.map((r) => (
            <li key={r.assessment.id}>
              <Ring value={r.expected} size={44} subjectId={r.subjectId} tone="subject" aria-label={`Preparación prevista: ${pct(r.expected)}`} />
              <div>
                <p className="progress-readiness-t">
                  {r.assessment.title || "Evaluación"}
                  <span>{KIND_LABEL[r.assessment.kind]}</span>
                </p>
                <p className="progress-readiness-s">
                  <SubjectDot subjectId={r.subjectId} />
                  {catalog.subjectById.get(r.subjectId)?.shortName ?? r.subjectId}
                  {r.assessment.date && <> · {dateLong(r.assessment.date)}</>}
                </p>
              </div>
              <span className="progress-readiness-cov">
                cobertura <b>{pct(r.coverage)}</b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const CONFIDENCE = [
  { id: 3 as const, label: "Seguro" },
  { id: 2 as const, label: "Creo" },
  { id: 1 as const, label: "Dudo" },
];
const MIN_SAMPLE = 5;

export function CalibrationSection({ state }: { state: UserState }) {
  const byConfidence = useMemo(() => {
    const acc = new Map<1 | 2 | 3, { hits: number; total: number }>();
    for (const e of state.events) {
      if (e.kind !== "review" || e.attempted === false || e.grade === undefined || !e.confidence) continue;
      const c = acc.get(e.confidence) ?? { hits: 0, total: 0 };
      c.total++;
      if (e.grade >= 3) c.hits++;
      acc.set(e.confidence, c);
    }
    return acc;
  }, [state.events]);

  const total = [...byConfidence.values()].reduce((s, c) => s + c.total, 0);
  const sure = byConfidence.get(3);

  return (
    <Section card aria-label="Calibración" eyebrow="Acierto (nota ≥ 3) por confianza declarada" title="Calibración">
      {total === 0 ? (
        <EmptyState size="sm" tone="dashed" title="Aún no hay calibración" description="Cuando declares tu confianza antes de responder (Dudo · Creo · Seguro), verás aquí si acierta lo que esperabas." />
      ) : (
        <>
          <div className="progress-calib">
            {CONFIDENCE.map(({ id, label }) => {
              const c = byConfidence.get(id);
              const ratio = c && c.total > 0 ? c.hits / c.total : 0;
              return (
                <div key={id} className="progress-calib-row">
                  <span className="progress-calib-label">{label}</span>
                  <span className="progress-calib-track">
                    <b style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </span>
                  <span className="progress-calib-pct num">{c ? pct(ratio) : "—"}</span>
                  <span className="progress-calib-n">{c ? `${c.hits} / ${c.total}` : "sin datos"}</span>
                </div>
              );
            })}
          </div>
          {sure && sure.total >= MIN_SAMPLE && (
            <p className="progress-calib-phrase">
              Cuando dices <em>seguro</em> aciertas el <b>{pct(sure.hits / sure.total)}</b>.
            </p>
          )}
        </>
      )}
    </Section>
  );
}
