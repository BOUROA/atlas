// Vista "Agenda" (Bitácora): rumbo global por fecha, semana a semana, con la
// columna derecha de misión más cercana, seguimiento y resultados recientes.
import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { courseStartOf, nextObjectives, type RouteStep, type SubjectRoute } from "../../../domain/route";
import { addDays, dayKey } from "../../../domain/time";
import { catalog, trials } from "../../../state/catalog";
import { useUserState } from "../../../state/store";
import { useDerived, useRoutes } from "../../../state/derived";
import type { Derived } from "../../../state/derive-core";
import { href } from "../../../state/router";
import { Button, Card, EmptyState, ICON_SIZE, Icons, ProgressBar, Star, SubjectDot, Tooltip, capitalize, dateShort, month, pct, plural, pluralWord, weekday } from "../../../ui";
import { gradeNum } from "../helpers";
import {
  READY_RATIO, WEEK_WINDOW_DAYS, advanceCandidates, attemptContext, courseWeekOf, groupByDay, groupByWeek, nearestRealBoss, nextRealExamDate,
  recentTrialResults, routeStars, stepEyebrow, stepHeading, stepHref, subjectShort, subjectsIn, weekRangeLabel,
} from "./helpers";
import { LatePinned, StepRow } from "./StepRow";
import { Planet, RouteMark, stepStateLabel } from "./RouteMark";

/** Hoy sin nada que venza: una línea y, si hay un paso ya listo, la invitación a adelantarlo. */
function TodayFree({ routes, derived, lateCount }: { routes: readonly SubjectRoute[]; derived: Derived; lateCount: number }) {
  const candidate = lateCount === 0 ? advanceCandidates(routes, 1)[0] : undefined;
  const ready = candidate && candidate.readiness >= READY_RATIO ? candidate : undefined;
  return (
    <div className="rumbo-today-free">
      <Icons.done aria-hidden="true" />
      <p>
        Hoy no vence nada.
        {lateCount > 0 && " Buen día para recuperar lo atrasado."}
        {ready && (
          <>
            {" "}
            Puedes adelantar <b>{stepHeading(ready)}</b> ({subjectShort(ready.subjectId, catalog)}): ya está lista al {pct(ready.readiness)}.
          </>
        )}
      </p>
      {ready && (
        <Button variant="ghost" size="sm" icon={<ArrowRight />} href={href(stepHref(ready, catalog, derived.progress))}>
          Adelantar
        </Button>
      )}
    </div>
  );
}

