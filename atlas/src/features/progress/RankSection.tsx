// Cabecera de Progreso: nivel, rango, XP y camino de rangos astronómicos.
import { RANKS } from "../../domain/game/levels";
import type { Derived } from "../../state/derive-core";
import { ProgressBar, RankGlyph, cx, num } from "../../ui";

const RANK_START = (i: number) => i * 5 + 1;

export function RankSection({ derived }: { derived: Derived }) {
  const { level, rank, xp } = derived;
  const rankIndex = Math.max(0, Math.min(RANKS.length - 1, Math.floor((level.level - 1) / 5)));

  return (
    <section className={cx("ui-card", "ui-pad--md", "progress-rank")} aria-label="Tu nivel">
      <div className="progress-rank-head">
        <div className="progress-rank-emblem" aria-hidden="true">
          <RankGlyph rank={rankIndex} state="now" size={52} />
        </div>
        <div className="progress-rank-id">
          <p className="mono-label is-gold">Rango · {rank}</p>
          <h1 className="progress-rank-level">Nivel {level.level}</h1>
        </div>
        <div className="progress-rank-tot">
          <span>XP total</span>
          <b className="num">{num(xp.total)}</b>
        </div>
      </div>

      <div className="progress-rank-xp">
        <ProgressBar size="lg" value={level.into} max={level.needed} cap={level.level + 1} label={`${level.into} de ${level.needed} XP del nivel ${level.level}`} />
        <div className="progress-rank-xp-l">
          <b className="num">{num(level.into)}</b> / {num(level.needed)} XP hasta el nivel {level.level + 1}
        </div>
      </div>

      <div className="progress-ladder" aria-label="Rangos astronómicos">
        {RANKS.map((name, i) => (
          <div key={name} className={cx("progress-rk", i < rankIndex && "is-done", i === rankIndex && "is-now")}>
            <RankGlyph rank={i} state={i < rankIndex ? "done" : i === rankIndex ? "now" : "todo"} size={26} title={name} />
            <span>{name}</span>
            <small className="num">Nivel {RANK_START(i)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
