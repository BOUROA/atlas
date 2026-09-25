// Prueba · fase «Antes»: reglas, duración, preparación, acción y intentos anteriores.
import { useState } from "react";
import { Printer, Trash2 } from "lucide-react";
import { starsFor, trialReadiness, trialResult, trialScore } from "../../domain/trials";
import type { Trial, TrialAttempt, UserState } from "../../domain/types";
import { catalog } from "../../state/catalog";
import { hasNotes } from "../../state/notes";
import { href, openConcept } from "../../state/router";
import type { Derived } from "../../state/derive-core";
import { Button, Card, Dialog, ICON_SIZE, Icons, Ring, SubjectDot, dateLong, minutes, pct, plural } from "../../ui";
import { TRIAL_KIND_LABEL, TRIAL_LEVEL_LABEL, examMsOf, gradeNum, ptsNum, resumePhaseOf, trialUnitsLabel } from "./helpers";
import { TrialMd } from "./TrialMd";
import { TrialStars } from "./TrialStars";

/** Conceptos "aún no" que se enseñan antes de resumir con "y N más". */
const MISSING_SHOWN = 12;

export function TrialBefore({
  trial,
  state,
  derived,
  openAttempt,
  onStart,
  onContinue,
  onDiscard,
}: {
  trial: Trial;
  state: UserState;
  derived: Derived;
  openAttempt: TrialAttempt | undefined;
  onStart: () => void;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showAllMissing, setShowAllMissing] = useState(false);
  const subject = catalog.subjectById.get(trial.subjectId);
  const readiness = trialReadiness(trial, catalog, derived.progress);
  const result = trialResult(trial, state);
  const finished = (state.trials?.[trial.id] ?? [])
    .filter((a) => a.endedAt)
    .sort((a, b) => (a.endedAt! < b.endedAt! ? 1 : -1));
  const totalPoints = trial.problems.reduce((sum, p) => sum + p.points, 0);
  const missing = readiness.missing.map((id) => catalog.conceptById.get(id)).filter((c) => c !== undefined);
  const missingShown = showAllMissing ? missing : missing.slice(0, MISSING_SHOWN);
  // Cifra antes que frase (regla 3): "0/10 conceptos listos" en vez del % a secas.
  const totalConcepts = trial.unitIds.reduce((sum, id) => sum + (catalog.conceptsByUnit.get(id)?.length ?? 0), 0);
  const litConcepts = Math.max(0, totalConcepts - readiness.missing.length);
  const resumeCorrecting = openAttempt ? resumePhaseOf(openAttempt) === "correcting" : false;
  const openMin = openAttempt ? Math.max(0, Math.round((Date.now() - Date.parse(openAttempt.startedAt)) / 60_000)) : 0;
  const noteUnits = trial.unitIds.map((id) => catalog.unitById.get(id)).filter((u): u is NonNullable<typeof u> => !!u && hasNotes(u.id));

  return (
    <>
      <header className="trial-head">
        <p className="mono-label trial-head-eyebrow">
          <SubjectDot subjectId={trial.subjectId} />
          {subject?.shortName ?? trial.subjectId} · {TRIAL_KIND_LABEL[trial.kind]} · {TRIAL_LEVEL_LABEL[trial.level]}
        </p>
        <h1>{trial.title}</h1>
        <dl className="trial-head-meta">
          <div>
            <dt>Temas</dt>
            <dd>{trialUnitsLabel(trial, catalog) || "Todo el temario"}</dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>{minutes(trial.durationMin)}</dd>
          </div>
          <div>
            <dt>Problemas</dt>
            <dd>
              {trial.problems.length} · {ptsNum(totalPoints)} puntos
            </dd>
          </div>
        </dl>
        {noteUnits.length > 0 && (
          <div className="trial-notes-links">
            {noteUnits.map((u) => (
              <a key={u.id} className="trial-notes-link" href={href(`/apuntes/${u.id}`)}>
                <Icons.notes aria-hidden="true" {...ICON_SIZE.row} /> Apuntes · Tema {u.number}
              </a>
            ))}
          </div>
        )}
      </header>

      {trial.rules && (
        <Card tone="flat" className="trial-rules">
          <p className="mono-label">Reglas</p>
          <TrialMd size="sm">{trial.rules}</TrialMd>
        </Card>
      )}

      <Card className="trial-readiness">
        <Ring value={readiness.ratio} size={64} thickness={5} tone="subject" subjectId={trial.subjectId} aria-label={`Preparación: ${pct(readiness.ratio)}`} />
        <div className="trial-readiness-body">
          <p>
            <b className={readiness.ready ? "gold-text" : undefined}>{readiness.ready ? "Listo" : "Sin preparar"}</b>
            <span className="tone-3"> · {litConcepts}/{totalConcepts} conceptos listos</span>
          </p>
          {missing.length > 0 && (
            <details className="trial-missing-fold">
              <summary>Ver {plural(missing.length, "concepto sin nivel 2", "conceptos sin nivel 2")}</summary>
              <ul className="trial-missing" aria-label="Conceptos por debajo del nivel 2">
                {missingShown.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => openConcept(c.id)}>
                      {c.name}
                    </button>
                  </li>
                ))}
                {missing.length > missingShown.length && (
                  <li>
                    <button type="button" className="trial-missing-more" onClick={() => setShowAllMissing(true)}>
                      y {missing.length - missingShown.length} más
                    </button>
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      </Card>

      {openAttempt ? (
        <Card className="trial-open">
          <div className="trial-open-body">
            <p className="mono-label is-gold">{resumeCorrecting ? "Corrección a medias" : "Prueba en marcha"}</p>
            <p>
              {resumeCorrecting
                ? "Ya terminaste la prueba: te queda corregirla con la rúbrica. Lo que marcaste está guardado."
                : `${openMin < 1 ? "Acabas de empezar" : `Empezaste hace ${minutes(openMin)}`}. El cronómetro no se detiene al salir de la pantalla.`}
            </p>
          </div>
          <div className="trial-actions">
            <Button variant="primary" size="lg" icon={resumeCorrecting ? <Icons.submit /> : <Icons.session />} onClick={onContinue}>
              {resumeCorrecting ? "Seguir corrigiendo" : "Continuar"}
            </Button>
            {!resumeCorrecting && (
              <Button variant="ghost" icon={<Printer />} onClick={() => window.print()}>
                Imprimir
              </Button>
            )}
            <Button variant="quiet" icon={<Trash2 />} onClick={() => setConfirmDiscard(true)}>
              Descartar intento
            </Button>
          </div>
        </Card>
      ) : (
        <div className="trial-start">
          <div className="trial-actions">
            <Button variant="primary" size="lg" icon={finished.length > 0 ? <Icons.retry /> : <Icons.session />} onClick={onStart}>
              {finished.length > 0 ? "Repetir prueba" : "Empezar"}
            </Button>
            <Button variant="ghost" icon={<Printer />} onClick={() => window.print()}>
              Imprimir enunciado
            </Button>
          </div>
          <p className="trial-start-note">
            <Icons.duration aria-hidden="true" {...ICON_SIZE.row} /> {minutes(trial.durationMin)} desde que pulses «{finished.length > 0 ? "Repetir prueba" : "Empezar"}»
            {finished.length === 0 && " · Resuelve en papel o en VS Code y corrígete con la solución y la rúbrica."}
          </p>
        </div>
      )}

      {finished.length > 0 && (
        <Card className="trial-history-card">
          <div className="trial-history-top">
            <p className="mono-label">Intentos anteriores</p>
            <TrialStars count={result.stars} size={14} />
          </div>
          <p className="trial-summary-line">
            <span>
              Primer intento (tu nota honesta): <b className="num">{gradeNum(result.first!)}</b>
            </span>
            {result.attempts > 1 && (
              <span>
                Mejor: <b className="num">{gradeNum(result.best!)}</b>
              </span>
            )}
            <span className={result.passed ? "gold-text" : "tone-3"}>{result.passed ? "Superada" : "Aún no superada: hace falta un 7"}</span>
          </p>
          <ol className="trial-history" reversed>
            {finished.map((a) => {
              const score = trialScore(trial, a);
              return (
                <li key={a.id} className="trial-history-row">
                  <span className="trial-history-label">{dateLong(a.endedAt!)}</span>
                  <span className="trial-history-time num tone-3" title="Tiempo de examen">{minutes(Math.round(examMsOf(a) / 60_000))}</span>
                  <b className="num">{gradeNum(score)}</b>
                  <TrialStars count={starsFor(score)} size={12} />
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="¿Descartar el intento en marcha?"
        description={`Se borra por completo, con su tiempo y lo que hayas marcado en la corrección. No se puede deshacer.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)} data-autofocus>
              Cancelar
            </Button>
            <Button
              variant="ink"
              icon={<Trash2 />}
              onClick={() => {
                setConfirmDiscard(false);
                onDiscard();
              }}
            >
              Descartar intento
            </Button>
          </>
        }
      >
        <p className="trial-confirm-body">
          «{trial.title}» volverá a estar sin empezar{finished.length > 0 ? `; tus ${plural(finished.length, "intento anterior", "intentos anteriores")} no cambian` : ""}.
        </p>
      </Dialog>
    </>
  );
}
