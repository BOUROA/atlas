/**
 * Modo sesión (#/sesion) · Task 4. Pantalla completa, sin navegación: el
 * shell (AppShell) ya oculta TopNav/BottomNav en esta ruta. Congela la cola al
 * entrar, lleva el teclado completo y termina con un resumen (o al pulsar Esc).
 *
 * Consulta: asig, min, modo (cola del día, ver contrato) · ids=<id,id,...>
 * (sesión a medida: solo esos conceptos, en ese orden; nivel 0 → nuevo, el
 * resto → repaso aunque no toque según FSRS; ids desconocidos se ignoran).
 * `c` no se usa aquí: queda reservado para la ficha lateral (ConceptPanelHost),
 * que se abre sobre cualquier ruta incluida esta — mezclarlos con la cola
 * abriría la ficha a la vez que empieza la sesión.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import type { Grade, Question } from "../../domain/types";
import { addDays, dayKey, daysBetween } from "../../domain/time";
import { XP_RULES } from "../../domain/game/xp";
import { catalog } from "../../state/catalog";
import { getDerived, progressOf, useConceptView, useDerived, useQueue } from "../../state/derived";
import { recordReview, recordSeen, endSession, startSession } from "../../state/actions";
import { navigate, openConcept, useRoute } from "../../state/router";
import { store, useUserState } from "../../state/store";
import { cx, Icons, IconButton, relDays } from "../../ui";
import { SessionNewCard, SessionReviewCard } from "./SessionCards";
import { SessionSummary, subjectLitRatio } from "./SessionSummary";
import "./session.css";

type CardKind = "new" | "review";
type SessionItem = { conceptId: string; kind: CardKind; requeued?: boolean };
type Phase = "playing" | "summary";

const mmss = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const isTyping = (el: Element | null) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
};

/** Pregunta menos usada del catálogo del concepto (si trae alguna). */
function pickQuestion(questions: readonly Question[], events: { questionId?: string }[]): Question | null {
  if (questions.length === 0) return null;
  const uses = new Map<string, number>();
  for (const q of questions) uses.set(q.id, 0);
  for (const e of events) if (e.questionId && uses.has(e.questionId)) uses.set(e.questionId, (uses.get(e.questionId) ?? 0) + 1);
  let best = questions[0];
  let bestCount = Infinity;
  for (const q of questions) {
    const c = uses.get(q.id) ?? 0;
    if (c < bestCount) {
      best = q;
      bestCount = c;
    }
  }
  return best;
}

