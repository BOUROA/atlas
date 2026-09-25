// Tarjeta de jugador (columna lateral de Hoy): nivel, rango, XP, racha,
// comodín y días activos de la semana. Solo lectura de useDerived().
import { RANKS } from "../../domain/game/levels";
import { isoWeekDays } from "../../domain/game/goals";
import { dayKey } from "../../domain/time";
import type { Derived } from "../../state/derive-core";
import { ICON_SIZE, Icons, ProgressBar, RankGlyph, cx, num, weekday } from "../../ui";


const RANK_START = (i: number) => i * 5 + 1;

export function PlayerCard({ derived, now }: { derived: Derived; now: Date }) {
  const { level, rank, xp, streak } = derived;
  const rankIndex = Math.max(0, Math.min(RANKS.length - 1, Math.floor((level.level - 1) / 5)));
  const todayXp = Math.min(level.into, xp.byDay[dayKey(now)] ?? 0);
  const days = isoWeekDays(now);

  return (
    <section className={cx("ui-card", "ui-pad--md", "today-player")} aria-label="Tu nivel">
      <div className="today-player-head">
        <div className="today-player-emblem" aria-hidden="true">
          <RankGlyph rank={rankIndex} state="now" size={40} />
        </div>
        <div className="today-player-id">
          <p className="mono-label is-gold">{rank}</p>
          <h3>Nivel {level.level}</h3>
        </div>
        <div className="today-player-tot" title="XP total">
          <Icons.xp aria-hidden="true" size={ICON_SIZE.row.size} strokeWidth={ICON_SIZE.row.strokeWidth} />
          <b className="num">{num(xp.total)}</b>
        </div>
      </div>

      <div className="today-player-xp">
        <ProgressBar
          size="lg"
          value={level.into}
          max={level.needed}
          today={todayXp}
          cap={level.level + 1}
          label={`${level.into} de ${level.needed} XP del nivel ${level.level}`}
        />
        <div className="today-player-xp-l">
          <span>
            <b className="num">{num(level.into)}</b> / {num(level.needed)} XP
          </span>
          {todayXp > 0 && (
            <span className="today-gold">
              hoy <b className="num">+{num(todayXp)}</b>
            </span>
          )}
        </div>
      </div>

      <div className="today-ladder" aria-label="Rangos astronómicos">
        {RANKS.map((name, i) => (
          <div key={name} className={cx("today-rk", i < rankIndex && "is-done", i === rankIndex && "is-now")}>
            <RankGlyph rank={i} state={i < rankIndex ? "done" : i === rankIndex ? "now" : "todo"} size={22} title={name} />
            <span>{name.split(" ")[0]}</span>
            <small className="num">{RANK_START(i)}</small>
          </div>
        ))}
      </div>

      <div className="today-player-stats">
        <div>
          <div className="today-player-stat-v">
            <Icons.streak className={cx("today-flame", streak.activeToday && "is-lit")} aria-hidden="true" />
            <span className="num">{num(streak.current)}</span>
            <small>{streak.current === 1 ? "día" : "días"}</small>
          </div>
          <div className="today-player-stat-k">racha{streak.activeToday ? " · hoy hecha" : " · hoy pendiente"}</div>
        </div>
        <div>
          <div className="today-player-stat-v">
            <Icons.comodin className="today-moon" aria-hidden="true" />
            <span className="num">{num(streak.freezesUsed)}</span>
            <small>{streak.freezesUsed === 1 ? "comodín" : "comodines"}</small>
          </div>
          <div className="today-player-stat-k">en esta racha, sin perderla</div>
        </div>
      </div>

      <div className="today-week">
        <div className="today-week-days" aria-label="Días activos esta semana">
          {days.map((d) => (
            <WeekDay key={d} day={d} now={now} active={derived.activeDays.has(d)} />
          ))}
        </div>
        <p className="today-week-t">
          <b className="num">{days.filter((d) => derived.activeDays.has(d)).length}</b> / 7 activos
        </p>
      </div>
    </section>
  );
}

function WeekDay({ day, now, active }: { day: string; now: Date; active: boolean }) {
  const d = new Date(day + "T00:00:00");
  const isToday = d.toDateString() === now.toDateString();
  const isFuture = d.getTime() > now.getTime() && !isToday;
  const letter = weekday(d, "initial");
  return (
    <span
      className={cx("today-dd", active && "is-ok", isToday && "is-now", isFuture && "is-future")}
      role="img"
      aria-label={`${weekday(d)}${active ? ", activo" : isFuture ? ", aún no llega" : ", sin actividad"}`}
      title={weekday(d)}
    >
      {letter}
    </span>
  );
}
