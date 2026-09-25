// Pestaña "Temario": temas plegables con filas compactas por concepto.
import { useMemo } from "react";
import { catalog } from "../../state/catalog";
import { hasNotes } from "../../state/notes";
import { useUserState } from "../../state/store";
import { useDerived } from "../../state/derived";
import { href, openConcept } from "../../state/router";
import { subjectStateOf } from "../../domain/types";
import { progressOf } from "../../domain/tutor/mastery";
import { dayKey, daysBetween } from "../../domain/time";
import { EmptyState, Freshness, ICON_SIZE, Icons, LevelBars, ProgressBar, freshnessBand, pct, plural, relDays } from "../../ui";
import { LIT_LEVEL, unitReached } from "./helpers";

export function Syllabus({ subjectId }: { subjectId: string }) {
  const state = useUserState((s) => s);
  const derived = useDerived();
  const currentUnit = subjectStateOf(state, subjectId).currentUnit;
  const units = catalog.unitsBySubject.get(subjectId) ?? [];
  const today = dayKey(derived.now);

  const rows = useMemo(
    () => units.map((u) => ({ unit: u, concepts: catalog.conceptsByUnit.get(u.id) ?? [] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectId, units.length],
  );

  if (units.length === 0) {
    return <EmptyState title="Sin temario" description="Esta asignatura todavía no tiene temas en el catálogo." />;
  }

  return (
    <div className="subjects-syllabus">
      {rows.map(({ unit, concepts }) => {
        const reached = unitReached(unit, currentUnit);
        const lit = concepts.filter((c) => progressOf(derived.progress, c.id).level >= LIT_LEVEL).length;
        const ratio = concepts.length > 0 ? lit / concepts.length : 0;
        const isCurrent = unit.number === currentUnit;
        return (
          <details key={unit.id} className="subjects-unit" open={reached}>
            <summary className={reached ? undefined : "is-todo"}>
              <span className="subjects-unit-n mono-label">
                <Icons.unit aria-hidden="true" {...ICON_SIZE.row} /> {unit.number === 0 ? "Intro" : `T${unit.number}`}
              </span>
              <span className="subjects-unit-title">
                {unit.title}
                {isCurrent && <em className="subjects-unit-tag subjects-unit-tag--now">vas por aquí</em>}
                {hasNotes(unit.id) && (
                  <a className="subjects-unit-notes" href={href(`/apuntes/${unit.id}`)} onClick={(e) => e.stopPropagation()}>
                    <Icons.notes aria-hidden="true" {...ICON_SIZE.row} /> Apuntes
                  </a>
                )}
              </span>
              <span className="subjects-unit-count mono-label">
                {plural(concepts.length, "concepto", "conceptos")}
                {ratio > 0 && ratio < 0.9 && <> · {pct(ratio)}</>}
              </span>
              <ProgressBar value={ratio} tone="subject" subjectId={subjectId} size="xs" label={`${unit.title}: ${pct(ratio)} encendido`} className="subjects-unit-bar" />
            </summary>

            {concepts.length === 0 ? (
              <p className="subjects-unit-empty tone-3">Sin conceptos en este tema.</p>
            ) : (
              <ul className={`subjects-concepts${reached ? "" : " is-todo"}`}>
                {concepts.map((c) => {
                  const p = progressOf(derived.progress, c.id);
                  const advanced = !reached && p.level >= 1;
                  const cooling = p.level >= LIT_LEVEL && freshnessBand(p.retrievability).band === "fria";
                  const dueDays = p.due ? daysBetween(today, dayKey(p.due)) : null;
                  return (
                    <li key={c.id} className={advanced ? "is-advanced" : undefined}>
                      <button type="button" className="subjects-concept-row" onClick={() => openConcept(c.id)}>
                        <span className="subjects-concept-order mono-label num">{c.order}</span>
                        <span className="subjects-concept-name">
                          {c.name}
                          {advanced && <em className="subjects-unit-tag subjects-unit-tag--now">adelantado</em>}
                        </span>
                        <span className="subjects-concept-meta">
                          <LevelBars level={p.level} subjectId={subjectId} cooling={cooling} size="sm" />
                          <Freshness r={p.retrievability} variant="track" size="sm" />
                          <span className="subjects-concept-next tone-3">
                            {dueDays == null ? (
                              "—"
                            ) : dueDays <= 0 ? (
                              <span className="subjects-concept-due">
                                <Icons.cooling aria-hidden="true" {...ICON_SIZE.row} /> hoy
                              </span>
                            ) : (
                              relDays(dueDays)
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </details>
        );
      })}
    </div>
  );
}
