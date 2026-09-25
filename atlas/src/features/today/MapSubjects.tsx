// Carta celeste (avance), misión y estrella guía más cercanas, y el bloque
// compacto de asignaturas con el Ritmo del 10.
import { useMemo } from "react";
import { pace10 } from "../../domain/pace";
import { upcomingAssessments } from "../../domain/tutor/queue";
import type { UserState } from "../../domain/types";
import { catalog, currentSubjects, expeditions, guides, isLegend } from "../../state/catalog";
import { href } from "../../state/router";
import type { Derived } from "../../state/derive-core";
import { useSubjectLevels } from "../../state/derived";
import { MiniSky } from "../map/MiniSky";
import { EmptyState, Freshness, ICON_SIZE, Icons, Ring, Section, SubjectDot, Tooltip, cx, num, pct, signed } from "../../ui";
import { initials, nearestGuide, nearestMission } from "./helpers";

const SIZE_ROW = { size: ICON_SIZE.row.size, strokeWidth: ICON_SIZE.row.strokeWidth };

/** Fragmento de la carta celeste centrado en las asignaturas de la sesión de hoy. */
export function MapSection({ subjectIds, highlight, derived }: { subjectIds: string[]; highlight: string[]; derived: Derived }) {
  return (
    <Section
      card
      aria-label="Carta celeste"
      className="today-map"
      title="Carta celeste"
      action={
        <a className="today-link" href={href("/mapa")}>
          <Icons.map aria-hidden="true" {...SIZE_ROW} />
          Mapa <Icons.open aria-hidden="true" {...SIZE_ROW} />
        </a>
      }
    >
      <MiniSky
        subjectIds={subjectIds.length > 0 ? subjectIds : currentSubjects.slice(0, 4).map((s) => s.id)}
        highlight={highlight}
        height={260}
        caption="Fragmento de la carta celeste centrado en las asignaturas de hoy, con las estrellas de la sesión marcadas"
      />
    </Section>
  );
}

/** Misión y estrella guía más cercanas: dos tarjetas compactas con enlace directo. */
export function NearestSection({ state, derived }: { state: UserState; derived: Derived }) {
  const mission = useMemo(() => nearestMission(expeditions, state, derived.progress), [state, derived.progress]);
  const guide = useMemo(() => nearestGuide(guides, derived.progress), [derived.progress]);

  return (
    <div className="today-nearest">
      <a className={cx("ui-card", "ui-card--interactive", "ui-pad--md", "today-nearest-card")} href={mission ? href(`/mision/${mission.expedition.id}`) : href("/misiones")} aria-label="Misión más cercana">
        <p className="mono-label">
          <Icons.mission aria-hidden="true" {...SIZE_ROW} /> Misión
        </p>
        {mission ? (
          <div className="today-nearest-body">
            <span className="today-nearest-monogram" aria-hidden="true">
              {initials(mission.expedition.university)}
            </span>
            <div>
              <b>
                {mission.expedition.course} · {mission.expedition.title}
              </b>
              <small>
                {mission.expedition.university} · {mission.expedition.term}
              </small>
            </div>
            <Ring value={mission.readiness.ratio} size={44} aria-label={`Preparación: ${pct(mission.readiness.ratio)}`} />
          </div>
        ) : (
          <p className="today-nearest-empty">{expeditions.length === 0 ? "Aún no hay misiones cargadas." : "Has superado todas las misiones disponibles."}</p>
        )}
      </a>

      <a className={cx("ui-card", "ui-card--interactive", "ui-pad--md", "today-nearest-card")} href={guide ? href(`/guia/${guide.guide.id}`) : href("/misiones")} aria-label="Estrella guía más cercana">
        <p className="mono-label">
          <Icons.guide aria-hidden="true" {...SIZE_ROW} /> Estrella guía
        </p>
        {guide ? (
          <div className="today-nearest-body">
            <span className="today-nearest-monogram today-nearest-monogram--guide" aria-hidden="true">
              {initials(guide.guide.name)}
            </span>
            <div>
              <b>{guide.guide.name}</b>
              <small>{isLegend(guide.guide) ? guide.guide.years : guide.guide.field}</small>
            </div>
            <Ring value={guide.progress.ratio} size={44} aria-label={`Constelación encendida: ${pct(guide.progress.ratio)}`} />
          </div>
        ) : (
          <p className="today-nearest-empty">Aún no has empezado ninguna constelación de estrella guía.</p>
        )}
      </a>
    </div>
  );
}

const YEAR_LABEL: Record<number, string> = { 1: "1.º curso", 2: "2.º curso", 3: "3.º curso", 4: "4.º curso" };