function DayCell({ day, offset, steps, routes, derived, lateCount }: { day: string; offset: number; steps: RouteStep[]; routes: readonly SubjectRoute[]; derived: Derived; lateCount: number }) {
  const label = offset === 0 ? "Hoy" : weekday(day, "short");
  const dayNum = Number(day.slice(8, 10));
  const empty = steps.length === 0;
  return (
    <div className={`rumbo-day${offset === 0 ? " is-today" : ""}${empty ? " is-empty" : ""}`}>
      <div className="rumbo-day-label">
        <span className="mono-label">{label}</span>
        <b className="num">{dayNum}</b>
      </div>
      <div className="rumbo-day-body">
        {empty ? (
          offset === 0 ? (
            <TodayFree routes={routes} derived={derived} lateCount={lateCount} />
          ) : (
            <p className="tone-3 rumbo-day-free">Nada vence</p>
          )
        ) : (
          <ul className="rumbo-steps">
            {steps.map((s) => {
              const r = routes.find((rr) => rr.subjectId === s.subjectId);
              return r ? <StepRow key={s.key} route={r} step={s} derived={derived} /> : null;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Cuando no vence nada en 7 días: una línea y hasta 3 pasos ya listos (o los próximos) para adelantar. */
function AdvanceList({ routes, derived }: { routes: readonly SubjectRoute[]; derived: Derived }) {
  const candidates = advanceCandidates(routes, 3);
  const complete = candidates.length === 0;
  return (
    <div className="rumbo-advance">
      <p className="tone-3 rumbo-week-empty">
        <Icons.done aria-hidden="true" />
        {complete ? "Rumbo completo: solo quedan los exámenes." : "Nada vence esta semana."}
      </p>
      {candidates.length > 0 && (
        <>
          <p className="mono-label rumbo-advance-label">Puedes adelantar</p>
          <ul className="rumbo-steps">
            {candidates.map((s) => {
              const r = routes.find((rr) => rr.subjectId === s.subjectId);
              return r ? <StepRow key={s.key} route={r} step={s} derived={derived} /> : null;
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function WeekRow({ week, courseStart, expanded, onToggle }: { week: ReturnType<typeof groupByWeek>[number]; courseStart: string; expanded: boolean; onToggle: () => void }) {
  const n = courseWeekOf(week.start, courseStart);
  const panelId = `rumbo-week-${week.weekKey}`;
  return (
    <li className={`rumbo-week${week.heavy ? " is-heavy" : ""}${expanded ? " is-open" : ""}`}>
      <div className="rumbo-week-row">
        <button type="button" className="rumbo-week-head" onClick={onToggle} aria-expanded={expanded} aria-controls={expanded ? panelId : undefined}>
          <span className="mono-label rumbo-week-n">{n >= 1 ? `Sem ${n}` : ""}</span>
          <span className="rumbo-week-d">{weekRangeLabel(week.start, week.end)}</span>
          <span className="rumbo-week-c">
            <b className="num">{week.steps.length}</b> {pluralWord(week.steps.length, "paso", "pasos")}
          </span>
          <span className="rumbo-week-dots" aria-hidden="true">
            {subjectsIn(week.steps).map((id) => (
              <SubjectDot key={id} subjectId={id} />
            ))}
          </span>
          {week.simCount > 0 && <span className="tone-3 rumbo-week-sims">{plural(week.simCount, "simulacro", "simulacros")}</span>}
          <ChevronDown className="rumbo-week-chev" aria-hidden="true" />
        </button>
        {week.heavy && (
          <Tooltip content={`${plural(week.steps.length, "paso", "pasos")}${week.simCount > 0 ? ` y ${plural(week.simCount, "simulacro", "simulacros")}` : ""}. Adelanta un control.`}>
            <button type="button" className="rumbo-tag rumbo-tag--heavy rumbo-week-heavy">
              Semana cargada
            </button>
          </Tooltip>
        )}
      </div>
      {expanded && (
        <ul className="rumbo-week-steps" id={panelId}>
          {week.steps.map((s) => (
            <li key={s.key} className="rumbo-week-step">
              <RouteMark step={s} size={18} />
              <span className="rumbo-week-step-subj">
                <SubjectDot subjectId={s.subjectId} />
                {subjectShort(s.subjectId, catalog)}
              </span>
              <span className="rumbo-week-step-title">
                {stepHeading(s)} <span className="tone-3">· {stepEyebrow(s, catalog)}</span>
              </span>
              <span className="tone-3 mono-label rumbo-week-step-date">{dateShort(s.due)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ExamsGrid({ steps }: { steps: readonly RouteStep[] }) {
  if (steps.length === 0) return null;
  const first = steps[0].due;
  const last = steps[steps.length - 1].due;
  const allAssumed = steps.every((s) => s.assumed);
  return (
    <div className="rumbo-fin">
      <div className="rumbo-fin-head">
        <div>
          <p className="mono-label rumbo-fin-eyebrow">
            {first === last ? dateShort(first) : `${dateShort(first)} – ${dateShort(last)}`} · misiones principales
          </p>
          <h3 className="rumbo-fin-title">Exámenes reales</h3>
        </div>
        {allAssumed && (
          <Tooltip content="Fechas provisionales hasta que tengas la guía docente.">
            <button type="button" className="rumbo-tag rumbo-tag--muted">
              <Icons.provisional aria-hidden="true" width={ICON_SIZE.label.size} height={ICON_SIZE.label.size} strokeWidth={ICON_SIZE.label.strokeWidth} />
              Provisional
            </button>
          </Tooltip>
        )}
      </div>
      <ul className="rumbo-fin-grid">
        {steps.map((s) => (
          <li key={s.key}>
            <a className="rumbo-fx" href={href(`/asignatura/${s.subjectId}`)} aria-label={`${s.title} de ${subjectShort(s.subjectId, catalog)}, ${dateShort(s.due)}${s.assumed ? ", fecha provisional" : ""}`}>
              <Planet subjectId={s.subjectId} size={26} />
              <span className="rumbo-fx-main">
                <span className="rumbo-fx-d">
                  <span className="mono-label">{weekday(s.due, "short")}</span> <b className="num">{Number(s.due.slice(8, 10))}</b>{" "}
                  <span className="mono-label">{month(s.due, "short")}</span>
                </span>
                <span className="tone-3 mono-label num rumbo-fx-left">{s.daysLeft === 0 ? "hoy" : `${s.daysLeft} d`}</span>
              </span>
              <span className="rumbo-fx-n">
                {subjectShort(s.subjectId, catalog)}
                {s.assumed && !allAssumed && <span className="rumbo-fx-prov"> · provisional</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NearestBossCard({ boss }: { boss: { route: SubjectRoute; boss: RouteStep } | undefined }) {
  if (!boss) return null;
  const days = Math.max(0, boss.boss.daysLeft);
  return (
    <Card as="section" pad="md" className="rumbo-aside-card" aria-label="Misión principal más cercana">
      <p className="mono-label">Misión principal más cercana</p>
      <a className="rumbo-boss" href={href(`/asignatura/${boss.route.subjectId}`)}>
        <Planet subjectId={boss.route.subjectId} size={64} />
        <div className="rumbo-boss-t">
          <p className="mono-label rumbo-boss-eyebrow">
            {subjectShort(boss.route.subjectId, catalog)}
            {boss.boss.assumed ? " · fecha provisional" : ""}
          </p>
          <h3>{boss.boss.title}</h3>
          <p className="tone-2">
            {capitalize(weekday(boss.boss.due))} {Number(boss.boss.due.slice(8, 10))} de {month(boss.boss.due, "long")}
          </p>
        </div>
        <div className="rumbo-boss-n">
          {days === 0 ? (
            <b>Hoy</b>
          ) : (
            <>
              <b className="num">{days}</b>
              <span>{pluralWord(days, "día", "días")}</span>
            </>
          )}
        </div>
      </a>
      <div className="rumbo-boss-f">
        <span className="tone-3">Rumbo</span>
        <ProgressBar value={boss.route.done} max={boss.route.total || 1} tone="subject" subjectId={boss.route.subjectId} size="sm" label="Pasos hechos del rumbo" />
        <span>
          <b className="num">{boss.route.done}</b> de <b className="num">{boss.route.total}</b> pasos
        </span>
      </div>
    </Card>
  );
}

function OnTrackList({ routes }: { routes: readonly SubjectRoute[] }) {
  const onTrackCount = routes.filter((r) => r.onTrack).length;
  return (
    <Card as="section" pad="md" className="rumbo-aside-card" aria-labelledby="rumbo-ontrack-title">
      <p className="mono-label">Por asignatura</p>
      <div className="rumbo-aside-head">
        <h2 id="rumbo-ontrack-title">¿Vas al día?</h2>
        <p className="tone-3 rumbo-aside-meta">
          <b className="num">{onTrackCount}</b> de {routes.length} al día
        </p>
      </div>
      <ul className="rumbo-tracklist">
        {routes.map((r) => {
          const late = r.steps.filter((s) => s.status === "late").length;
          return (
            <li key={r.subjectId} className={`rumbo-track${late > 0 ? " is-late" : ""}`}>
              <span className="rumbo-track-a">
                <SubjectDot subjectId={r.subjectId} />
                {subjectShort(r.subjectId, catalog)}
              </span>
              <div className="rumbo-track-dots" aria-hidden="true">
                {r.steps.map((s) => (
                  <span key={s.key} title={`${stepEyebrow(s, catalog)} · ${stepStateLabel(s)}`}>
                    <RouteMark step={s} size={14} />
                  </span>
                ))}
              </div>
              <span className="rumbo-track-m tone-3">
                <b className="num">{r.done}</b> de {r.total} pasos · <span className="num">{routeStars(r)}</span>
                <Star state="mastered" size={10} className="rumbo-track-star" /> ·{" "}
                {late > 0 ? <span className="rumbo-late-word">{plural(late, "atrasado", "atrasados")}</span> : <span className="rumbo-ok-word">al día</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Filas máximas de "Resultados" (una por prueba, las más recientes). */
const MAX_RESULTS = 6;

function ResultsCard() {
  const state = useUserState((s) => s);
  const derived = useDerived();
  const all = recentTrialResults(trials, state, derived.now);
  const rows = all.slice(0, MAX_RESULTS);
  const rest = all.length - rows.length;
  return (
    <Card as="section" pad="md" className="rumbo-aside-card" aria-labelledby="rumbo-results-title">
      <p className="mono-label">Últimos 10 días</p>
      <h2 id="rumbo-results-title">Resultados</h2>
      {rows.length === 0 ? (
        <EmptyState size="sm" tone="dashed" title="Sin pruebas recientes" description="Aquí verás la nota de cada control o simulacro que corrijas." />
      ) : (
        <ul className="rumbo-results">
          {rows.map((row) => {
            const kind = row.trial.kind === "control" ? "control" : row.trial.kind === "parcial" ? "sim-parcial" : "sim-final";
            const heading = row.trial.title.includes(" · ") ? row.trial.title.slice(row.trial.title.indexOf(" · ") + 3) : row.trial.title;
            const kindLabel = row.trial.kind === "control" ? "Control" : row.trial.kind === "parcial" ? "Simulacro de parcial" : "Simulacro de final";
            return (
              <li key={row.trial.id}>
                <a className="rumbo-result-link" href={href(`/prueba/${encodeURIComponent(row.trial.id)}`)} aria-label={`${row.trial.title}: ${gradeNum(row.score)}`} />
                <RouteMark step={{ kind, status: "done", stars: row.stars, subjectId: row.trial.subjectId }} size={22} />
                <div className="rumbo-result-title">
                  <span className="rumbo-result-subj">
                    <SubjectDot subjectId={row.trial.subjectId} />
                    {subjectShort(row.trial.subjectId, catalog)} · {kindLabel.toLowerCase()}
                  </span>
                  <span className="rumbo-result-trial">{heading}</span>
                  <span className="tone-3 mono-label rumbo-result-meta">
                    {attemptContext(row, gradeNum)} · {dateShort(row.attempt.endedAt!)}
                  </span>
                </div>
                <div className="rumbo-result-score">
                  <span className="rumbo-score num">{gradeNum(row.score)}</span>
                  <span className="rumbo-stars" aria-label={`${row.stars} de 3 estrellas`}>
                    {[0, 1, 2].map((i) => (
                      <Star key={i} state={i < row.stars ? "mastered" : "unseen"} size={11} />
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rest > 0 && (
        <p className="tone-3 rumbo-results-more">
          Y {plural(rest, "prueba más", "pruebas más")} corregidas en estos días.
        </p>
      )}
    </Card>
  );
}

export function AgendaView() {
  const routes = useRoutes();
  const derived = useDerived();
  const courseStart = useUserState((s) => courseStartOf(s.settings));
  const now = derived.now;
  const today = dayKey(now);

  const allPending = nextObjectives(routes, Number.POSITIVE_INFINITY);
  const lateWithRoute = allPending
    .filter((s) => s.status === "late")
    .map((step) => ({ step, route: routes.find((r) => r.subjectId === step.subjectId)! }))
    .filter((x) => x.route)
    .sort((a, b) => (nextRealExamDate(a.route) ?? "9999-99-99").localeCompare(nextRealExamDate(b.route) ?? "9999-99-99") || a.step.due.localeCompare(b.step.due));

  // Los próximos 7 días incluyen los exámenes reales: un examen hoy es lo primero que hay que ver.
  const inNext7 = allPending.filter((s) => s.status !== "late" && s.daysLeft >= 0 && s.daysLeft <= WEEK_WINDOW_DAYS);
  const dayMap = new Map(groupByDay(inNext7).map((g) => [g.day, g.steps]));

  const later = allPending.filter((s) => s.kind !== "exam" && s.daysLeft > WEEK_WINDOW_DAYS);
  const weeks = groupByWeek(later);
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const toggleWeek = (key: string) =>
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const examSteps = allPending.filter((s) => s.kind === "exam").sort((a, b) => a.due.localeCompare(b.due));

  const boss = nearestRealBoss(routes);

  const totalSteps = routes.reduce((n, r) => n + r.total, 0);
  if (totalSteps === 0) {
    return <EmptyState title="Aún sin rumbo" description="Cuando el catálogo tenga temas y evaluaciones, aquí aparecerá el camino hacia tus misiones principales." />;
  }

  return (
    <div className="rumbo-grid">
      <div className="rumbo-col-main">
        <Card as="section" pad="md" aria-label="Agenda: rumbo global por fecha">
          <LatePinned routes={lateWithRoute} derived={derived} />

          <div className="rumbo-grp-h">
            <h3>Próximos 7 días</h3>
            <span className="tone-3 mono-label">
              {dateShort(today)} – {dateShort(dayKey(addDays(now, WEEK_WINDOW_DAYS)))}
            </span>
          </div>
          {inNext7.length === 0 ? (
            <AdvanceList routes={routes} derived={derived} />
          ) : (
            <div className="rumbo-days">
              {Array.from({ length: WEEK_WINDOW_DAYS + 1 }, (_, offset) => {
                const day = dayKey(addDays(now, offset));
                return <DayCell key={day} day={day} offset={offset} steps={dayMap.get(day) ?? []} routes={routes} derived={derived} lateCount={lateWithRoute.length} />;
              })}
            </div>
          )}

          {weeks.length > 0 && (
            <>
              <div className="rumbo-grp-h">
                <h3>Más adelante</h3>
                <span className="tone-3">abre una semana para ver sus pasos</span>
              </div>
              <ul className="rumbo-weeks">
                {weeks.map((w) => (
                  <WeekRow key={w.weekKey} week={w} courseStart={courseStart} expanded={openWeeks.has(w.weekKey)} onToggle={() => toggleWeek(w.weekKey)} />
                ))}
              </ul>
            </>
          )}

          <ExamsGrid steps={examSteps} />
        </Card>
      </div>
      <aside className="rumbo-col-aside" aria-label="Resumen del rumbo">
        <NearestBossCard boss={boss} />
        <OnTrackList routes={routes} />
        <ResultsCard />
      </aside>
    </div>
  );
}
