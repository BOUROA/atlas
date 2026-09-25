// Todas las mutaciones del estado personal pasan por aquí (ids con
// crypto.randomUUID(), fechas con new Date().toISOString()).
import type {
  Assessment, ConceptNote, DayPlan, EventSource, ExpeditionAttempt, Grade, QuestionKind, Settings, StudyEvent, TrialAttempt, UserState,
} from "../domain/types";
import { subjectStateOf } from "../domain/types";
import { assessmentAfterEdit, onlineTemplate } from "../domain/calendar-template";
import { mergeStates } from "../domain/sync";
import { implicitEvents } from "../domain/tutor/implicit";
import { eventsFromGrading } from "../domain/expeditions";
import { eventsFromTrial, gradedAttempt } from "../domain/trials";
import { catalog, expeditionById, trialById } from "./catalog";
import { getDayPlan, getDerived } from "./derived";
import { isUserState, store } from "./store";

const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const isoNow = () => new Date().toISOString();

/* ───────── Eventos ───────── */

/** Último lote de eventos añadido, para el «Deshacer» de los avisos. */
let lastBatch: { ids: Set<string>; at: number } | null = null;
const UNDO_WINDOW_MS = 10_000;

function appendEvents(events: StudyEvent[]): StudyEvent[] {
  if (events.length === 0) return events;
  store.update((s) => ({ ...s, events: [...s.events, ...events] }));
  lastBatch = { ids: new Set(events.map((e) => e.id)), at: Date.now() };
  return events;
}

/** Marca conceptos como vistos (p. ej. «Hoy en clase he visto…»). Devuelve los eventos añadidos. */
export function recordSeen(ids: string[], source: EventSource): StudyEvent[] {
  const at = isoNow();
  const known = [...new Set(ids)].filter((id) => catalog.conceptById.has(id));
  return appendEvents(known.map((conceptId) => ({ id: uuid(), at, conceptId, kind: "seen", source })));
}

export type ReviewInput = {
  conceptId: string;
  grade: Grade;
  /** false si se mostró la respuesta sin intentarlo (no sube de nivel; FSRS lo trata como nota 1). */
  attempted: boolean;
  questionId?: string;
  /** "exercise" o "apply" cuentan para el nivel 3 (p. ej. «He resuelto ejercicios de esto»). */
  questionKind?: QuestionKind;
  confidence?: 1 | 2 | 3;
  /** Duración en milisegundos. */
  ms?: number;
  /** Por defecto "session". */
  source?: EventSource;
};

/**
 * Registra un repaso y los repasos implícitos de sus requisitos (si es un
 * acierto). Devuelve todos los eventos añadidos (el repaso primero).
 */
export function recordReview(input: ReviewInput): StudyEvent[] {
  const state = store.getState();
  const review: StudyEvent = {
    id: uuid(),
    at: isoNow(),
    conceptId: input.conceptId,
    kind: "review",
    grade: input.grade,
    attempted: input.attempted,
    source: input.source ?? "session",
    ...(input.questionId ? { questionId: input.questionId } : {}),
    ...(input.questionKind ? { questionKind: input.questionKind } : {}),
    ...(input.confidence ? { confidence: input.confidence } : {}),
    ...(input.ms !== undefined ? { ms: Math.round(input.ms) } : {}),
  };
  const derived = getDerived(state);
  const implicit = implicitEvents({ index: catalog, progress: derived.progress, review, events: state.events, now: new Date(review.at) });
  return appendEvents([review, ...implicit]);
}

/** «Ya lo domino»: nivel 2 declarado, pendiente de comprobar con un repaso. */
export function declareKnown(conceptId: string, source: EventSource = "concept"): StudyEvent[] {
  return appendEvents([{ id: uuid(), at: isoNow(), conceptId, kind: "declared", source }]);
}

/**
 * Deshace el último lote de eventos añadido si tiene menos de 10 s.
 * Devuelve true si ha quitado algo.
 */
