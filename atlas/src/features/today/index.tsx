/**
 * Pantalla Hoy (#/hoy, inicio) · Task 3.
 *
 * export function TodayScreen(): JSX.Element — sin props.
 */
import { useEffect, useMemo, type ReactNode } from "react";
import "./today.css";
import { tutorHeadline } from "../../domain/tutor/headline";
import { dayKey } from "../../domain/time";
import { courseStartOf } from "../../domain/route";
import { catalog, currentSubjects } from "../../state/catalog";
import { useDayPlan, useDerived, useQueue, useRoutes } from "../../state/derived";
import { ensureDayPlan } from "../../state/actions";
import { useUserState } from "../../state/store";
import { openClassLog } from "../../state/ui";
import {
  Button, ICON_SIZE, Icons, Marker, Page, Star, capitalize, month, num, pct, plural, weekday,
} from "../../ui";
import { courseWeekInfo, minutesByDay, withCoolingCount } from "./helpers";
import { PlayerCard } from "./PlayerCard";
import { MissionChainSection } from "./MissionChain";
import { QueueSection } from "./SessionQueue";
import { MapSection, NearestSection, SubjectsSection } from "./MapSubjects";
import { ConsistencySection, GoalsSection } from "./Consistency";
import { UpcomingSection, AchievementsSection } from "./Sidebar";
import { RumboSection } from "./Rumbo";

const TERM_LABEL = "Primer cuatrimestre";

