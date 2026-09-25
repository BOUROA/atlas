// Pestaña "Pruebas": todas las pruebas sintéticas (controles por tema y
// simulacros), por asignatura, para hacerlas cuando se quiera; el Rumbo solo
// les pone fecha. Arriba, la recomendada ahora (la más preparada sin superar).
import { useMemo } from "react";
import { Check, Play } from "lucide-react";
import type { Trial, TrialKind, UserState } from "../../../domain/types";
import { trialReadiness, trialResult, TRIAL_PASS, type TrialResult } from "../../../domain/trials";
import type { Readiness } from "../../../domain/expeditions";
import { catalog, currentSubjects, trials, trialsBySubject } from "../../../state/catalog";
import { hasNotes } from "../../../state/notes";
import { useDerived } from "../../../state/derived";
import { useUserState } from "../../../state/store";
import { href } from "../../../state/router";
import { Button, EmptyState, ICON_SIZE, Icons, IconButton, Ring, SubjectDot, Tooltip, cx, pct, subjectName } from "../../../ui";
import { gradeNum } from "../helpers";

const KIND_RANK: Record<TrialKind, number> = { control: 0, parcial: 1, final: 2 };
const LEVEL_LABEL: Record<number, string> = { 1: "Rodaje", 2: "Universidad", 3: "Exigente", 4: "Máximo" };
const KIND_LABEL: Record<TrialKind, string> = { control: "Control de tema", parcial: "Simulacro de parcial", final: "Simulacro de final" };

type Row = { trial: Trial; result: TrialResult; readiness: Readiness; open: boolean; unitNumber: number };

const unitNumberOf = (t: Trial) => catalog.unitById.get(t.unitIds[0] ?? "")?.number ?? 0;

/** Título de la fila: el tema para un control, el título de la prueba para un simulacro. */
function rowTitle(t: Trial): string {
  if (t.kind !== "control") return t.title;
  const unit = catalog.unitById.get(t.unitIds[0] ?? "");
  return unit ? `Tema ${unit.number} · ${unit.title}` : t.title;
}

/** Duración y problemas: solo se muestra en simulacros (en los controles, siempre 40′ · 4, no aporta). */
function rowSource(t: Trial): string | null {
  if (t.kind === "control") return null;
  const n = t.problems.length;
  return `${LEVEL_LABEL[t.level]} · ${t.durationMin} min · ${n} ${n === 1 ? "problema" : "problemas"}`;
}

/** Preparación de una prueba, en pocas palabras: oculta si es 0 %, "lista" si es 100 %, si no "falta N %". */
function readinessLabel(ratio: number): string | null {
  if (ratio <= 0) return null;
  if (ratio >= 1) return "lista";
  return `falta ${100 - Math.round(ratio * 100)} %`;
}

