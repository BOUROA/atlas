/** Resumen final de la sesión (o al salir con Esc): XP, subidas de nivel,
 * variación por asignatura, estaciones encendidas, logros nuevos y racha. */
import { ArrowRight } from "lucide-react";
import { ACHIEVEMENT_BY_ID } from "../../domain/game/achievements";
import { catalog } from "../../state/catalog";
import { href, navigate } from "../../state/router";
import { achievementIcon } from "../shell/achievementIcons";
import { Badge, Button, Icons, InkCard, ProgressBar, SubjectTag, num, plural, pluralWord, pct, signed } from "../../ui";
import { MiniSky } from "../map/MiniSky";

export type SubjectDelta = { subjectId: string; before: number; after: number };

export function SessionSummary({
  xpEarned,
  reviewsDone,
  newDone,
  levelUps,
  subjectDeltas,
  touchedConceptIds,
  newAchievementIds,
  streakCurrent,
  nextReviewsCount,
}: {
  xpEarned: number;
  reviewsDone: number;
  newDone: number;
  levelUps: { from: number; to: number }[];
  subjectDeltas: SubjectDelta[];
  touchedConceptIds: string[];
  newAchievementIds: string[];
  streakCurrent: number;
  nextReviewsCount: number;
}) {
  const subjectIds = subjectDeltas.map((d) => d.subjectId);
  return (
    <InkCard className="session-card-wrap" aria-label="Resumen de la sesión">
      <p className="session-kind-tag">
        <Icons.done aria-hidden="true" /> Sesión terminada
      </p>
      <h1 className="session-name">
        {reviewsDone + newDone > 0
          ? `Has trabajado ${plural(reviewsDone + newDone, "concepto", "conceptos")}`
          : "Sesión cerrada sin registrar nada"}
      </h1>

      <div className="session-summary">
        <div className="session-summary-hero">
          <div>
            <span className="session-summary-xp">+{num(xpEarned)}</span>
            <small>XP EN ESTA SESIÓN</small>
          </div>
          <div className="session-summary-stats">
            <span><b>{num(reviewsDone)}</b> {pluralWord(reviewsDone, "repaso", "repasos")}</span>
            <span><b>{num(newDone)}</b> {pluralWord(newDone, "concepto nuevo", "conceptos nuevos")}</span>
            <span className="tone-2">
              <Icons.streak size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />
              racha de <b>{num(streakCurrent)}</b> {pluralWord(streakCurrent, "día", "días")}
            </span>
          </div>
        </div>

        {levelUps.length > 0 && (
          <div>
            <p className="session-block-title">Subes de nivel</p>
            <div className="session-levelups">
              {levelUps.map((l, i) => (
                <span key={i} className="session-levelup-chip">
                  Nivel {l.from} <ArrowRight size={13} aria-hidden="true" /> Nivel {l.to}
                </span>
              ))}
            </div>
          </div>
        )}

        {subjectDeltas.length > 0 && (
          <div>
            <p className="session-block-title">Iluminado por asignatura</p>
            <div className="session-subject-deltas">
              {subjectDeltas.map((d) => (
                <div key={d.subjectId} className="session-subject-delta">
                  <SubjectTag subjectId={d.subjectId} variant="name" size="sm" name={catalog.subjectById.get(d.subjectId)?.shortName} />
                  <ProgressBar className="session-subject-delta-track" value={d.after} tone="subject" subjectId={d.subjectId} label={`Iluminado de ${d.subjectId}`} />
                  <span className="session-subject-delta-val">
                    {pct(d.before)} → <b>{pct(d.after)}</b> ({signed(Math.round((d.after - d.before) * 100))} pp)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {touchedConceptIds.length > 0 && (
          <div>
            <p className="session-block-title">Estrellas encendidas hoy</p>
            <MiniSky subjectIds={subjectIds} highlight={touchedConceptIds} height={220} caption={`${plural(touchedConceptIds.length, "concepto trabajado", "conceptos trabajados")} en esta sesión`} />
          </div>
        )}

        {newAchievementIds.length > 0 && (
          <div>
            <p className="session-block-title">Insignias nuevas</p>
            <div className="session-badges">
              {newAchievementIds.map((id) => {
                const a = ACHIEVEMENT_BY_ID.get(id);
                if (!a) return null;
                const Icon = achievementIcon(a.icon);
                return <Badge key={id} label={a.title} sublabel={a.description} meta={`+${a.xp} XP`} icon={<Icon />} celebrate />;
              })}
            </div>
          </div>
        )}

        <p className="session-next">
          <Icons.date aria-hidden="true" />
          Próxima sesión: mañana, ~{plural(nextReviewsCount, "repaso", "repasos")}
        </p>
      </div>

      <footer className="session-summary-actions">
        <Button variant="primary" size="lg" icon={<ArrowRight />} onClick={() => navigate("/hoy")} data-autofocus>
          Volver a Hoy
        </Button>
        {touchedConceptIds.length > 0 && (
          <Button variant="ghost" href={href(`/mapa?foco=${encodeURIComponent(touchedConceptIds[0])}`)}>
            Ver en el mapa
          </Button>
        )}
      </footer>
    </InkCard>
  );
}

/** % de conceptos en nivel ≥ 2 de una asignatura (para la variación del resumen). */
export function subjectLitRatio(subjectId: string, progress: ReadonlyMap<string, { level: number }>): number {
  const concepts = catalog.conceptsOfSubject(subjectId);
  if (concepts.length === 0) return 0;
  const lit = concepts.filter((c) => (progress.get(c.id)?.level ?? 0) >= 2).length;
  return lit / concepts.length;
}