export function SessionScreen() {
  const { query } = useRoute();
  const derived = useDerived();
  const state = useUserState((s) => s);
  const queueResult = useQueue({
    subjectId: query.get("asig") || undefined,
    minutes: query.get("min") ? Number(query.get("min")) : undefined,
    reviewsOnly: query.get("modo") === "repasos",
  });

  // ───── Cola congelada al entrar ─────
  const [queue, setQueue] = useState<SessionItem[]>(() => {
    // ?ids=a,b,c: sesión a medida (un concepto suelto, Practicar lo que falta,
    // bases no iluminadas…). Solo esos conceptos, en ese orden; nivel 0 →
    // nuevo, el resto → repaso, se le toque o no según FSRS. Ids desconocidos
    // o repetidos se ignoran.
    const idsParam = query.get("ids");
    if (idsParam) {
      const seen = new Set<string>();
      const items: SessionItem[] = [];
      for (const raw of idsParam.split(",")) {
        const id = raw.trim();
        if (!id || seen.has(id) || !catalog.conceptById.has(id)) continue;
        seen.add(id);
        const level = progressOf(derived.progress, id).level;
        items.push({ conceptId: id, kind: level === 0 ? "new" : "review" });
      }
      return items;
    }
    return queueResult.planned.map((it) => ({ conceptId: it.conceptId, kind: it.type === "new" ? "new" : "review" }));
  });
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");

  // ───── Sesión, tiempo y XP ─────
  const sessionIdRef = useRef<string | null>(null);
  // Id de la última sesión ya cerrada (en vez de un booleano): en desarrollo,
  // StrictMode monta cada efecto, lo limpia y lo vuelve a montar una vez para
  // detectar fugas; comparar por id evita que esa limpieza fantasma marque la
  // sesión real (creada en el segundo montaje) como ya terminada.
  const lastEndedSessionIdRef = useRef<string | null>(null);
  const reviewsDoneRef = useRef(0);
  const newDoneRef = useRef(0);
  const touchedRef = useRef<Set<string>>(new Set());
  const startProgressRef = useRef(derived.progress);
  const startAchievementIdsRef = useRef<Set<string>>(new Set(Object.keys(state.achievements)));
  const prevLevelRef = useRef(derived.level.level);

  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [xpEarned, setXpEarned] = useState(0);
  const [xpFlashTick, setXpFlashTick] = useState<{ n: number; amount: number } | null>(null);
  const [levelUps, setLevelUps] = useState<{ from: number; to: number }[]>([]);
  const [summaryData, setSummaryData] = useState<{
    subjectDeltas: { subjectId: string; before: number; after: number }[];
    nextReviewsCount: number;
  } | null>(null);

  // useLayoutEffect (no useEffect): debe fijar sessionIdRef antes de que el
  // layout effect de "fin natural de la cola" (más abajo) compruebe si ya hay
  // sesión que cerrar, incluso en el primer render (cola vacía desde el inicio).
  useLayoutEffect(() => {
    const id = startSession();
    sessionIdRef.current = id;
    return () => {
      if (lastEndedSessionIdRef.current !== id) {
        endSession(id, { reviews: reviewsDoneRef.current, newConcepts: newDoneRef.current, completed: false });
        lastEndedSessionIdRef.current = id;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Subida de nivel: destello + registro para el resumen.
  useEffect(() => {
    const lvl = derived.level.level;
    if (lvl > prevLevelRef.current) {
      setLevelUps((u) => [...u, { from: prevLevelRef.current, to: lvl }]);
      prevLevelRef.current = lvl;
    } else prevLevelRef.current = lvl;
  }, [derived.level.level]);

  const current = queue[pos] as SessionItem | undefined;
  const view = useConceptView(current?.conceptId ?? "");

  // ───── Estado de la tarjeta de repaso ─────
  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [exercise, setExercise] = useState(false);
  useEffect(() => {
    setRevealed(false);
    setConfidence(null);
    setExercise(false);
  }, [current?.conceptId]);

  const question = useMemo(() => {
    if (!view || current?.kind !== "review") return null;
    return pickQuestion(view.concept.questions, view.events);
  }, [view, current?.kind]);

  const gradePreview = useMemo(() => {
    const out: Record<Grade, string> = { 1: "", 2: "", 3: "", 4: "" };
    if (!view) return out;
    const base = view.progress.card ?? derived.scheduler.init(derived.now);
    for (const g of [1, 2, 3, 4] as const) {
      const next = derived.scheduler.next(base, derived.now, g);
      out[g] = relDays(daysBetween(dayKey(derived.now), dayKey(next.due)));
    }
    return out;
  }, [view, derived.scheduler, derived.now]);

  const bumpXp = (amount: number) => {
    if (amount <= 0) return;
    setXpEarned((x) => x + amount);
    setXpFlashTick((t) => ({ n: (t?.n ?? 0) + 1, amount }));
  };
  useEffect(() => {
    if (!xpFlashTick) return;
    const t = setTimeout(() => setXpFlashTick(null), 1200);
    return () => clearTimeout(t);
  }, [xpFlashTick]);

  const advance = (requeue?: SessionItem) => {
    if (requeue) setQueue((q) => [...q, { ...requeue, requeued: true }]);
    setPos((p) => p + 1);
  };

  const buildSummary = () => {
    const subjectIds = [...new Set([...touchedRef.current].map((id) => catalog.conceptById.get(id)?.subjectId).filter((s): s is string => !!s))];
    const nowProgress = getDerived(store.getState()).progress;
    const subjectDeltas = subjectIds.map((subjectId) => ({
      subjectId,
      before: subjectLitRatio(subjectId, startProgressRef.current),
      after: subjectLitRatio(subjectId, nowProgress),
    }));
    const tomorrow = addDays(new Date(), 1);
    let nextReviewsCount = 0;
    for (const p of nowProgress.values()) if (p.due && dayKey(p.due) <= dayKey(tomorrow)) nextReviewsCount++;
    setSummaryData({ subjectDeltas, nextReviewsCount });
  };

  const finish = (completed: boolean) => {
    const id = sessionIdRef.current;
    if (!id || lastEndedSessionIdRef.current === id) return;
    endSession(id, { reviews: reviewsDoneRef.current, newConcepts: newDoneRef.current, completed });
    lastEndedSessionIdRef.current = id;
    buildSummary();
    setPhase("summary");
  };

  // Fin natural de la cola (useLayoutEffect: pasa a resumen antes de pintar, sin parpadeo).
  useLayoutEffect(() => {
    if (phase === "playing" && pos >= queue.length) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, queue.length, phase]);

  const exit = () => finish(false);

  // ───── Acciones de tarjeta ─────
  const submitSeen = () => {
    if (!current) return;
    recordSeen([current.conceptId], "session");
    newDoneRef.current++;
    touchedRef.current.add(current.conceptId);
    bumpXp(XP_RULES.seen);
    advance();
  };
  const submitSkip = () => advance();
  const submitGrade = (grade: Grade) => {
    if (!current || !view) return;
    recordReview({
      conceptId: current.conceptId,
      grade,
      attempted: true,
      questionId: question?.id,
      questionKind: exercise ? "exercise" : "recall",
      confidence: confidence ?? undefined,
      source: "session",
    });
    reviewsDoneRef.current++;
    touchedRef.current.add(current.conceptId);
    bumpXp(XP_RULES.review[grade]);
    advance(grade === 1 && !current.requeued ? current : undefined);
  };
  const submitNoRecall = () => {
    if (!current) return;
    recordReview({ conceptId: current.conceptId, grade: 1, attempted: false, confidence: confidence ?? undefined, source: "session" });
    reviewsDoneRef.current++;
    touchedRef.current.add(current.conceptId);
    advance(!current.requeued ? current : undefined);
  };
  const openFicha = () => current && openConcept(current.conceptId);

  // ───── Teclado ─────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(document.activeElement)) return;
      if (document.querySelector("dialog[open]")) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (phase === "summary") navigate("/hoy");
        else exit();
        return;
      }
      if (phase !== "playing" || !current) return;

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        openFicha();
        return;
      }
      if (current.kind === "new") {
        if (e.key === "Enter") {
          e.preventDefault();
          submitSeen();
        }
        return;
      }
      // Repaso.
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        setExercise((v) => !v);
        return;
      }
      if (!revealed) {
        if (e.key.toLowerCase() === "a") setConfidence(1);
        else if (e.key.toLowerCase() === "s") setConfidence(2);
        else if (e.key.toLowerCase() === "d") setConfidence(3);
        else if (e.key === " ") {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        submitGrade(Number(e.key) as Grade);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, revealed, exercise, confidence, question]);

  const total = queue.length;
  const doneCount = Math.min(pos, total);
  const shown = phase === "summary" ? total : Math.min(pos + 1, Math.max(total, 1));
  const elapsedMs = now - startedAt;
  const cardStartRef = useRef(now);
  useEffect(() => {
    cardStartRef.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.conceptId]);

  const achievements = useUserState((s) => s.achievements);
  const newAchievementIds = useMemo(
    () => Object.keys(achievements).filter((id) => !startAchievementIdsRef.current.has(id)),
    [achievements],
  );

  return (
    <div className="session-root">
      <header className="session-bar">
        <div className="session-bar-progress">
          <div className="session-bar-track">
            <div className="session-bar-fill" style={{ "--w": `${total > 0 ? (doneCount / total) * 100 : 100}%` } as CSSProperties} />
          </div>
          <span className="session-bar-count num">
            {shown}/{total}
          </span>
        </div>
        <div className="session-bar-mid">
          <span className="session-chip">
            <Icons.inProgress aria-hidden="true" /> <span className="num">{mmss(elapsedMs)}</span>
          </span>
          <span className={cx("session-chip", "session-chip--xp", xpFlashTick && "is-flash")}>
            <Icons.xp aria-hidden="true" /> <span className="num">+{xpEarned} XP</span>
          </span>
        </div>
        <IconButton aria-label="Salir de la sesión (Esc)" icon={<X />} onClick={exit} tooltipSide="bottom" tooltipAlign="end" />
      </header>

      <main className="session-stage">
        {phase === "summary" && summaryData ? (
          <SessionSummary
            xpEarned={xpEarned}
            reviewsDone={reviewsDoneRef.current}
            newDone={newDoneRef.current}
            levelUps={levelUps}
            subjectDeltas={summaryData.subjectDeltas}
            touchedConceptIds={[...touchedRef.current]}
            newAchievementIds={newAchievementIds}
            streakCurrent={derived.streak.current}
            nextReviewsCount={summaryData.nextReviewsCount}
          />
        ) : !current || !view ? (
          <div className="session-card-wrap" aria-hidden="true" />
        ) : current.kind === "new" ? (
          <SessionNewCard
            view={view}
            elapsedLabel={mmss(now - cardStartRef.current)}
            onSeen={submitSeen}
            onSkip={submitSkip}
            onOpenFicha={openFicha}
          />
        ) : (
          <SessionReviewCard
            view={view}
            question={question}
            revealed={revealed}
            confidence={confidence}
            onConfidence={setConfidence}
            exercise={exercise}
            onExercise={setExercise}
            onReveal={() => setRevealed(true)}
            onGrade={submitGrade}
            onNoRecall={submitNoRecall}
            onOpenFicha={openFicha}
            gradePreview={gradePreview}
            xpFlash={xpFlashTick}
          />
        )}
      </main>
    </div>
  );
}