export function undoLast(): boolean {
  const batch = lastBatch;
  if (!batch || Date.now() - batch.at > UNDO_WINDOW_MS) return false;
  lastBatch = null;
  let removed = false;
  store.update((s) => {
    const events = s.events.filter((e) => !batch.ids.has(e.id));
    removed = events.length !== s.events.length;
    return removed ? { ...s, events } : s;
  });
  return removed;
}

/* ───────── Sesiones ───────── */

const openSessions = new Map<string, string>();

/** Empieza una sesión y devuelve su id (se registra al terminarla con endSession). */
export function startSession(): string {
  const id = uuid();
  openSessions.set(id, isoNow());
  return id;
}

/** Cierra una sesión: completed = true si se terminó la cola planificada (da XP y cuenta para la racha). */
export function endSession(id: string, result: { reviews: number; newConcepts: number; completed: boolean }): void {
  const startedAt = openSessions.get(id) ?? isoNow();
  openSessions.delete(id);
  store.update((s) => ({
    ...s,
    sessions: [...s.sessions.filter((x) => x.id !== id), { id, startedAt, endedAt: isoNow(), ...result }],
  }));
}

/* ───────── Apuntes, temario y evaluaciones ───────── */

/** Guarda los apuntes de un concepto; sin texto ni enlaces, se borran. */
export function setNote(conceptId: string, note: Pick<ConceptNote, "text" | "links">): void {
  store.update((s) => {
    const notes = { ...s.notes };
    if (!note.text.trim() && note.links.length === 0) delete notes[conceptId];
    else notes[conceptId] = { text: note.text, links: note.links, updatedAt: isoNow() };
    return { ...s, notes };
  });
}

function updateSubject(s: UserState, subjectId: string, fn: (sub: ReturnType<typeof subjectStateOf>) => Partial<ReturnType<typeof subjectStateOf>>): UserState {
  const current = subjectStateOf(s, subjectId);
  return { ...s, subjects: { ...s.subjects, [subjectId]: { ...current, ...fn(current), updatedAt: isoNow() } } };
}

/** «Voy por el tema N». */
export function setCurrentUnit(subjectId: string, unitNumber: number): void {
  store.update((s) => updateSubject(s, subjectId, () => ({ currentUnit: Math.max(0, Math.round(unitNumber)) })));
}

/**
 * Crea o actualiza una evaluación (sin id, se crea). Si ya existía y era una
 * plantilla (`template: true`), cambiar su fecha o su peso le quita la marca
 * (`assessmentAfterEdit`): ya no es un hueco por corregir, es una evaluación
 * real. Editar otra cosa la conserva. Devuelve su id.
 */
export function upsertAssessment(subjectId: string, assessment: Omit<Assessment, "id"> & { id?: string }): string {
  const id = assessment.id ?? uuid();
  store.update((s) =>
    updateSubject(s, subjectId, (sub) => {
      const existing = sub.assessments.find((a) => a.id === id);
      const next = assessmentAfterEdit(existing, { ...assessment, id });
      return {
        assessments: existing ? sub.assessments.map((a) => (a.id === id ? next : a)) : [...sub.assessments, next],
      };
    }),
  );
  return id;
}

export function removeAssessment(subjectId: string, assessmentId: string): void {
  store.update((s) => updateSubject(s, subjectId, (sub) => ({ assessments: sub.assessments.filter((a) => a.id !== assessmentId) })));
}

/* ───────── Ajustes ───────── */

export function setSettings(patch: Partial<Omit<Settings, "updatedAt">>): void {
  store.update((s) => ({ ...s, settings: { ...s.settings, ...patch, updatedAt: isoNow() } }));
}

/* ───────── Insignias y celebraciones ───────── */

/** Guarda la fecha de desbloqueo de las insignias nuevas (las ya guardadas no cambian). */
export function recordAchievements(ids: string[]): void {
  store.update((s) => {
    const fresh = ids.filter((id) => !(id in s.achievements));
    if (fresh.length === 0) return s;
    const at = isoNow();
    return { ...s, achievements: { ...s.achievements, ...Object.fromEntries(fresh.map((id) => [id, at])) } };
  });
}

