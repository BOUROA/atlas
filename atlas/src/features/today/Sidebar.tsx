// Columna lateral de Hoy: próximas fechas (con la misión principal marcada
// en su fila, sin repetir el examen en una tarjeta aparte) y logros.
import { useMemo } from "react";
import { ACHIEVEMENT_BY_ID, ACHIEVEMENTS } from "../../domain/game/achievements";
import { examReadiness } from "../../domain/tutor/forecast";
import { upcomingAssessments } from "../../domain/tutor/queue";
import type { Assessment, UserState } from "../../domain/types";
import { catalog, expeditions, guides } from "../../state/catalog";
import { href } from "../../state/router";
import { useRoutes } from "../../state/derived";
import type { Derived } from "../../state/derive-core";
import { achievementIcon } from "../shell/achievementIcons";
import { Badge, EmptyState, ICON_SIZE, Icons, Ring, Section, SubjectTag, Button, cx, dateLong, pct } from "../../ui";
import { achievementProgress, nearestRealExam, nextAchievement } from "./helpers";

const SIZE_ROW = { size: ICON_SIZE.row.size, strokeWidth: ICON_SIZE.row.strokeWidth };

const KIND_LABEL: Record<Assessment["kind"], string> = {
  parcial: "Parcial", final: "Final", entrega: "Entrega", practica: "Práctica", otro: "Evaluación",
};

const TIMELINE_DAYS = 45;
const TL_W = 400;
const TL_X0 = 10;
const TL_X1 = TL_W - 10;

type Row = { assessment: Assessment; subjectId: string; days: number; expected: number };

/** Próximas fechas: línea temporal de 45 días + lista con la preparación prevista de cada evaluación.
 * La fila que coincide con la misión principal del rumbo lleva la ficha "principal". */
export function UpcomingSection({ state, derived }: { state: UserState; derived: Derived }) {
  const routes = useRoutes();
  const mainAssessmentId = useMemo(() => nearestRealExam(routes)?.boss.assessmentId, [routes]);

  const rows = useMemo<Row[]>(() => {
    const map = upcomingAssessments(catalog, state, derived.now);
    const flat: Row[] = [];
    for (const [subjectId, list] of map) {
      for (const up of list) {
        const r = examReadiness({ index: catalog, progress: derived.progress, scheduler: derived.scheduler, assessment: up.assessment });
        flat.push({ assessment: up.assessment, subjectId, days: up.days, expected: r.expected });
      }
    }
    return flat.sort((a, b) => a.days - b.days);
  }, [state, derived]);

  const onTimeline = rows.filter((r) => r.days <= TIMELINE_DAYS);

  return (
    <Section card aria-label="Próximas fechas" title="Próximas fechas">
      {rows.length === 0 ? (
        <EmptyState
          size="sm"
          tone="dashed"
          title="Aún no hay fechas"
          description="Añade los exámenes y entregas de tus asignaturas para que Atlas prepare la cola con tiempo."
          action={
            <Button variant="quiet" icon={<Icons.addAssessment {...SIZE_ROW} />} href={href("/asignaturas")}>
              Añadir evaluación
            </Button>
          }
        />
      ) : (
        <>
          {onTimeline.length > 0 && <Timeline rows={onTimeline} now={derived.now} />}
          <ul className="today-ex">
            {rows.slice(0, 6).map((r) => {
              const title = r.assessment.title || "Evaluación";
              const kind = KIND_LABEL[r.assessment.kind];
              const showKind = !title.toLocaleLowerCase("es-ES").includes(kind.toLocaleLowerCase("es-ES"));
              const isMain = r.assessment.id === mainAssessmentId;
              return (
                <li key={r.assessment.id}>
                  <div className={cx("today-ex-days", r.days <= 5 && "is-urgent", r.days > 5 && r.days <= 12 && "is-soon")}>
                    <b className="num">{r.days}</b>
                    <small>{r.days === 1 ? "día" : "días"}</small>
                  </div>
                  <div className="today-ex-body">
                    <p className="today-ex-t">
                      <Icons.exam aria-hidden="true" {...SIZE_ROW} />
                      {title}
                      {showKind && <span className="today-ex-k">{kind}</span>}
                      {isMain && (
                        <span className="today-t pill is-gold" title="Misión principal del rumbo">
                          <Icons.rumbo aria-hidden="true" {...SIZE_ROW} />
                          principal
                        </span>
                      )}
                    </p>
                    <p className="today-ex-s">
                      <SubjectTag subjectId={r.subjectId} variant="code" size="sm" />
                      {r.assessment.date && dateLong(r.assessment.date)}
                    </p>
                  </div>
                  <Ring value={r.expected} size={40} thickness={4} subjectId={r.subjectId} tone="subject" aria-label={`Preparación prevista: ${pct(r.expected)}`} />
                </li>
              );
            })}
          </ul>
          <div className="today-card-foot">
            <a className="today-link" href={href("/asignaturas")}>
              <Icons.addAssessment aria-hidden="true" {...SIZE_ROW} />
              Añadir evaluación
            </a>
          </div>
        </>
      )}
    </Section>
  );
}

