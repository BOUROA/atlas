// Detalle de asignatura (#/asignatura/:id): cabecera + pestañas.
import { useMemo, type CSSProperties } from "react";
import { Route } from "lucide-react";
import { catalog } from "../../state/catalog";
import { useUserState } from "../../state/store";
import { useDerived, useSubjectLevels } from "../../state/derived";
import { setCurrentUnit } from "../../state/actions";
import { href, setQuery } from "../../state/router";
import { upcomingAssessments } from "../../domain/tutor/queue";
import { examReadiness } from "../../domain/tutor/forecast";
import { pace10 } from "../../domain/pace";
import { subjectStateOf } from "../../domain/types";
import { EmptyState, ICON_SIZE, Icons, Page, Ring, SubjectDot, Tabs, TabPanel, Tooltip, dateShort, pct, plural, relDays, type TabItem } from "../../ui";
import { subjectStats } from "./helpers";
import { PaceChip } from "./PaceChip";
import { Syllabus } from "./Syllabus";
import { Evaluation } from "./Evaluation";
import { Bases } from "./Bases";
import { FeedsInto } from "./FeedsInto";

type TabId = "temario" | "evaluacion" | "bases" | "despues";
const TAB_ITEMS: TabItem<TabId>[] = [
  { id: "temario", label: "Temario" },
  { id: "evaluacion", label: "Evaluación" },
  { id: "bases", label: "Bases" },
  { id: "despues", label: "Te servirá para" },
];
const VALID: readonly TabId[] = ["temario", "evaluacion", "bases", "despues"];

export function SubjectDetailScreen({ subjectId, tab }: { subjectId: string; tab: string | null }) {
  const subject = catalog.subjectById.get(subjectId);
  const state = useUserState((s) => s);
  const derived = useDerived();
  const levels = useSubjectLevels();
  const upcoming = useMemo(() => upcomingAssessments(catalog, state, derived.now), [state, derived.now]);

  if (!subject) {
    return (
      <Page as="main">
        <EmptyState title="Asignatura desconocida" description={`No hay ninguna asignatura con el identificador «${subjectId}».`} />
      </Page>
    );
  }

  const active: TabId = VALID.includes(tab as TabId) ? (tab as TabId) : "temario";
  const sub = subjectStateOf(state, subjectId);
  const units = catalog.unitsBySubject.get(subjectId) ?? [];
  const teachingUnits = units.filter((u) => u.number > 0);
  const stats = subjectStats(subjectId, derived.progress);
  const pace = pace10(catalog, state, derived.progress, subjectId, derived.now);
  const nextAssessments = (upcoming.get(subjectId) ?? []).slice(0, 3);

  return (
    <Page as="main">
      <header className="subjects-detail-head" style={{ "--c": `var(--s-${subjectId}, var(--text-3))` } as CSSProperties}>
        <div className="subjects-detail-top">
          <SubjectDot subjectId={subjectId} size={13} />
          <div className="subjects-detail-titles">
            <h1>{subject.name}</h1>
            <p className="tone-3">
              {plural(stats.total, "concepto", "conceptos")}
              {levels[subjectId] && (
                <>
                  {" · "}
                  <a className="subjects-camino-chip" href={href(`/misiones?tab=camino&asig=${subjectId}`)} title="Ver el camino de la asignatura">
                    <Route aria-hidden="true" width={12} height={12} strokeWidth={2} />
                    Nv {levels[subjectId].level} · {levels[subjectId].label}
                  </a>
                </>
              )}
            </p>
          </div>
          <div className="subjects-detail-pace">
            <PaceChip pace={pace} size="md" />
            <Tooltip
              content={
                pace.daysAhead < 0
                  ? `Para llegar al 10 deberías ir ${plural(Math.abs(pace.daysAhead), "día", "días")} más adelantado.`
                  : "Ritmo del 10: vas por delante del avance lineal hacia el objetivo de la próxima evaluación."
              }
            >
              <button type="button" className="subjects-infotip" aria-label="Qué es el ritmo del 10">
                <Icons.help aria-hidden="true" {...ICON_SIZE.row} />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="subjects-detail-controls">
          <label htmlFor="subjects-unit-select" className="mono-label subjects-detail-controls-label">
            <Icons.unit aria-hidden="true" {...ICON_SIZE.row} /> Vas por
          </label>
          <select
            id="subjects-unit-select"
            className="subjects-input subjects-unit-select"
            value={sub.currentUnit}
            onChange={(e) => setCurrentUnit(subjectId, Number(e.target.value))}
          >
            {teachingUnits.map((u) => (
              <option key={u.id} value={u.number}>
                Tema {u.number} · {u.title}
              </option>
            ))}
          </select>
        </div>

        {nextAssessments.length > 0 && (
          <ul className="subjects-detail-evals">
            {nextAssessments.map((up) => {
              const wholeSubject = up.assessment.unitIds.length === 0;
              const ratio = wholeSubject
                ? stats.domainRatio
                : examReadiness({ index: catalog, progress: derived.progress, scheduler: derived.scheduler, assessment: up.assessment }).expected;
              return (
                <li key={up.assessment.id} className="subjects-detail-eval">
                  <span className="subjects-detail-eval-ring">
                    <Ring value={ratio} size={48} thickness={4} aria-label={`Preparación prevista para ${up.assessment.title}: ${pct(ratio)}`} />
                    <span className="mono-label subjects-detail-eval-ring-label">preparado</span>
                  </span>
                  <div>
                    <b>{up.assessment.title}</b>
                    <span className="tone-3">
                      {relDays(up.days)} · {up.assessment.date && dateShort(up.assessment.date)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </header>

      <Tabs
        id="subject-tabs"
        aria-label="Secciones de la asignatura"
        items={TAB_ITEMS}
        value={active}
        onChange={(id) => setQuery({ tab: id === "temario" ? null : id })}
        className="subjects-tabs"
      />
      <TabPanel tabs="subject-tabs" tab={active}>
        {active === "temario" && <Syllabus subjectId={subjectId} />}
        {active === "evaluacion" && <Evaluation subjectId={subjectId} />}
        {active === "bases" && <Bases subjectId={subjectId} />}
        {active === "despues" && <FeedsInto subjectId={subjectId} />}
      </TabPanel>
    </Page>
  );
}
