// Prueba · fase «Corrección»: por problema, la solución, la rúbrica con casillas
// y un ajuste manual; errores típicos al final. Pie fijo con la nota corriente
// (la misma cuenta que el dominio al guardar), saltos a cada problema y el
// guardado. Atajos: J / K problema siguiente / anterior.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { earnedFromChecked, gradedAttempt, starsFor, trialScore } from "../../domain/trials";
import type { Trial, TrialProblem } from "../../domain/types";
import { Button, Dialog, ICON_SIZE, Icons, Kbd, Md, Tooltip, cx, useReducedMotion } from "../../ui";
import { gradeNum, ptsLabel, ptsNum } from "./helpers";
import { TrialMd } from "./TrialMd";
import { TrialStars } from "./TrialStars";

/** "1,5" o "1.5" → 1.5 acotado a [0, max] y redondeado a centésimas; null si no es un número. */
function parseOverride(raw: string, max: number): number | null {
  const v = Number(raw.trim().replace(",", "."));
  if (raw.trim() === "" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(max, Math.round(v * 100) / 100));
}

/** Campo de puntuación manual: se escribe libre (coma o punto) y se acota al confirmar (Intro o al salir). */
function OverrideInput({ value, max, label, onCommit }: { value: number; max: number; label: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(ptsNum(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(ptsNum(value));
  }, [value]);
  const commit = () => {
    const v = parseOverride(draft, max);
    if (v == null) {
      setDraft(ptsNum(value));
      return;
    }
    setDraft(ptsNum(v));
    if (v !== value) onCommit(v);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const base = parseOverride(draft, max) ?? value;
      const next = Math.max(0, Math.min(max, Math.round((base + (e.key === "ArrowUp" ? 0.25 : -0.25)) * 100) / 100));
      setDraft(ptsNum(next));
      onCommit(next);
    }
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      className="trial-override-input num"
      value={draft}
      aria-label={label}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

function ProblemCorrection({
  problem,
  checked,
  override,
  onSetChecks,
  onOverrideChange,
  liRef,
}: {
  problem: TrialProblem;
  checked: number[];
  override: number | undefined;
  onSetChecks: (update: (prev: number[]) => number[]) => void;
  onOverrideChange: (value: number | undefined) => void;
  liRef: (el: HTMLLIElement | null) => void;
}) {
  const checkedSet = new Set(checked);
  const fromRubric = earnedFromChecked(problem, checked);
  const manual = override != null;
  const earned = manual ? override : fromRubric;
  const allOn = problem.rubric.length > 0 && problem.rubric.every((_, i) => checkedSet.has(i));
  const headId = `trial-p-${problem.n}-title`;

  const toggle = (idx: number) => onSetChecks((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));

  return (
    <li className="trial-correction-problem" id={`problema-${problem.n}`} ref={liRef} aria-labelledby={headId}>
      <header className="trial-correction-head">
        <h2 id={headId} className="trial-problem-n">
          Problema {problem.n}
        </h2>
        <span className={cx("trial-correction-sum num", earned >= problem.points - 1e-9 && earned > 0 && "is-full")}>
          <b>{ptsNum(earned)}</b> / {ptsNum(problem.points)}
        </span>
      </header>

      <details className="trial-statement-toggle">
        <summary>Enunciado</summary>
        <TrialMd size="sm">{problem.statement}</TrialMd>
      </details>

      <section className="trial-solution" aria-label={`Solución del problema ${problem.n}`}>
        <p className="mono-label trial-solution-label">Solución</p>
        <TrialMd size="sm">{problem.solution}</TrialMd>
      </section>

      <fieldset className={cx("trial-rubric", manual && "is-manual")}>
        <legend className="trial-rubric-legend">
          <span className="mono-label">Rúbrica</span>
          <button type="button" className="trial-rubric-all" disabled={manual} onClick={() => onSetChecks(() => (allOn ? [] : problem.rubric.map((_, i) => i)))}>
            {allOn ? "Quitar todo" : "Marcar todo"}
          </button>
        </legend>
        <ul>
          {problem.rubric.map((item, idx) => {
            const on = checkedSet.has(idx);
            return (
              <li key={idx}>
                <label className={cx("trial-rubric-item", on && "is-checked")}>
                  <input type="checkbox" checked={on} disabled={manual} onChange={() => toggle(idx)} />
                  <Md inline className="trial-rubric-text">
                    {item.text}
                  </Md>
                  <span className="trial-rubric-pts num">+{ptsNum(item.points)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="trial-override">
        <label className="trial-override-toggle">
          <input type="checkbox" checked={manual} onChange={(e) => onOverrideChange(e.target.checked ? fromRubric : undefined)} />
          Ajustar nota
        </label>
        <Tooltip content="Para un acierto parcial que la rúbrica no recoge.">
          <button type="button" className="trial-infotip" aria-label="Qué es ajustar nota">
            <Icons.help aria-hidden="true" {...ICON_SIZE.row} />
          </button>
        </Tooltip>
        {manual && (
          <span className="trial-override-field">
            <OverrideInput
              value={override}
              max={problem.points}
              label={`Puntuación manual del problema ${problem.n}, de 0 a ${ptsNum(problem.points)}`}
              onCommit={(v) => onOverrideChange(v)}
            />
            <span className="tone-3">de {ptsNum(problem.points)} · sustituye a la rúbrica</span>
          </span>
        )}
      </div>

      {problem.pitfalls && problem.pitfalls.length > 0 && (
        <details className="trial-pitfalls">
          <summary className="mono-label trial-pitfalls-title">
            <AlertTriangle size={13} aria-hidden="true" /> Errores típicos ({problem.pitfalls.length})
          </summary>
          <ul>
            {problem.pitfalls.map((text, i) => (
              <li key={i}>
                <Md inline>{text}</Md>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** Lleva al problema i (acotado) y pone el foco en su primera casilla. */
function goToProblem(items: Map<string, HTMLLIElement>, problems: readonly TrialProblem[], i: number, reduced: boolean): void {
  const p = problems[Math.max(0, Math.min(problems.length - 1, i))];
  const el = items.get(p.n);
  if (!el) return;
  el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  el.querySelector<HTMLElement>(".trial-rubric input:not(:disabled), .trial-override input")?.focus({ preventScroll: true });
}

/** Índice del problema que se está leyendo: el último cuyo inicio ya ha pasado bajo la cabecera fija. */
function currentProblemIndex(items: Map<string, HTMLLIElement>, problems: readonly TrialProblem[]): number {
  const line = 140;
  let current = 0;
  problems.forEach((p, i) => {
    const el = items.get(p.n);
    if (el && el.getBoundingClientRect().top <= line) current = i;
  });
  return current;
}

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== "checkbox") || (el as HTMLElement).isContentEditable);

export function TrialCorrection({
  trial,
  checked,
  overrides,
  onSetChecks,
  onOverrideChange,
  onSave,
}: {
  trial: Trial;
  checked: Record<string, number[]>;
  overrides: Record<string, number>;
  onSetChecks: (problemN: string, update: (prev: number[]) => number[]) => void;
  onOverrideChange: (problemN: string, value: number | undefined) => void;
  onSave: () => void;
}) {
  const reduced = useReducedMotion();
  const [confirmSave, setConfirmSave] = useState(false);
  const items = useRef(new Map<string, HTMLLIElement>());

  // Nota corriente con la misma cuenta que hará el dominio al guardar.
  const draft = gradedAttempt(trial, undefined, "borrador", checked, overrides, "")!;
  const grade = trialScore(trial, draft);
  const untouched = trial.problems.filter((p) => (checked[p.n]?.length ?? 0) === 0 && overrides[p.n] == null);

  const goTo = (i: number) => goToProblem(items.current, trial.problems, i, reduced);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(document.activeElement) || document.querySelector("dialog[open]")) return;
      const k = e.key.toLowerCase();
      if (k !== "j" && k !== "k") return;
      e.preventDefault();
      goToProblem(items.current, trial.problems, currentProblemIndex(items.current, trial.problems) + (k === "j" ? 1 : -1), reduced);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trial, reduced]);

  const requestSave = () => (untouched.length > 0 ? setConfirmSave(true) : onSave());
  const untouchedLabel =
    untouched.length === 1
      ? `El problema ${untouched[0].n} no tiene ningún criterio marcado: cuenta 0 puntos.`
      : `Los problemas ${untouched.map((p) => p.n).join(", ").replace(/, ([^,]*)$/, " y $1")} no tienen ningún criterio marcado: cuentan 0 puntos.`;

  return (
    <>
      <header className="trial-head">
        <p className="mono-label">Corrección</p>
        <h1>{trial.title}</h1>
        <p className="trial-head-lede">
          Marca solo lo que justificaste.
          <Tooltip
            content={
              <>
                <Kbd>J</Kbd> <Kbd>K</Kbd> problema siguiente / anterior · <Kbd>Espacio</Kbd> marca el criterio con el foco
              </>
            }
          >
            <button type="button" className="trial-infotip" aria-label="Atajos de teclado">
              <Icons.help aria-hidden="true" {...ICON_SIZE.row} />
            </button>
          </Tooltip>
        </p>
      </header>

      <ol className="trial-correction-list">
        {trial.problems.map((p) => (
          <ProblemCorrection
            key={p.n}
            problem={p}
            checked={checked[p.n] ?? []}
            override={overrides[p.n]}
            onSetChecks={(update) => onSetChecks(p.n, update)}
            onOverrideChange={(v) => onOverrideChange(p.n, v)}
            liRef={(el) => {
              if (el) items.current.set(p.n, el);
              else items.current.delete(p.n);
            }}
          />
        ))}
      </ol>

      <div className="trial-footer" role="region" aria-label="Nota y guardado">
        <div className="trial-footer-total" aria-live="polite">
          <b className="num">{gradeNum(grade)}</b>
          <span className="trial-footer-of">/ 10</span>
          <TrialStars count={starsFor(grade)} size={13} />
        </div>
        <nav className="trial-footer-jump" aria-label="Ir al problema">
          {trial.problems.map((p, i) => {
            const e = draft.earned[p.n] ?? 0;
            const touched = (checked[p.n]?.length ?? 0) > 0 || overrides[p.n] != null;
            return (
              <button
                key={p.n}
                type="button"
                className={cx("trial-jump", !touched && "is-untouched", e >= p.points - 1e-9 && e > 0 && "is-full")}
                onClick={() => goTo(i)}
                aria-label={`Problema ${p.n}: ${ptsNum(e)} de ${ptsLabel(p.points)}${touched ? "" : ", sin corregir"}`}
              >
                <span className="trial-jump-n">{p.n}</span>
                <span className="num">
                  {ptsNum(e)}/{ptsNum(p.points)}
                </span>
              </button>
            );
          })}
        </nav>
        <Button variant="primary" icon={<Icons.submit />} onClick={requestSave} className="trial-footer-save">
          Guardar corrección
        </Button>
      </div>

      <Dialog
        open={confirmSave}
        onClose={() => setConfirmSave(false)}
        title="¿Guardar con problemas sin corregir?"
        description={`${untouchedLabel} La nota se guarda tal cual y cuenta para tu rumbo.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSave(false)} data-autofocus>
              Seguir corrigiendo
            </Button>
            <Button
              variant="primary"
              icon={<Icons.submit />}
              onClick={() => {
                setConfirmSave(false);
                onSave();
              }}
            >
              Guardar igualmente
            </Button>
          </>
        }
      />
    </>
  );
}