/** Marca insignias como ya celebradas. */
export function markAchievementsSeen(ids: string[]): void {
  store.update((s) => {
    const seen = new Set(s.seen.achievements);
    const before = seen.size;
    for (const id of ids) seen.add(id);
    return seen.size === before ? s : { ...s, seen: { ...s.seen, achievements: [...seen] } };
  });
}

/** Último nivel celebrado. */
export function setLevelShown(level: number): void {
  store.update((s) => (s.seen.levelShown === level ? s : { ...s, seen: { ...s.seen, levelShown: level } }));
}

/* ───────── Misión del día ───────── */

/**
 * Guarda la instantánea de la Misión del día de hoy si aún no existe (el día lo
 * da el mismo reloj que los derivados, `nowMinute`, que respeta `?hoy=`). No pisa
 * una ya guardada. Mientras el estado se carga no escribe (congelaría el plan de
 * un estado vacío): espera a la carga y lo intenta entonces, y devuelve null.
 * Si no, devuelve el plan guardado. Idempotente: se puede llamar en cada render.
 */
export function ensureDayPlan(): DayPlan | null {
  if (store.status() === "loading") {
    void store.init().then(() => ensureDayPlan());
    return null;
  }
  const { plan, stored } = getDayPlan(store.getState());
  if (stored) return plan;
  store.update((s) => (s.dayPlans?.[plan.day] ? s : { ...s, dayPlans: { ...(s.dayPlans ?? {}), [plan.day]: plan } }));
  return store.getState().dayPlans?.[plan.day] ?? plan;
}

/* ───────── Misiones ───────── */

/** Empieza un intento de misión y devuelve su id. */
export function startExpedition(expeditionId: string): string {
  const attempt: ExpeditionAttempt = { id: uuid(), startedAt: isoNow(), scores: {} };
  store.update((s) => {
    const all = s.expeditions ?? {};
    return { ...s, expeditions: { ...all, [expeditionId]: [...(all[expeditionId] ?? []), attempt] } };
  });
  return attempt.id;
}

/**
 * Corrige un intento: guarda las puntuaciones (0 · ½ · 1 por problema), lo
 * cierra y añade los repasos de `eventsFromGrading` (source "challenge").
 * Devuelve los eventos añadidos.
 */
export function gradeExpedition(expeditionId: string, attemptId: string, scores: ExpeditionAttempt["scores"]): StudyEvent[] {
  const exp = expeditionById.get(expeditionId);
  if (!exp) throw new Error(`Misión desconocida: ${expeditionId}`);
  const at = isoNow();
  const prev = (store.getState().expeditions?.[expeditionId] ?? []).find((a) => a.id === attemptId);
  const attempt: ExpeditionAttempt = { id: attemptId, startedAt: prev?.startedAt ?? at, endedAt: at, scores };
  store.update((s) => {
    const all = s.expeditions ?? {};
    const list = all[expeditionId] ?? [];
    const attempts = list.some((a) => a.id === attemptId) ? list.map((a) => (a.id === attemptId ? attempt : a)) : [...list, attempt];
    return { ...s, expeditions: { ...all, [expeditionId]: attempts } };
  });
  const events = eventsFromGrading(exp, attempt, at).filter((e) => catalog.conceptById.has(e.conceptId));
  return appendEvents(events);
}

/* ───────── Pruebas sintéticas ───────── */

/** Empieza un intento de prueba y devuelve su id. */
export function startTrial(trialId: string): string {
  const attempt: TrialAttempt = { id: uuid(), startedAt: isoNow(), earned: {} };
  store.update((s) => {
    const all = s.trials ?? {};
    return { ...s, trials: { ...all, [trialId]: [...(all[trialId] ?? []), attempt] } };
  });
  return attempt.id;
}

/**
 * Guarda un borrador de corrección (las casillas de rúbrica marcadas) sin cerrar
 * el intento. No toca un intento ya corregido (un guardado diferido que llega
 * tarde descuadraría `checked` y `earned`).
 */
