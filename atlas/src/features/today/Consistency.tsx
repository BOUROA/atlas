// Constancia (mapa de actividad) y Objetivos de la semana + reparto por asignatura.
import { useMemo } from "react";
import { weeklyDistribution } from "../../domain/game/weekly";
import type { WeeklyGoalId } from "../../domain/game/goals";
import { isoWeekDays } from "../../domain/game/goals";
import { XP_RULES } from "../../domain/game/xp";
import { addDays, dayKey, daysBetween } from "../../domain/time";
import type { UserState } from "../../domain/types";
import { catalog } from "../../state/catalog";
import type { Derived } from "../../state/derive-core";
import {
  Heatmap, ICON_SIZE, Icons, ProgressBar, Section, SegmentedBar, Tooltip, cx, minutes as fmtMinutes, num, plural, subjectAbbr,
} from "../../ui";
import { minutesByDay, wildcardsUsed } from "./helpers";

const SIZE_ROW = { size: ICON_SIZE.row.size, strokeWidth: ICON_SIZE.row.strokeWidth };
const SIZE_HEADER = { size: ICON_SIZE.header.size, strokeWidth: ICON_SIZE.header.strokeWidth };

/** Constancia: mapa de actividad de 20 semanas y cuatro cifras de fondo. */
export function ConsistencySection({ state, derived }: { state: UserState; derived: Derived }) {
  const values = useMemo(() => minutesByDay(state.events), [state.events]);
  const wildcards = useMemo(() => wildcardsUsed(derived.activeDays, derived.now), [derived.activeDays, derived.now]);

  const stats = useMemo(() => {
    const monthPrefix = dayKey(derived.now).slice(0, 7);
    let monthMinutes = 0;
    for (const [day, m] of Object.entries(values)) if (day.startsWith(monthPrefix)) monthMinutes += m;

    const start = addDays(derived.now, -20 * 7);
    let windowMinutes = 0;
    let windowActiveDays = 0;
    for (const [day, m] of Object.entries(values)) {
      if (Date.parse(day) < start.getTime() || m <= 0) continue;
      windowMinutes += m;
      windowActiveDays++;
    }
    return {
      monthMinutes,
      avgPerActiveDay: windowActiveDays > 0 ? windowMinutes / windowActiveDays : 0,
      bestStreak: derived.longestStreak,
      wildcards,
    };
  }, [values, derived.now, derived.longestStreak, wildcards]);

  return (
    <Section
      card
      aria-label="Constancia"
      title="Constancia"
      action={
        <>
          <Tooltip content="Últimas 20 semanas. Cada punto es un día: cuanto más brilla, más estudiaste.">
            <button type="button" className="today-info" aria-label="Cómo se lee el mapa de actividad">
              <Icons.help aria-hidden="true" {...SIZE_ROW} />
            </button>
          </Tooltip>
          <span className="today-t">
            <Icons.comodin aria-hidden="true" {...SIZE_ROW} className="today-moon" />
            comodín
          </span>
        </>
      }
    >
      <div className="today-heat">
        <Heatmap values={values} weeks={20} today={derived.now} aria-label="Minutos de estudio de las últimas 20 semanas" />
        <div className="today-heat-stats">
          <div className="today-stat">
            <Icons.duration aria-hidden="true" {...SIZE_HEADER} />
            <div>
              <div className="today-stat-v num">
                {num(Math.round(stats.monthMinutes / 60))}
                <small>h</small>
              </div>
              <div className="today-stat-k">este mes</div>
            </div>
          </div>
          <div className="today-stat">
            <Icons.duration aria-hidden="true" {...SIZE_HEADER} />
            <div>
              <div className="today-stat-v num">{fmtMinutes(stats.avgPerActiveDay)}</div>
              <div className="today-stat-k">por día activo</div>
            </div>
          </div>
          <div className="today-stat">
            <Icons.streak aria-hidden="true" {...SIZE_HEADER} />
            <div>
              <div className="today-stat-v num">
                {num(stats.bestStreak)}
                <small>d</small>
              </div>
              <div className="today-stat-k">mejor racha</div>
            </div>
          </div>
          <div className="today-stat">
            <Icons.comodin aria-hidden="true" {...SIZE_HEADER} className="today-moon" />
            <div>
              <div className="today-stat-v num">{num(stats.wildcards)}</div>
              <div className="today-stat-k">comodines</div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

const GOAL_ICON = { dias: "date", repasos: "review", nuevos: "newConcept" } as const satisfies Record<WeeklyGoalId, keyof typeof Icons>;
const GOAL_LABEL: Record<WeeklyGoalId, string> = { dias: "Días activos", repasos: "Repasos", nuevos: "Nuevos" };

/** Objetivos de la semana (cofre) y reparto del tiempo por asignatura. */
export function GoalsSection({ state, derived }: { state: UserState; derived: Derived }) {
  const days = isoWeekDays(derived.now);
  const daysLeft = Math.max(0, daysBetween(dayKey(derived.now), days[6]));
  const met = derived.goals.every((g) => g.value >= g.target);

  const distribution = useMemo(() => weeklyDistribution(catalog, state, derived.now), [state, derived.now]);
  const segments = distribution.bySubject
    .filter((s) => s.minutes > 0)
    .map((s) => ({ value: s.minutes, label: subjectAbbr(s.subjectId), subjectId: s.subjectId, id: s.subjectId }));
  const neglectedName = distribution.neglected ? catalog.subjectById.get(distribution.neglected)?.shortName ?? distribution.neglected : null;
  const neglectedMinutes = distribution.neglected ? distribution.bySubject.find((s) => s.subjectId === distribution.neglected)?.minutes ?? 0 : 0;

  return (
    <section className={cx("ui-card", "ui-pad--md", "today-goals-card")} aria-label="Objetivos de la semana">
      <div className="today-goals-col">
        <header className="today-goals-h">
          <h3 className="today-goals-title is-gold">
            <Icons.chest aria-hidden="true" {...SIZE_HEADER} />
            Cofre semanal
          </h3>
          <span className="today-t is-gold">
            <Icons.xp aria-hidden="true" {...SIZE_ROW} />
            {met ? "¡Cofre abierto!" : `+${num(XP_RULES.weeklyChest)} XP`}
          </span>
        </header>
        <div className="today-goal-list">
          {derived.goals.map((g) => {
            const GoalIcon = Icons[GOAL_ICON[g.id]];
            return (
              <div key={g.id} className="today-goal">
                <GoalIcon aria-hidden="true" {...SIZE_ROW} />
                <span>{GOAL_LABEL[g.id]}</span>
                <em>
                  <b className="num">{num(g.value)}</b> / {num(g.target)}
                </em>
                <ProgressBar value={g.value} max={g.target} size="xs" label={`${GOAL_LABEL[g.id]}: ${g.value} de ${g.target}`} />
              </div>
            );
          })}
        </div>
        <span className="today-t today-goal-days">
          <Icons.date aria-hidden="true" {...SIZE_ROW} />
          {daysLeft === 0 ? (
            "termina hoy"
          ) : (
            <>
              quedan <b className="num">{plural(daysLeft, "d", "d")}</b>
            </>
          )}
        </span>
      </div>

      <div className="today-goals-col">
        <header className="today-goals-h">
          <h3 className="today-goals-title">
            <Icons.subject aria-hidden="true" {...SIZE_HEADER} />
            Reparto
          </h3>
        </header>
        {segments.length > 0 ? (
          <>
            <SegmentedBar segments={segments} height={9} highlight={distribution.neglected ?? undefined} format={(v) => fmtMinutes(v)} />
            {neglectedName && (
              <p className="today-tutor-note">
                <i>
                  {neglectedName} solo suma {fmtMinutes(neglectedMinutes)} esta semana.
                </i>
              </p>
            )}
          </>
        ) : (
          <p className="today-tutor-note">
            <i>Todavía no has estudiado nada esta semana: cualquier asignatura es un buen sitio para empezar.</i>
          </p>
        )}
      </div>
    </section>
  );
}
