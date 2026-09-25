/**
 * Prueba (examen sintético) · #/prueba/:id — antes, durante, corrección y resultado.
 *
 * export function TrialScreen(props: { trialId: string }): JSX.Element
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./trial.css";
import type { StudyEvent, TrialAttempt } from "../../domain/types";
import { gradeTrial, saveTrialChecks, startTrial } from "../../state/actions";
import { trialById } from "../../state/catalog";
import { useDerived, useRoutes } from "../../state/derived";
import { store, useUserState } from "../../state/store";
import { EmptyState, Page } from "../../ui";
import { TrialBefore } from "./Before";
import { TrialCorrection } from "./Correction";
import { TrialDuring } from "./During";
import { TrialPrint } from "./Print";
import { TrialResult } from "./Result";
import { discardOpenTrialAttempts, openTrialAttempt, resumePhaseOf, saveTrialDraft, trialDraft } from "./helpers";

const CHECK_SAVE_DEBOUNCE_MS = 500;

type Phase = "before" | "running" | "correcting";
type PendingChecks = { trialId: string; attemptId: string; checked: Record<string, number[]>; timer: ReturnType<typeof setTimeout> };

function flushPending(ref: { current: PendingChecks | null }): void {
  const p = ref.current;
  if (!p) return;
  clearTimeout(p.timer);
  ref.current = null;
  saveTrialChecks(p.trialId, p.attemptId, p.checked);
}

function dropPending(ref: { current: PendingChecks | null }): void {
  if (ref.current) clearTimeout(ref.current.timer);
  ref.current = null;
}

export function TrialScreen({ trialId }: { trialId: string }) {
  const trial = trialById.get(trialId);
  const state = useUserState((s) => s);
  const derived = useDerived();
  const routes = useRoutes();

  const [phase, setPhase] = useState<Phase>("before");
  const [checked, setChecked] = useState<Record<string, number[]>>({});
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [justGraded, setJustGraded] = useState<{ attempt: TrialAttempt; events: StudyEvent[] } | null>(null);
  const pending = useRef<PendingChecks | null>(null);
  const saving = useRef(false);
  // Copias al día de los borradores: dos cambios seguidos en el mismo evento
  // (p. ej. «Marcar todo» en dos problemas) no se pisan con un estado viejo.
  const checkedRef = useRef(checked);
  const overridesRef = useRef(overrides);

  const attempts = state.trials?.[trialId] ?? [];
  const open = openTrialAttempt(trialId, attempts);

  // Criterios marcados pendientes de guardar: se escriben ya al salir de la
  // pantalla o al cerrar la pestaña, nunca se pierden.
  useEffect(() => {
    const onHide = () => flushPending(pending);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flushPending(pending);
    };
  }, []);

  // Un intento nuevo (o que deja de estar abierto) recarga el borrador de
  // corrección: criterios del estado y ajustes manuales del borrador local.
  useEffect(() => {
    checkedRef.current = open?.checked ?? {};
    overridesRef.current = open ? (trialDraft(open.id).overrides ?? {}) : {};
    setChecked(checkedRef.current);
    setOverrides(overridesRef.current);
    saving.current = false;
    if (!open) setPhase("before");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.id]);

  // Cada fase empieza arriba.
  const view = justGraded ? "result" : phase;
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [view]);

  // Durante la prueba, la barra de navegación se atenúa (trial.css).
  useEffect(() => {
    if (view !== "running") return;
    const root = document.documentElement;
    root.dataset.trialFocus = "";
    return () => {
      delete root.dataset.trialFocus;
    };
  }, [view]);

  if (!trial) {
    return (
      <Page as="main">
        <EmptyState title="Prueba desconocida" description={`No hay ninguna prueba con el identificador «${trialId}».`} />
      </Page>
    );
  }

  const handleStart = () => {
    setJustGraded(null);
    // Nunca dos intentos abiertos a la vez: si ya hay uno, se reanuda.
    if (open) {
      setPhase(resumePhaseOf(open));
      return;
    }
    startTrial(trial.id);
    setPhase("running");
  };
  const handleContinue = () => {
    if (open) setPhase(resumePhaseOf(open));
  };
  const handleDiscard = () => {
    dropPending(pending);
    discardOpenTrialAttempts(trial.id);
    setPhase("before");
  };
  const handleFinish = () => {
    if (!open) return;
    if (!trialDraft(open.id).finishedAt) saveTrialDraft(open.id, { finishedAt: new Date().toISOString() });
    setPhase("correcting");
  };

  const scheduleSaveChecks = (next: Record<string, number[]>) => {
    if (!open) return;
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { trialId: trial.id, attemptId: open.id, checked: next, timer: setTimeout(() => flushPending(pending), CHECK_SAVE_DEBOUNCE_MS) };
  };
  const handleSetChecks = (problemN: string, update: (prev: number[]) => number[]) => {
    const list = update(checkedRef.current[problemN] ?? []);
    const next = { ...checkedRef.current, [problemN]: [...new Set(list)].sort((a, b) => a - b) };
    checkedRef.current = next;
    setChecked(next);
    scheduleSaveChecks(next);
  };
  const handleOverrideChange = (problemN: string, value: number | undefined) => {
    const next = { ...overridesRef.current };
    if (value == null) delete next[problemN];
    else next[problemN] = value;
    overridesRef.current = next;
    setOverrides(next);
    if (open) saveTrialDraft(open.id, { overrides: next });
  };
  const handleSave = () => {
    if (!open || saving.current) return;
    saving.current = true;
    dropPending(pending); // gradeTrial guarda los criterios marcados con la nota
    const events = gradeTrial(trial.id, open.id, checkedRef.current, overridesRef.current);
    // gradeTrial ya ha actualizado el estado: se lee el intento cerrado tal cual quedó.
    const graded = store.getState().trials?.[trial.id]?.find((a) => a.id === open.id);
    if (graded?.endedAt) setJustGraded({ attempt: graded, events });
    setPhase("before");
  };

  let content: ReactNode;
  if (justGraded) {
    content = <TrialResult trial={trial} state={state} routes={routes} graded={justGraded} onBackToTrial={() => setJustGraded(null)} />;
  } else if (open && phase === "correcting") {
    content = (
      <TrialCorrection
        trial={trial}
        checked={checked}
        overrides={overrides}
        onSetChecks={handleSetChecks}
        onOverrideChange={handleOverrideChange}
        onSave={handleSave}
      />
    );
  } else if (open && phase === "running") {
    content = <TrialDuring trial={trial} attempt={open} onFinish={handleFinish} />;
  } else {
    content = (
      <TrialBefore
        trial={trial}
        state={state}
        derived={derived}
        openAttempt={open}
        onStart={handleStart}
        onContinue={handleContinue}
        onDiscard={handleDiscard}
      />
    );
  }

  return (
    <Page as="main" className="trial-page">
      {content}
      {(view === "before" || view === "running") && <TrialPrint trial={trial} />}
    </Page>
  );
}