export function saveTrialChecks(trialId: string, attemptId: string, checked: Record<string, number[]>): void {
  store.update((s) => {
    const all = s.trials ?? {};
    const list = all[trialId] ?? [];
    const current = list.find((a) => a.id === attemptId);
    if (!current || current.endedAt) return s;
    return { ...s, trials: { ...all, [trialId]: list.map((a) => (a.id === attemptId ? { ...a, checked } : a)) } };
  });
}

/**
 * Corrige un intento (`gradedAttempt`): `earned` por problema a partir de los
 * criterios de rúbrica marcados, salvo que `overrides` (por número de problema)
 * dé la puntuación a mano (acotada a [0, points]); cierra el intento y añade los
 * repasos de `eventsFromTrial` (con el progreso previo a la corrección, filtrados
 * a conceptos del catálogo). Devuelve los eventos añadidos. Idempotente: si el
 * intento ya estaba corregido (doble clic), no cambia nada y devuelve los eventos
 * que generó su corrección (ids `<intento>~<concepto>`).
 */
export function gradeTrial(
  trialId: string,
  attemptId: string,
  checked: Record<string, number[]>,
  overrides: Record<string, number> = {},
): StudyEvent[] {
  const trial = trialById.get(trialId);
  if (!trial) throw new Error(`Prueba desconocida: ${trialId}`);
  const at = isoNow();
  const state = store.getState();
  const prev = (state.trials?.[trialId] ?? []).find((a) => a.id === attemptId);
  const attempt = gradedAttempt(trial, prev, attemptId, checked, overrides, at);
  if (!attempt) return state.events.filter((e) => e.id.startsWith(`${attemptId}~`));
  const progress = getDerived(state).progress;
  store.update((s) => {
    const all = s.trials ?? {};
    const list = all[trialId] ?? [];
    const attempts = list.some((a) => a.id === attemptId) ? list.map((a) => (a.id === attemptId ? attempt : a)) : [...list, attempt];
    return { ...s, trials: { ...all, [trialId]: attempts } };
  });
  const events = eventsFromTrial(trial, attempt, progress, at).filter((e) => catalog.conceptById.has(e.conceptId));
  return appendEvents(events);
}

/**
 * Aplica la plantilla online a las asignaturas del curso actual que todavía no
 * tienen ninguna evaluación (`onlineTemplate`, calculada sobre el mismo estado que
 * se escribe: nunca pisa evaluaciones existentes). Devuelve el número de
 * asignaturas rellenadas.
 */
export function applyOnlineTemplate(): number {
  let count = 0;
  store.update((s) => {
    const entries = Object.entries(onlineTemplate(catalog, s));
    count = entries.length;
    if (count === 0) return s;
    const at = isoNow();
    const subjects = { ...s.subjects };
    for (const [subjectId, assessments] of entries) subjects[subjectId] = { ...subjectStateOf(s, subjectId), assessments, updatedAt: at };
    return { ...s, subjects };
  });
  return count;
}

/* ───────── Copias ───────── */

/** Copia completa del estado en JSON legible. */
export function exportState(): string {
  return JSON.stringify(store.getState(), null, 2);
}

/**
 * Importa una copia: la valida (versión 2) y la fusiona con el estado actual
 * (no se pierde nada de ninguno de los dos). Lanza Error con mensaje en español.
 */
export function importState(json: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("El fichero no es un JSON válido.");
  }
  // Admite también el formato del servidor ({ rev, state }).
  const candidate = parsed && typeof parsed === "object" && "state" in parsed && !("version" in parsed) ? (parsed as { state: unknown }).state : parsed;
  if (!candidate || typeof candidate !== "object" || (candidate as { version?: unknown }).version !== 2) {
    throw new Error("La copia no es de Atlas v2 (falta «version: 2»).");
  }
  if (!isUserState(candidate)) throw new Error("La copia está incompleta o dañada: faltan eventos, sesiones o ajustes.");
  store.replace(mergeStates(store.getState(), candidate));
}