function Timeline({ rows, now }: { rows: Row[]; now: Date }) {
  const x = (days: number) => TL_X0 + (Math.min(days, TIMELINE_DAYS) / TIMELINE_DAYS) * (TL_X1 - TL_X0);
  const endLabel = new Date(now);
  endLabel.setDate(endLabel.getDate() + TIMELINE_DAYS);
  return (
    <svg className="today-tl" viewBox={`0 0 ${TL_W} 34`} aria-hidden="true">
      <path d={`M${TL_X0} 17H${TL_X1}`} className="today-tl-base" />
      <circle cx={TL_X0} cy={17} r={4} className="today-tl-today" />
      <text x={TL_X0} y={32} className="today-tl-label">
        HOY
      </text>
      <text x={TL_X1} y={9} className="today-tl-label" textAnchor="end">
        {endLabel.toLocaleDateString("es-ES", { month: "short" }).toUpperCase()}
      </text>
      {rows.map((r) => (
        <circle key={r.assessment.id} cx={x(r.days)} cy={17} r={4} style={{ fill: `var(--s-${r.subjectId}, var(--gold))` }} />
      ))}
    </svg>
  );
}

/** Logros: próximo logro (más cerca de conseguirse) y los tres últimos conseguidos. */
export function AchievementsSection({ state, derived }: { state: UserState; derived: Derived }) {
  const earned = state.achievements;
  const earnedIds = useMemo(() => new Set(Object.keys(earned)), [earned]);
  const progressMap = useMemo(
    () =>
      achievementProgress({
        index: catalog, state, progress: derived.progress, longestStreak: derived.longestStreak,
        expeditions, guides,
      }),
    [state, derived],
  );
  const next = useMemo(() => nextAchievement(earnedIds, progressMap), [earnedIds, progressMap]);
  const recent = useMemo(
    () =>
      Object.entries(earned)
        .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
        .slice(0, 3)
        .map(([id, at]) => ({ id, at })),
    [earned],
  );
  const total = ACHIEVEMENTS.length;

  return (
    <Section
      card
      aria-label="Logros"
      title="Logros"
      action={
        <span className="today-card-aside">
          <span className="today-t">
            <Icons.badge aria-hidden="true" {...SIZE_ROW} />
            <b className="num">{earnedIds.size}</b> / {total}
          </span>
          <a className="today-link" href={href("/progreso")}>
            Todos
          </a>
        </span>
      }
    >
      {next && (
        <div className="today-next-badge">
          {(() => {
            const a = ACHIEVEMENT_BY_ID.get(next.id)!;
            const Icon = achievementIcon(a.icon);
            return (
              <Badge caption={false} size={78} icon={<Icon />} progress={next.ratio} label={a.title} sublabel={a.description} />
            );
          })()}
          <div>
            <p className="mono-label is-gold">
              <Icons.xp aria-hidden="true" {...SIZE_ROW} />
              Próximo logro · +{ACHIEVEMENT_BY_ID.get(next.id)!.xp} XP
            </p>
            <h4>{ACHIEVEMENT_BY_ID.get(next.id)!.title}</h4>
            <p className="today-next-desc">{ACHIEVEMENT_BY_ID.get(next.id)!.description}</p>
            <div className="today-steps" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <i key={i} className={i < Math.round(next.ratio * 3) ? "is-on" : undefined} />
              ))}
            </div>
          </div>
        </div>
      )}
      {!next && earnedIds.size > 0 && <p className="today-empty-line">Has conseguido todos los logros disponibles ahora mismo.</p>}
      {!next && earnedIds.size === 0 && (
        <EmptyState size="sm" tone="dashed" title="Tus primeras insignias" description="Empieza a estudiar hoy: el primer logro llega enseguida." />
      )}

      {recent.length > 0 && (
        <div className="today-recent">
          {recent.map(({ id, at }) => {
            const a = ACHIEVEMENT_BY_ID.get(id);
            if (!a) return null;
            const Icon = achievementIcon(a.icon);
            return <Badge key={id} size={52} icon={<Icon />} label={a.title} sublabel={a.description} meta={relAgo(at, derived.now)} />;
          })}
        </div>
      )}
    </Section>
  );
}

function relAgo(iso: string, now: Date): string {
  const days = Math.round((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "HOY";
  if (days === 1) return "AYER";
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleDateString("es-ES", { month: "short" }).toUpperCase().replace(".", "")}`;
}
