// Prueba · enunciado para imprimir. Vive fuera de la app (portal en <body>):
// al imprimir, trial.css oculta todo lo demás, así que la hoja solo lleva la
// cabecera, las reglas y los enunciados, en tinta negra sobre blanco y sin
// soluciones. En pantalla no se ve.
import { createPortal } from "react-dom";
import type { Trial } from "../../domain/types";
import { catalog } from "../../state/catalog";
import { minutes, plural } from "../../ui";
import { TRIAL_KIND_LABEL, TRIAL_LEVEL_LABEL, ptsLabel, ptsNum, trialUnitsLabel } from "./helpers";
import { TrialMd } from "./TrialMd";

export function TrialPrint({ trial }: { trial: Trial }) {
  const subject = catalog.subjectById.get(trial.subjectId);
  const totalPoints = trial.problems.reduce((sum, p) => sum + p.points, 0);
  const units = trialUnitsLabel(trial, catalog);
  return createPortal(
    <div className="trial-print" aria-hidden="true">
      <header className="trial-print-head">
        <p className="trial-print-eyebrow">
          {subject?.name ?? trial.subjectId} · {TRIAL_KIND_LABEL[trial.kind]} · Nivel {TRIAL_LEVEL_LABEL[trial.level]}
        </p>
        <h1>{trial.title}</h1>
        <p className="trial-print-meta">
          {units ? `${units} · ` : ""}
          {minutes(trial.durationMin)} · {plural(trial.problems.length, "problema", "problemas")} · {ptsNum(totalPoints)} puntos
        </p>
        {trial.rules && <TrialMd size="sm" className="trial-print-rules">{trial.rules}</TrialMd>}
      </header>
      {trial.problems.map((p) => (
        <section key={p.n} className="trial-print-problem">
          <h2>
            Problema {p.n} <span>({ptsLabel(p.points)})</span>
          </h2>
          <TrialMd size="sm">{p.statement}</TrialMd>
        </section>
      ))}
    </div>,
    document.body,
  );
}
