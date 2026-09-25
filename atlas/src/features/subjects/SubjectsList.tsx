// Lista de asignaturas (#/asignaturas) · pantalla "Tus constelaciones".
import { useMemo } from "react";
import { Route } from "lucide-react";
import { catalog, currentSubjects } from "../../state/catalog";
import { useUserState } from "../../state/store";
import { useDerived, useSubjectLevels } from "../../state/derived";
import { href } from "../../state/router";
import { upcomingAssessments, type UpcomingAssessment } from "../../domain/tutor/queue";
import { pace10 } from "../../domain/pace";
import { gradeSummary } from "../../domain/grades";
import { subjectStateOf } from "../../domain/types";
import { EmptyState, Freshness, Icons, Page, Ring, Section, SubjectDot, dateShort, pct, plural, relDays } from "../../ui";
import { CURSO_LABEL, gradeNum, subjectStats } from "./helpers";
import { PaceChip } from "./PaceChip";

export function SubjectsScreen() {
  const state = useUserState((s) => s);
  const derived = useDerived();
  const levels = useSubjectLevels();
  const upcoming = useMemo(() => upcomingAssessments(catalog, state, derived.now), [state, derived.now]);

  const byYear = useMemo(() => {
    const groups = new Map<number, typeof currentSubjects[number][]>();
    for (const s of currentSubjects) {
      const list = groups.get(s.year);
      if (list) list.push(s);
      else groups.set(s.year, [s]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  return (
    <Page as="main">
      <Section
        card
        eyebrow={plural(currentSubjects.length, "asignatura", "asignaturas")}
        title="Tus constelaciones"
        description="Dominio, frescura, próxima evaluación y ritmo hacia el 10 de cada asignatura del curso."
      >
        {currentSubjects.length === 0 ? (
          <EmptyState title="Sin asignaturas" description="Todavía no hay asignaturas en el catálogo." />
        ) : (
          byYear.map(([year, subjects]) => (
            <div key={year} className="subjects-group">
              <p className="mono-label subjects-group-label">{CURSO_LABEL[year] ?? `${year}.º curso`}</p>
              <ul className="subjects-list">
                {subjects.map((s) => {
                  const stats = subjectStats(s.id, derived.progress);
                  const sub = subjectStateOf(state, s.id);
                  const next = upcoming.get(s.id)?.[0] as UpcomingAssessment | undefined;
                  const summary = gradeSummary(sub.assessments, state.settings.targetGrade);
                  const pace = pace10(catalog, state, derived.progress, s.id, derived.now);
                  const totalUnits = catalog.unitsBySubject.get(s.id)?.filter((u) => u.number > 0).length ?? 0;

                  return (
                    <li key={s.id} className="subjects-row">
                      <a className="subjects-row-link" href={href(`/asignatura/${s.id}`)} aria-label={`${s.name}, abrir detalle`} />
                      <div className="subjects-row-name">
                        <SubjectDot subjectId={s.id} size={9} />
                        <div>
                          <h3>{s.name}</h3>
                          <p className="mono-label subjects-row-sub">
                            {totalUnits > 0 ? `Vas por el tema ${sub.currentUnit} de ${totalUnits}` : "Sin temario"}
                            {" · "}
                            {plural(stats.seen, "concepto visto", "conceptos vistos")} de {stats.total}
                          </p>
                          {levels[s.id] && (
                            <a className="subjects-camino-chip" href={href(`/misiones?tab=camino&asig=${s.id}`)} title="Ver el camino de la asignatura">
                              <Route aria-hidden="true" width={12} height={12} strokeWidth={2} />
                              Nv {levels[s.id].level} · {levels[s.id].label}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="subjects-row-stats">
                        <div className="subjects-stat">
                          <span className="mono-label">Dominio</span>
                          <Ring value={stats.domainRatio} size={40} thickness={3.5} tone="subject" subjectId={s.id} aria-label={`Dominio: ${pct(stats.domainRatio)}`} />
                        </div>
                        <div className="subjects-stat">
                          <span className="mono-label">Frescura</span>
                          <Freshness r={stats.freshnessAvg} variant="track" showPct showLabel={false} />
                        </div>
                        <div className="subjects-stat subjects-stat--eval">
                          <span className="mono-label">Próxima evaluación</span>
                          {next ? (
                            <span className="subjects-next">
                              {next.assessment.title} <em>{relDays(next.days)}</em>
                              <small>{dateShort(next.assessment.date!)}</small>
                            </span>
                          ) : (
                            <span className="subjects-next subjects-next--none">Sin fecha próxima</span>
                          )}
                        </div>
                        <div className="subjects-stat">
                          <span className="mono-label">Nota actual</span>
                          <span className="subjects-grade num">{summary.currentAverage != null ? gradeNum(summary.currentAverage) : "—"}</span>
                        </div>
                        <div className="subjects-stat">
                          <span className="mono-label">Ritmo del 10</span>
                          <PaceChip pace={pace} />
                        </div>
                      </div>

                      <Icons.open className="subjects-row-chev" aria-hidden="true" />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </Section>
    </Page>
  );
}
