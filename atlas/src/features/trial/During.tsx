// Prueba · fase «Durante»: cronómetro y enunciados, sin soluciones. Tranquila:
// solo el reloj (que se lee de un vistazo) y los problemas.
import { useEffect, useReducer, useState } from "react";
import type { Trial, TrialAttempt } from "../../domain/types";
import { catalog } from "../../state/catalog";
import { Button, Dialog, Icons, SubjectDot, cx, minutes } from "../../ui";
import { TRIAL_KIND_LABEL, formatClock, ptsLabel } from "./helpers";
import { TrialMd } from "./TrialMd";

/** Milisegundos transcurridos desde `startedAt`, recalculados cada segundo (y al volver a la pestaña). */
function useElapsed(startedAt: string): number {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return Math.max(0, Date.now() - Date.parse(startedAt));
}

/** Barra fija con el reloj: solo ella se repinta cada segundo. */
function TrialTimer({ trial, startedAt, onFinish }: { trial: Trial; startedAt: string; onFinish: () => void }) {
  const subject = catalog.subjectById.get(trial.subjectId);
  const elapsed = useElapsed(startedAt);
  const budgetMs = trial.durationMin * 60_000;
  const remaining = budgetMs - elapsed;
  const over = remaining < 0;
  const ratio = Math.min(1, elapsed / budgetMs);

  return (
    <div className={cx("trial-timer", over && "is-over")}>
      <div className="trial-timer-info">
        <p className="mono-label trial-timer-eyebrow">
          <SubjectDot subjectId={trial.subjectId} />
          <span className="trial-timer-eyebrow-text">
            {subject?.shortName ?? trial.subjectId} · {TRIAL_KIND_LABEL[trial.kind]}
          </span>
        </p>
        <h1 className="trial-timer-title">{trial.title}</h1>
      </div>
      <div className="trial-timer-clock-box" role="timer" aria-label={over ? "Tiempo agotado" : "Tiempo restante"}>
        <div className="trial-timer-clock num">{over ? `+${formatClock(-remaining)}` : formatClock(remaining)}</div>
        <p className="trial-timer-sub">{over ? "tiempo agotado: sigue contando" : `de ${minutes(trial.durationMin)} previstos`}</p>
      </div>
      <Button variant="ink" size="sm" icon={<Icons.submit />} className="trial-timer-finish" onClick={onFinish}>
        Terminar
      </Button>
      <span className="trial-timer-track" aria-hidden="true">
        <span style={{ transform: `scaleX(${ratio})` }} />
      </span>
    </div>
  );
}

export function TrialDuring({ trial, attempt, onFinish }: { trial: Trial; attempt: TrialAttempt; onFinish: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const askFinish = () => {
    const left = trial.durationMin * 60_000 - (Date.now() - Date.parse(attempt.startedAt));
    if (left > 0) setConfirm(true);
    else onFinish();
  };
  const leftMin = Math.max(0, Math.ceil((trial.durationMin * 60_000 - (Date.now() - Date.parse(attempt.startedAt))) / 60_000));

  return (
    <>
      <TrialTimer trial={trial} startedAt={attempt.startedAt} onFinish={askFinish} />

      {trial.rules && (
        <div className="trial-rules-reminder">
          <TrialMd size="sm">{trial.rules}</TrialMd>
        </div>
      )}

      <ol className="trial-problems">
        {trial.problems.map((p) => (
          <li key={p.n} className="trial-problem">
            <h2 className="trial-problem-head">
              <span className="trial-problem-n">Problema {p.n}</span>
              <span className="trial-problem-pts">{ptsLabel(p.points)}</span>
            </h2>
            <TrialMd>{p.statement}</TrialMd>
          </li>
        ))}
      </ol>

      <div className="trial-actions trial-actions--end">
        <Button variant="primary" size="lg" icon={<Icons.submit />} onClick={askFinish}>
          Terminar y corregir
        </Button>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Terminar la prueba?"
        description={`Aún te quedan ${minutes(leftMin)}. Al corregir verás las soluciones, así que este intento ya no se puede retomar.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} data-autofocus>
              Seguir con la prueba
            </Button>
            <Button
              variant="primary"
              icon={<Icons.submit />}
              onClick={() => {
                setConfirm(false);
                onFinish();
              }}
            >
              Terminar y corregir
            </Button>
          </>
        }
      />
    </>
  );
}
