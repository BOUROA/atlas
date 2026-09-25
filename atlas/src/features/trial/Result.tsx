// Prueba · fase «Resultado»: nota, veredicto frente al 7 del rumbo, estrellas,
// primer intento frente a mejor nota, efecto en conceptos y siguiente paso.
import type { SubjectRoute } from "../../domain/route";
import { TRIAL_PASS, starsFor, trialResult, trialScore } from "../../domain/trials";
import type { StudyEvent, Trial, TrialAttempt, UserState } from "../../domain/types";
import { catalog } from "../../state/catalog";
import { href, openConcept } from "../../state/router";
import { Button, Card, Icons, ProgressBar, SubjectDot, minutes } from "../../ui";
import {
  ROUTE_STEP_LABEL,
  earnedOf,
  examMsOf,
  failedConceptIds,
  gradeNum,
  nextStepOf,
  ptsLabel,
  ptsNum,
  someProblemBelowHalf,
  stepCtaHref,
  trialEffect,
  type TrialEffectItem,
} from "./helpers";
import { TrialStars } from "./TrialStars";

/** Umbrales de las estrellas (dominio: starsFor). */
const STAR_AT = [TRIAL_PASS, 8.5, 9.5];

function reviewHref(ids: readonly string[]): string {
  return `/sesion?ids=${ids.map(encodeURIComponent).join(",")}`;
}