export function TodayScreen() {
  const state = useUserState((s) => s);
  const derived = useDerived();
  const queue = useQueue();
  const routes = useRoutes();
  const dayPlan = useDayPlan();
  useEffect(() => {
    ensureDayPlan();
  }, [dayPlan.stored, dayPlan.plan.day]);

  const now = derived.now;
  const courseStart = courseStartOf(state.settings);
  const week = useMemo(() => courseWeekInfo(now, courseStart, routes), [now, courseStart, routes]);
  const headline = useMemo(() => tutorHeadline({ index: catalog, state, queue, now }), [state, queue, now]);

  const stats = useMemo(() => {
    let total = 0;
    let seen = 0;
    let lit = 0;
    let cooling = 0;
    for (const s of currentSubjects) {
      for (const c of catalog.conceptsOfSubject(s.id)) {
        total++;
        const p = derived.progress.get(c.id);
        if (!p) continue;
        if (p.level >= 1) seen++;
        if (p.level >= 2) lit++;
        if (p.card && p.level >= 1 && (p.retrievability ?? 1) < state.settings.desiredRetention) cooling++;
      }
    }
    const monthPrefix = dayKey(now).slice(0, 7);
    const byDay = minutesByDay(state.events);
    let monthMinutes = 0;
    for (const [day, m] of Object.entries(byDay)) if (day.startsWith(monthPrefix)) monthMinutes += m;
    const avgDaily = monthMinutes / now.getDate();
    return { total, seen, lit, cooling, avgDaily };
  }, [state, derived.progress, now]);

  const tutorText = useMemo(() => withCoolingCount(headline, stats.cooling), [headline, stats.cooling]);

  const sessionSubjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of queue.planned) {
      const sid = catalog.conceptById.get(item.conceptId)?.subjectId;
      if (sid) ids.add(sid);
    }
    return [...ids];
  }, [queue.planned]);
  const sessionHighlight = useMemo(() => queue.planned.map((i) => i.conceptId), [queue.planned]);

  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <Page as="main" className="today-page">
      <section className="today-hello">
        <p className="mono-label today-eyebrow">
          {week.started ? `Semana ${num(week.week)} de ${num(week.weeks)}` : `Faltan ${plural(week.daysToStart, "día", "días")} para el inicio`}
          <span className="today-eyebrow-sep" aria-hidden="true" />
          {TERM_LABEL}
        </p>
        <h1 className="today-h1">
          {capitalize(weekday(now))}, <Marker animate>{now.getDate()} de {month(now, "long")}</Marker>
        </h1>
        <p className="today-tutor">
          {greeting}. {markTutorLine(tutorText)}
        </p>

        <div className="today-stats">
          <span className="today-stat-pill" title="Conceptos vistos">
            <Icons.seen aria-hidden="true" size={ICON_SIZE.button.size} strokeWidth={ICON_SIZE.button.strokeWidth} />
            <b className="num">{num(stats.seen)}</b> / {num(stats.total)} vistos
          </span>
          <span className="today-stat-pill" title="Temario encendido (nivel 2 o más)">
            <Star state="understood" size={13} />
            <b className="num">{num(stats.lit)}</b> encendidas · {pct(stats.total > 0 ? stats.lit / stats.total : 0)}
          </span>
          <span className="today-stat-pill is-cold" title="Conceptos por debajo de la retención deseada">
            <Icons.cooling aria-hidden="true" size={ICON_SIZE.button.size} strokeWidth={ICON_SIZE.button.strokeWidth} />
            <b className="num">{num(stats.cooling)}</b> se enfrían
          </span>
          <span className="today-stat-pill" title="Media diaria de estudio este mes">
            <Icons.duration aria-hidden="true" size={ICON_SIZE.button.size} strokeWidth={ICON_SIZE.button.strokeWidth} />
            <b className="num">{stats.avgDaily >= 60 ? `${(stats.avgDaily / 60).toFixed(1)} h` : `${Math.round(stats.avgDaily)} min`}</b> / día
          </span>
        </div>

        <Button
          variant="ghost"
          icon={<Icons.logClass size={ICON_SIZE.button.size} strokeWidth={ICON_SIZE.button.strokeWidth} />}
          kbd="N"
          onClick={openClassLog}
          className="today-classlog-btn"
        >
          Registrar clase
        </Button>
      </section>

      <MissionChainSection state={state} derived={derived} dayPlan={dayPlan} />

      <div className="today-grid">
        <div className="today-col-main">
          <QueueSection derived={derived} queue={queue} />
          <MapSection subjectIds={sessionSubjectIds} highlight={sessionHighlight} derived={derived} />
          <NearestSection state={state} derived={derived} />
          <SubjectsSection state={state} derived={derived} />
          <ConsistencySection state={state} derived={derived} />
          <GoalsSection state={state} derived={derived} />
        </div>
        <div className="today-col-aside">
          <PlayerCard derived={derived} now={now} />
          <RumboSection />
          <UpcomingSection state={state} derived={derived} />
          <AchievementsSection state={state} derived={derived} />
        </div>
      </div>
    </Page>
  );
}

const COOLING_PHRASE_RE = /rescatar (un concepto|\d+ conceptos) que se está(?:n)? apagando/;

/**
 * Titular del tutor: si habla de "rescatar N conceptos que se están apagando"
 * resalta la cifra en escarcha (misma cuenta que la ficha "se enfrían");
 * si no, subraya la primera asignatura del curso que menciona.
 */
function markTutorLine(text: string): ReactNode {
  const m = text.match(COOLING_PHRASE_RE);
  if (m && m.index != null) {
    const start = m.index + "rescatar ".length;
    const phrase = m[1];
    return (
      <>
        {text.slice(0, start)}
        <b className="today-cold-num">{phrase}</b>
        {text.slice(start + phrase.length)}
      </>
    );
  }
  return markSubjects(text);
}

/** Subraya con `Marker` la primera asignatura del curso que aparece en el titular del tutor. */
function markSubjects(text: string): ReactNode {
  for (const s of currentSubjects) {
    const i = text.indexOf(s.shortName);
    if (i < 0) continue;
    return (
      <>
        {text.slice(0, i)}
        <Marker subjectId={s.id}>{s.shortName}</Marker>
        {text.slice(i + s.shortName.length)}
      </>
    );
  }
  return text;
}