/** Bloque compacto de asignaturas: vistos, iluminados, frescura media y Ritmo del 10. */
export function SubjectsSection({ state, derived }: { state: UserState; derived: Derived }) {
  const upcoming = useMemo(() => upcomingAssessments(catalog, state, derived.now), [state, derived.now]);
  const levels = useSubjectLevels();
  const rows = useMemo(
    () =>
      currentSubjects.map((s) => {
        const concepts = catalog.conceptsOfSubject(s.id);
        const seen = concepts.filter((c) => (derived.progress.get(c.id)?.level ?? 0) >= 1).length;
        const lit = concepts.filter((c) => (derived.progress.get(c.id)?.level ?? 0) >= 2).length;
        const withCard = concepts.map((c) => derived.progress.get(c.id)).filter((p): p is NonNullable<typeof p> => !!p?.card);
        const freshness = withCard.length > 0 ? withCard.reduce((sum, p) => sum + (p.retrievability ?? 0), 0) / withCard.length : null;
        const next = upcoming.get(s.id)?.[0];
        const pace = pace10(catalog, state, derived.progress, s.id, derived.now);
        return { subject: s, total: concepts.length, seen, lit, freshness, next, pace };
      }),
    [state, derived],
  );
  const byYear = useMemo(() => {
    const groups = new Map<number, typeof rows>();
    for (const r of rows) {
      const list = groups.get(r.subject.year);
      if (list) list.push(r);
      else groups.set(r.subject.year, [r]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  return (
    <Section
      card
      aria-label="Estado por asignatura"
      title="Constelaciones"
      action={
        <div className="today-card-aside today-card-aside--row">
          <Tooltip content="Barra clara: % encendido · barra escarcha→oro: frescura · flecha: ritmo del 10 · calendario: próximo examen">
            <button type="button" className="today-info" aria-label="Cómo se leen las asignaturas">
              <Icons.help aria-hidden="true" {...SIZE_ROW} />
            </button>
          </Tooltip>
          <a className="today-link" href={href("/asignaturas")}>
            Asignaturas <Icons.open aria-hidden="true" {...SIZE_ROW} />
          </a>
        </div>
      }
    >
      {byYear.map(([year, list]) => (
        <div key={year}>
          <p className="today-subs-group">{YEAR_LABEL[year] ?? `${year}.º curso`}</p>
          <div className="today-subs-grid">
            {list.map((r) => (
              <a key={r.subject.id} className="today-sub" href={href(`/asignatura/${r.subject.id}`)}>
                <div className="today-sub-head">
                  <SubjectDot subjectId={r.subject.id} />
                  <span className="today-sub-name">{r.subject.shortName}</span>
                  {levels[r.subject.id] && (
                    <span className="today-sub-lvl num" title={`Camino: ${levels[r.subject.id].label}`}>
                      Nv {levels[r.subject.id].level}
                    </span>
                  )}
                  <span className="today-sub-pct num">{pct(r.lit / Math.max(1, r.total))}</span>
                </div>
                <div className="today-sub-bars">
                  <span className="today-sub-bar-track today-sub-bar-track--lit">
                    <b style={{ width: `${Math.round((r.lit / Math.max(1, r.total)) * 100)}%` }} />
                  </span>
                  {r.freshness != null ? (
                    <Freshness r={r.freshness} variant="track" size="sm" showPct={false} showLabel={false} className="today-sub-fresh" />
                  ) : (
                    <span className="today-sub-bar-track" title="Sin repasos todavía" />
                  )}
                </div>
                <div className="today-sub-t">
                  <span className="today-t">
                    <Icons.seen aria-hidden="true" {...SIZE_ROW} />
                    <span className="num">
                      {num(r.seen)}/{num(r.total)}
                    </span>{" "}
                    vistos
                  </span>
                  {r.next && (
                    <span className="today-t">
                      <Icons.date aria-hidden="true" {...SIZE_ROW} />
                      <span className="num">{r.next.days === 0 ? "hoy" : r.next.days === 1 ? "mañana" : `${num(r.next.days)} d`}</span>
                    </span>
                  )}
                  <span className={cx("today-t", r.pace.daysAhead >= 0 ? "is-gold" : "is-ember")}>
                    {r.pace.daysAhead >= 0 ? <Icons.paceUp aria-hidden="true" {...SIZE_ROW} /> : <Icons.paceDown aria-hidden="true" {...SIZE_ROW} />}
                    ritmo <span className="num">{signed(r.pace.daysAhead)} d</span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      {rows.length === 0 && <EmptyState size="sm" tone="dashed" title="Sin asignaturas activas" description="Configura tus asignaturas del curso en Ajustes." />}
    </Section>
  );
}