function ConceptChips({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <p className="tone-3 trial-effect-none">Ninguno esta vez.</p>;
  return (
    <ul className="trial-effect-chips is-good">
      {ids.map((id) => {
        const c = catalog.conceptById.get(id);
        if (!c) return null;
        return (
          <li key={id}>
            <button type="button" onClick={() => openConcept(id)}>
              {c.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "A repasar": primero los ya vistos (bajan de nivel), luego los aún no vistos, con una etiqueta discreta. */
function ReviewChips({ items, anyBelowHalf }: { items: TrialEffectItem[]; anyBelowHalf: boolean }) {
  if (items.length === 0) return anyBelowHalf ? null : <p className="tone-3 trial-effect-none">Ninguno esta vez.</p>;
  const sorted = [...items.filter((i) => !i.unseen), ...items.filter((i) => i.unseen)];
  return (
    <ul className="trial-effect-chips is-warn">
      {sorted.map(({ conceptId, unseen }) => {
        const c = catalog.conceptById.get(conceptId);
        if (!c) return null;
        return (
          <li key={conceptId}>
            <button type="button" onClick={() => openConcept(conceptId)}>
              {c.name}
              {unseen && <em className="trial-chip-tag">sin ver aún</em>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function TrialResult({
  trial,
  state,
  routes,
  graded,
  onBackToTrial,
}: {
  trial: Trial;
  state: UserState;
  routes: readonly SubjectRoute[];
  graded: { attempt: TrialAttempt; events: StudyEvent[] };
  onBackToTrial: () => void;
}) {
  const subject = catalog.subjectById.get(trial.subjectId);
  const score = trialScore(trial, graded.attempt);
  const stars = starsFor(score);
  const result = trialResult(trial, state);
  const effect = trialEffect(trial, graded.attempt, graded.events);
  const failedIds = failedConceptIds(effect, catalog);
  const anyBelowHalf = someProblemBelowHalf(trial, graded.attempt);
  const next = nextStepOf(routes, trial.subjectId);
  const isFirst = result.attempts <= 1;
  const passedNow = score >= TRIAL_PASS;
  // El "siguiente paso" no puede ser la prueba que se acaba de fallar: en ese
  // caso se ofrece repasar lo fallado en vez de un enlace a sí misma.
  const nextIsThisFailed = next?.trialId === trial.id && !result.passed;
  const nextStar = STAR_AT.find((t) => score < t);
  // Una sola acción protagonista: repasar si la prueba sigue sin superar; si no, el siguiente paso.
  const primary: "review" | "next" | "rumbo" =
    !result.passed && failedIds.length > 0 ? "review" : next && !nextIsThisFailed ? "next" : "rumbo";

  const usedMin = Math.round(examMsOf(graded.attempt) / 60_000);
  const overTime = usedMin > trial.durationMin;

  let verdict: string;
  if (passedNow) verdict = isFirst ? "Superada a la primera" : "Superada";
  else if (result.passed) verdict = "Esta vez no llega al 7, pero ya la tenías superada";
  else verdict = `Aún no superada: hace falta un ${TRIAL_PASS}`;

  let detail: string;
  if (score >= 10) detail = "Todo perfecto. No queda nada que sumar.";
  else if (nextStar !== undefined && passedNow) detail = `La siguiente estrella llega con un ${gradeNum(nextStar)}: te faltan ${gradeNum(Math.round((nextStar - score) * 100) / 100)}.`;
  else if (!passedNow && result.passed) detail = `Cuenta tu mejor nota, ${gradeNum(result.best!)}: el paso del rumbo sigue hecho.`;
  else if (!passedNow) detail = `Te faltan ${gradeNum(Math.round((TRIAL_PASS - score) * 100) / 100)} puntos. Repasa lo fallado y vuelve a intentarlo: cuenta tu mejor nota.`;
  else detail = "Tres estrellas: nivel de examen.";

  return (
    <>
      <header className="trial-head">
        <p className="mono-label trial-head-eyebrow">
          <SubjectDot subjectId={trial.subjectId} />
          {subject?.shortName ?? trial.subjectId} · Resultado
        </p>
        <h1>{trial.title}</h1>
      </header>

      <Card className={`trial-result-head ${passedNow ? "is-pass" : "is-fail"}`}>
        <div className="trial-result-score">
          <div className="trial-result-grade num">{gradeNum(score)}</div>
          <TrialStars count={stars} size={20} className="trial-result-stars" />
        </div>
        <div className="trial-result-body">
          <p className={`trial-result-verdict ${passedNow || result.passed ? "gold-text" : ""}`}>{verdict}</p>
          <p className="tone-2">{detail}</p>
          <dl className="trial-result-facts">
            {isFirst ? (
              <div>
                <dt>Primer intento</dt>
                <dd>esta es tu nota honesta</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>Primer intento</dt>
                  <dd className="num">{gradeNum(result.first!)}</dd>
                </div>
                <div>
                  <dt>Mejor</dt>
                  <dd className="num">{gradeNum(result.best!)}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Tiempo</dt>
              <dd>
                <span className="num">{minutes(usedMin)}</span> de {minutes(trial.durationMin)}
                {overTime ? <span className="ember-text"> · te has pasado</span> : null}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <p className="mono-label" style={{ marginBottom: 12 }}>
          Por problema
        </p>
        <div className="trial-result-bars">
          {trial.problems.map((p) => {
            const earned = earnedOf(p.points, graded.attempt.earned[p.n]);
            return (
              <div key={p.n} className="trial-result-bar-row">
                <span className="trial-result-bar-n">{p.n}</span>
                <ProgressBar
                  className="trial-result-bar-track"
                  value={earned}
                  max={p.points}
                  tone={earned / p.points >= 0.5 ? "gold" : "ember"}
                  label={`Problema ${p.n}: ${ptsNum(earned)} de ${ptsLabel(p.points)}`}
                />
                <span className="trial-result-bar-val num">
                  {ptsNum(earned)}/{ptsNum(p.points)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="trial-effect">
        <div>
          <p className="mono-label is-gold trial-effect-group-title">Reforzados</p>
          <ConceptChips ids={effect.reforzados} />
        </div>
        <div>
          <p className="mono-label trial-effect-group-title">A repasar</p>
          <ReviewChips items={effect.aRepasar} anyBelowHalf={anyBelowHalf} />
        </div>
      </Card>

      {next && !nextIsThisFailed && (
        <Card className="trial-next-step">
          <div className="trial-next-step-body">
            <p className="mono-label">Siguiente paso del rumbo · {ROUTE_STEP_LABEL[next.kind]}</p>
            <p>
              <b>{next.title}</b>
            </p>
          </div>
          <Button variant={primary === "next" ? "primary" : "ink"} iconEnd={<Icons.open />} href={href(stepCtaHref(next))}>
            Ir al siguiente paso
          </Button>
        </Card>
      )}
      {next && nextIsThisFailed && (
        <Card tone="flat" className="trial-next-step">
          <div className="trial-next-step-body">
            <p className="mono-label">Tu rumbo sigue aquí</p>
            <p>
              Este es tu siguiente paso: repasa lo que ha fallado y repite la prueba cuando esos conceptos estén encendidos. Cuenta tu mejor nota.
            </p>
          </div>
        </Card>
      )}

      <div className="trial-actions">
        {failedIds.length > 0 && (
          <Button variant={primary === "review" ? "primary" : "ink"} icon={<Icons.review />} href={href(reviewHref(failedIds))}>
            Repasar lo fallado
          </Button>
        )}
        <Button variant={primary === "rumbo" ? "primary" : "ghost"} icon={<Icons.rumbo />} href={href("/misiones")}>
          Volver al rumbo
        </Button>
        <Button variant="ghost" onClick={onBackToTrial}>
          Ver la prueba de nuevo
        </Button>
      </div>
    </>
  );
}