function LevelMarks({ level }: { level: number }) {
  return (
    <span className="rumbo-diff" role="img" aria-label={`Nivel ${level} de 4: ${LEVEL_LABEL[level]}`}>
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={i <= level ? "is-on" : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

function TrialRow({ row, recommended }: { row: Row; recommended: boolean }) {
  const { trial, result, readiness, open } = row;
  const state = result.passed
    ? `superada, mejor nota ${gradeNum(result.best!)}`
    : result.best != null
      ? `mejor nota ${gradeNum(result.best)}, aún sin superar`
      : "sin intentos";
  const source = rowSource(trial);
  const readyLabel = readinessLabel(readiness.ratio);
  const noteUnit = trial.kind === "control" ? catalog.unitById.get(trial.unitIds[0] ?? "") : undefined;
  return (
    <li className={cx("rumbo-rung", recommended && "is-next", result.passed && "is-passed")}>
      <a
        className="missions-card-link"
        href={href(`/prueba/${trial.id}`)}
        aria-label={`${rowTitle(trial)} · ${KIND_LABEL[trial.kind].toLowerCase()}, ${state}, preparación ${pct(readiness.ratio)}${recommended ? ", recomendada" : ""}`}
      />
      <LevelMarks level={trial.level} />
      <p className="rumbo-rung-main">
        <span className="rumbo-rung-title">
          {result.passed && <Check className="rumbo-rung-check" aria-hidden="true" />}
          {recommended && !open && <span className="rumbo-rung-dot" aria-hidden="true" />}
          {rowTitle(trial)}
        </span>
        {source && <span className="rumbo-rung-src">{source}</span>}
        {!source && noteUnit && hasNotes(noteUnit.id) && (
          <a className="rumbo-rung-notes" href={href(`/apuntes/${noteUnit.id}`)}>
            <Icons.notes aria-hidden="true" size={ICON_SIZE.label.size} /> Apuntes
          </a>
        )}
      </p>
      <span className="rumbo-rung-stats">
        <span
          className="rumbo-rung-score"
          title={result.best != null ? `Mejor nota · primer intento ${gradeNum(result.first!)}` : "Sin intentos"}
        >
          {result.best != null ? (
            <b className={cx("num", result.passed && "gold-text")}>{gradeNum(result.best)}</b>
          ) : (
            <span className="rumbo-rung-none">—</span>
          )}
        </span>
        {readyLabel && (
          <span className="rumbo-rung-ready" title={`Preparación: ${pct(readiness.ratio)} de los conceptos de sus temas a nivel 2 o más`}>
            <Ring value={readiness.ratio} size={16} thickness={2.5} label={null} animate={false} />
            {readyLabel}
          </span>
        )}
        <span className="rumbo-rung-end">
          {open && (
            <span className="rumbo-tag rumbo-tag--heavy">
              <Icons.inProgress size={ICON_SIZE.label.size} aria-hidden="true" /> En curso
            </span>
          )}
        </span>
      </span>
    </li>
  );
}

function rowsOf(list: readonly Trial[], state: UserState, progress: ReturnType<typeof useDerived>["progress"]): Row[] {
  return list
    .map((trial) => ({
      trial,
      result: trialResult(trial, state),
      readiness: trialReadiness(trial, catalog, progress),
      open: (state.trials?.[trial.id] ?? []).some((a) => !a.endedAt),
      unitNumber: unitNumberOf(trial),
    }))
    .sort((a, b) => KIND_RANK[a.trial.kind] - KIND_RANK[b.trial.kind] || a.unitNumber - b.unitNumber || a.trial.level - b.trial.level);
}

/**
 * La prueba recomendada ahora: la de mayor preparación entre las no superadas
 * (a igualdad, primero los controles y los temas más tempranos). Si hay una en
 * curso, esa.
 */
function recommendedOf(rows: readonly Row[]): Row | undefined {
  const open = rows.find((r) => r.open);
  if (open) return open;
  return [...rows]
    .filter((r) => !r.result.passed)
    .sort(
      (a, b) =>
        b.readiness.ratio - a.readiness.ratio ||
        KIND_RANK[a.trial.kind] - KIND_RANK[b.trial.kind] ||
        a.unitNumber - b.unitNumber,
    )[0];
}

export function PruebasTab() {
  const state = useUserState((s) => s);
  const { progress } = useDerived();

  const bySubject = useMemo(
    () =>
      currentSubjects
        .filter((s) => (trialsBySubject.get(s.id) ?? []).length > 0)
        .map((s) => ({ subjectId: s.id, rows: rowsOf(trialsBySubject.get(s.id) ?? [], state, progress) })),
    [state, progress],
  );
  const allRows = useMemo(() => bySubject.flatMap((g) => g.rows), [bySubject]);
  const recommended = recommendedOf(allRows);
  const pending = currentSubjects.filter((s) => (trialsBySubject.get(s.id) ?? []).length === 0);

  if (trials.length === 0) {
    return <EmptyState title="Sin pruebas todavía" description="Aún no hay pruebas sintéticas para tus asignaturas." />;
  }

  return (
    <div className="rumbo-elite">
      <p className="rumbo-elite-lead tone-2">
        Controles por tema y simulacros · se superan con un <b>{TRIAL_PASS}</b>
        <Tooltip content="Exámenes escritos para Atlas al nivel de tu grado y por encima. Hazlos cuando quieras para medir tu nivel; el Rumbo solo les pone fecha.">
          <IconButton aria-label="Ayuda" icon={<Icons.help aria-hidden="true" />} variant="quiet" size="sm" tooltip={false} />
        </Tooltip>
      </p>

      {recommended && (
        <section className="rumbo-pruebas-pick" aria-labelledby="rumbo-pruebas-pick-title">
          <div className="rumbo-pruebas-pick-main">
            <p className="mono-label is-gold" id="rumbo-pruebas-pick-title">
              {recommended.open ? "Tienes una prueba a medias" : "Recomendada ahora"}
            </p>
            <p className="rumbo-pruebas-pick-title">
              <SubjectDot subjectId={recommended.trial.subjectId} size={8} /> {rowTitle(recommended.trial)}
            </p>
            <p className="tone-3 rumbo-pruebas-pick-meta">
              {subjectName(recommended.trial.subjectId)} · {KIND_LABEL[recommended.trial.kind]} · preparación {pct(recommended.readiness.ratio)}
            </p>
          </div>
          <Button variant="primary" icon={<Play />} href={href(`/prueba/${recommended.trial.id}`)}>
            {recommended.open ? "Continuar" : "Empezar"}
          </Button>
        </section>
      )}

      <div className="rumbo-campaigns">
        {bySubject.map(({ subjectId, rows }) => {
          const passed = rows.filter((r) => r.result.passed).length;
          return (
            <section key={subjectId} className="rumbo-campaign" aria-labelledby={`rumbo-pruebas-${subjectId}`}>
              <header className="rumbo-campaign-head">
                <SubjectDot subjectId={subjectId} size={9} />
                <h3 id={`rumbo-pruebas-${subjectId}`}>{subjectName(subjectId)}</h3>
                <span className="tone-3 rumbo-campaign-count">
                  <b className="num">{passed}</b> de <b className="num">{rows.length}</b> superadas
                </span>
              </header>
              <ol className="rumbo-ladder">
                {rows.map((row) => (
                  <TrialRow key={row.trial.id} row={row} recommended={row.trial.id === recommended?.trial.id} />
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      {pending.length > 0 && (
        <p className="tone-3 rumbo-pruebas-pending">
          Aún sin pruebas: {pending.map((s) => s.shortName).join(", ")}. Se van añadiendo por tandas.
        </p>
      )}
    </div>
  );
}
