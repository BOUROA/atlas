// Cola de hoy (especificación §6.3): repasos pendientes, primeros recuerdos y
// conceptos nuevos, priorizados y recortados al presupuesto de minutos. Puro:
// `now` llega como parámetro.
import type { CatalogIndex } from "../catalog";
import { dayKey, daysBetween } from "../time";
import { subjectStateOf, type Assessment, type CatalogConcept, type Expedition, type StudyEvent, type Trial, type UserState } from "../types";
import { isSubjectInProgress, neededEarly, type NeededEarly } from "./advance";
import { reinforceHits, type ReinforceHit } from "../expeditions";
import { trialReinforceHits, type TrialReinforceHit } from "../trials";
import { conceptImpact } from "./impact";
import { progressOf, type ConceptProgress } from "./mastery";
import type { Scheduler } from "./scheduler";
import { daysAgo, inDays, listNames, WEEKDAYS } from "./text";

export type QueueItemType = "review" | "first" | "new";
export type QueueItem = { conceptId: string; type: QueueItemType; priority: number; minutes: number; reasons: string[] };
export type QueueTotals = { reviews: number; first: number; new: number; minutes: number };
export type QueueResult = { items: QueueItem[]; planned: QueueItem[]; totals: QueueTotals };
export type QueueOptions = { subjectId?: string; minutes?: number; reviewsOnly?: boolean };
export type QueueInput = QueueOptions & {
  index: CatalogIndex;
  state: UserState;
  progress: ReadonlyMap<string, ConceptProgress>;
  scheduler: Scheduler;
  now: Date;
  /** Misiones conocidas, para proponer refuerzo tras los fallos recientes (`reinforceFrom`). */
  expeditions?: readonly Expedition[];
  /** Pruebas conocidas, para proponer refuerzo tras sus conceptos flojos (`trialReinforceHits`). */
  trials?: readonly Trial[];
};

/** Minutos estimados por tipo de elemento. */
export const ITEM_MINUTES: Readonly<Record<QueueItemType, number>> = { review: 1.5, first: 3, new: 6 };
/** Días hasta una evaluación para activar el modo examen en sus temas. */
const EXAM_MODE_DAYS = 10;
/** En modo examen, lo que no tenga eventos en estos días vuelve a la cola. */
const EXAM_RECENT_DAYS = 4;
/** Días hasta una evaluación para citarla como motivo. */
const EXAM_REASON_DAYS = 30;
const NO_EXAM_URGENCY = 0.35;
/** Urgencia mínima de lo que otra asignatura ya necesita ("adelantar"). */
const ADVANCE_URGENCY = 0.8;
const FIRST_BOOST = 1.2;
/** Parte del presupuesto que pueden ocupar los nuevos si hay repasos. */
const NEW_SHARE = 0.35;
/** A partir de estos días sin repaso, el motivo habla de enfriamiento. */
const COOLING_DAYS = 7;
const EPS = 1e-9;

/** Evaluación futura sin nota, con los días que faltan desde hoy. */
export type UpcomingAssessment = { assessment: Assessment; subjectId: string; days: number };

/**
 * Evaluaciones con fecha ≥ hoy y sin nota, por asignatura, de la más cercana a
 * la más lejana. Solo asignaturas del catálogo.
 */
export function upcomingAssessments(index: CatalogIndex, state: UserState, now: Date): Map<string, UpcomingAssessment[]> {
  const today = dayKey(now);
  const out = new Map<string, UpcomingAssessment[]>();
  for (const s of index.subjects) {
    const list: UpcomingAssessment[] = [];
    for (const a of subjectStateOf(state, s.id).assessments) {
      if (!a.date || a.grade !== undefined) continue;
      const day = dayKey(a.date);
      if (day < today) continue;
      list.push({ assessment: a, subjectId: s.id, days: daysBetween(today, day) });
    }
    if (list.length > 0) out.set(s.id, list.sort((x, y) => x.days - y.days));
  }
  return out;
}

/** "Parcial 1 de Cálculo en 5 días". */
export function assessmentPhrase(index: CatalogIndex, up: UpcomingAssessment): string {
  const short = index.subjectById.get(up.subjectId)?.shortName ?? up.subjectId;
  const title = up.assessment.title.trim() || "Evaluación";
  const withSubject = title.toLocaleLowerCase("es").includes(short.toLocaleLowerCase("es")) ? title : `${title} de ${short}`;
  return `${withSubject} ${inDays(up.days)}`;
}

/** Montículo binario mínimo según `before(a, b)` (true si `a` sale antes). */
class Heap<T> {
  private readonly items: T[] = [];
  constructor(private readonly before: (a: T, b: T) => boolean) {}
  get size() { return this.items.length; }
  push(x: T) {
    const a = this.items;
    a.push(x);
    for (let i = a.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this.before(a[i], a[parent])) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last !== undefined) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < a.length && this.before(a[l], a[best])) best = l;
        if (r < a.length && this.before(a[r], a[best])) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return top;
  }
}

type Candidate = { concept: CatalogConcept; type: QueueItemType; p: ConceptProgress; retrievability: number | null };

export function buildQueue({ index, state, progress, scheduler, now, subjectId, minutes, reviewsOnly, expeditions, trials }: QueueInput): QueueResult {
  const today = dayKey(now);
  const retention = state.settings.desiredRetention;
  const inScope = (id: string) => subjectId === undefined || index.subjectsOfConcept(id).includes(subjectId);
  const rank = (id: string) => index.syllabusRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  const levelOf = (id: string) => progressOf(progress, id).level;
  const daysSince = (t: number) => daysBetween(dayKey(new Date(t)), today);

  // 0. Refuerzo tras una misión o una prueba: conceptos flojos en un intento
  //    de los últimos 7 días (fuera de alcance si se filtra por asignatura).
  //    Solo conceptos del catálogo: uno renombrado o retirado no puede entrar
  //    en la cola (no hay ficha que mostrar).
  const reinforcible = (id: string) => index.conceptById.has(id) && inScope(id);
  const reinforce = new Map<string, ReinforceHit>();
  if (expeditions && expeditions.length > 0) {
    for (const hit of reinforceHits(expeditions, state, now)) if (reinforcible(hit.conceptId)) reinforce.set(hit.conceptId, hit);
  }
  const trialReinforce = new Map<string, TrialReinforceHit>();
  if (trials && trials.length > 0) {
    for (const hit of trialReinforceHits(trials, state, now)) if (reinforcible(hit.conceptId)) trialReinforce.set(hit.conceptId, hit);
  }

  // 1. Evaluaciones próximas y temas en modo examen (la evaluación más cercana de cada tema).
  const upcoming = upcomingAssessments(index, state, now);
  const examByUnit = new Map<string, UpcomingAssessment>();
  for (const list of upcoming.values()) {
    for (const up of list) {
      if (up.days > EXAM_MODE_DAYS) break;
      for (const unitId of up.assessment.unitIds) {
        const known = examByUnit.get(unitId);
        if (!known || up.days < known.days) examByUnit.set(unitId, up);
      }
    }
  }

  // Índice por concepto en una pasada: último evento y último `seen`.
  const lastEventAt = new Map<string, number>();
  const lastSeen = new Map<string, { t: number; e: StudyEvent }>();
  for (const e of state.events) {
    const t = Date.parse(e.at);
    const prev = lastEventAt.get(e.conceptId);
    if (prev === undefined || t > prev) lastEventAt.set(e.conceptId, t);
    if (e.kind === "seen") {
      const s = lastSeen.get(e.conceptId);
      if (!s || t >= s.t) lastSeen.set(e.conceptId, { t, e });
    }
  }

  // 2–3. Repasos (pendientes o de modo examen) y primeros recuerdos.
  const candidates: Candidate[] = [];
  for (const [id, p] of progress) {
    const concept = index.conceptById.get(id);
    if (!concept || !inScope(id)) continue;
    const examUnit = examByUnit.has(concept.unitId);
    if (p.level === 1 && p.reviews === 0 && !p.card) {
      candidates.push({ concept, type: "first", p, retrievability: null });
      continue;
    }
    if (!p.card) continue;
    const r = scheduler.retrievability(p.card, now);
    const last = lastEventAt.get(id);
    const examDue = examUnit && p.level >= 1 && (last === undefined || daysSince(last) >= EXAM_RECENT_DAYS);
    // Un fallo reciente en una misión o una prueba fuerza el repaso aunque el olvido previsto no toque todavía.
    if (r < retention || examDue || reinforce.has(id) || trialReinforce.has(id)) candidates.push({ concept, type: "review", p, retrievability: r });
  }

  // 4. Nuevos: nivel 0 de temas ya alcanzados y lo que otra asignatura ya
  //    necesita (adelantar), en orden de temario, con sus requisitos vistos o
  //    propuestos antes (se itera hasta que no entra ninguno más).
  const newIds: string[] = [];
  const advance = new Map<string, NeededEarly>();
  if (!reviewsOnly) {
    let pool: string[] = [];
    for (const s of index.subjects) {
      if (!isSubjectInProgress(index, state, s.id)) continue;
      const currentUnit = subjectStateOf(state, s.id).currentUnit;
      for (const unit of index.unitsBySubject.get(s.id) ?? []) {
        if (unit.number !== 0 && unit.number > currentUnit) continue;
        for (const c of index.conceptsByUnit.get(unit.id) ?? []) if (levelOf(c.id) === 0 && inScope(c.id)) pool.push(c.id);
      }
    }
    for (const early of neededEarly(index, state)) {
      if (levelOf(early.conceptId) === 0 && inScope(early.conceptId)) advance.set(early.conceptId, early);
    }
    // El refuerzo tras una misión o una prueba también salta la restricción de
    // "tema ya alcanzado" cuando el concepto está a nivel 0 (si no, ya es candidato a repaso arriba).
    const reinforceIds = [...reinforce.keys(), ...trialReinforce.keys()];
    const forced = new Set([...advance.keys(), ...reinforceIds.filter((id) => levelOf(id) === 0)]);
    if (forced.size > 0) pool = [...new Set([...pool, ...forced])].sort((a, b) => rank(a) - rank(b));
    const accepted = new Set<string>();
    let pending = pool;
    for (let changed = true; changed && pending.length > 0;) {
      changed = false;
      const next: string[] = [];
      for (const id of pending) {
        const ready = (index.requiresOf.get(id) ?? []).every((req) => accepted.has(req) || levelOf(req) >= 1);
        if (ready) {
          accepted.add(id);
          newIds.push(id);
          changed = true;
        } else next.push(id);
      }
      pending = next;
    }
    for (const id of newIds) candidates.push({ concept: index.conceptById.get(id)!, type: "new", p: progressOf(progress, id), retrievability: null });
  }

  // 5–6. Prioridad y motivos.
  /**
   * Próxima evaluación que afecta al concepto: de cada asignatura suya, la más
   * cercana que no excluya su tema (en la propietaria, `unitIds` vacío o que lo
   * incluya; en las de `alsoIn` no se puede saber, así que cuenta).
   */
  const nextExamFor = (c: CatalogConcept): UpcomingAssessment | undefined => {
    let best: UpcomingAssessment | undefined;
    for (const sid of index.subjectsOfConcept(c.id)) {
      const hit = upcoming.get(sid)?.find((up) =>
        sid !== c.subjectId || up.assessment.unitIds.length === 0 || up.assessment.unitIds.includes(c.unitId));
      if (hit && (!best || hit.days < best.days)) best = hit;
    }
    return best;
  };
  const urgencyOf = (c: CatalogConcept): number => {
    if (examByUnit.has(c.unitId)) return 1;
    const next = nextExamFor(c);
    // Sin evaluación relevante, 0,35; una lejana no baja de ese suelo.
    const u = next ? Math.max(NO_EXAM_URGENCY, 1 / (1 + next.days / 14)) : NO_EXAM_URGENCY;
    return advance.has(c.id) ? Math.max(u, ADVANCE_URGENCY) : u;
  };
  /** Evaluación que citar: la de modo examen del tema o la próxima (≤ 30 días) que le afecte. */
  const examFor = (c: CatalogConcept): UpcomingAssessment | undefined => {
    const exam = examByUnit.get(c.unitId) ?? nextExamFor(c);
    return exam && exam.days <= EXAM_REASON_DAYS ? exam : undefined;
  };
  const shortName = (sid: string) => index.subjectById.get(sid)?.shortName ?? sid;

  const reasonsFor = ({ concept, type, p, retrievability }: Candidate): string[] => {
    const reasons: string[] = [];
    const early = advance.get(concept.id);
    if (early) {
      const via = index.conceptById.get(early.via)?.name ?? early.via;
      // `bySubject` = la propia asignatura del concepto: cierre transitivo (lo
      // necesita un requisito suyo ya adelantado, no otra asignatura).
      reasons.push(early.bySubject === concept.subjectId
        ? `Adelántalo: lo necesitas para ${via}`
        : `Adelántalo: ya lo necesitas en ${shortName(early.bySubject)} (${via})`);
    }
    const reinforceHit = reinforce.get(concept.id);
    if (reinforceHit) reasons.push(`Reforzar tras la misión ${reinforceHit.expedition.course} (${reinforceHit.expedition.university})`);
    const trialHit = trialReinforce.get(concept.id);
    if (trialHit) reasons.push(`Reforzar tras la prueba «${trialHit.trial.title}»`);
    const exam = examFor(concept);
    if (exam) reasons.push(assessmentPhrase(index, exam));
    if (type === "review") {
      const pct = `${Math.round((retrievability ?? 0) * 100)} %`;
      const lastReview = p.card?.last_review?.getTime() ?? (p.lastReviewAt ? Date.parse(p.lastReviewAt) : undefined);
      if (p.declared) reasons.push("Comprueba que ya lo dominas");
      else if ((retrievability ?? 0) >= retention) reasons.push(`Refuérzalo · recuerdo estimado ${pct}`);
      else if (lastReview !== undefined && daysSince(lastReview) >= COOLING_DAYS) {
        reasons.push(`Se está apagando · último repaso hace ${daysSince(lastReview)} días`);
      } else reasons.push(`Toca repasar · recuerdo estimado ${pct}`);
    } else if (type === "first") {
      const seen = lastSeen.get(concept.id);
      const t = seen?.t ?? (p.firstAt ? Date.parse(p.firstAt) : undefined);
      const n = t === undefined ? 0 : daysSince(t);
      const source = seen?.e.source;
      if (source === "class") {
        const when = n >= 2 && n < 7 ? `el ${WEEKDAYS[new Date(t!).getDay()]}` : daysAgo(n);
        reasons.push(`Lo viste en clase ${when}`);
      } else if (source === "session") reasons.push(`Lo estudiaste ${daysAgo(n)}`);
      else reasons.push(`Lo marcaste ${daysAgo(n)}`);
    } else if (!early) {
      const unit = index.unitById.get(concept.unitId);
      reasons.push(`Siguiente del Tema ${unit?.number ?? "?"} de ${shortName(concept.subjectId)}`);
    }
    const impact = conceptImpact(index, concept.id);
    // Directos para el texto (un número que se pueda leer de un vistazo); los
    // transitivos (`impact.dependents`, que en un concepto muy básico puede
    // llegar a cientos) solo se usan para la prioridad, arriba.
    const directDependents = (index.requiredBy.get(concept.id) ?? []).length;
    if (directDependents >= 3) reasons.push(`Base directa de ${directDependents} conceptos`);
    const later = early ? impact.neededIn.filter((sid) => sid !== early.bySubject) : impact.neededIn;
    if (later.length > 0) reasons.push(`Lo necesitarás en ${listNames(later.map(shortName))}`);
    return reasons;
  };

  const unsorted: QueueItem[] = candidates.map((cand) => {
    const need = cand.type === "review" ? 1 - (cand.retrievability ?? 0) : 1;
    const boost = cand.type === "first" ? FIRST_BOOST : 1;
    const priority = need * (1 + conceptImpact(index, cand.concept.id).score) * urgencyOf(cand.concept) * boost;
    return { conceptId: cand.concept.id, type: cand.type, priority, minutes: ITEM_MINUTES[cand.type], reasons: reasonsFor(cand) };
  });

  // 7. Orden: prioridad descendente (empate: temario), pero un nuevo nunca
  //    antes que un requisito suyo que también esté en la cola.
  const rawItems = orderItems(index, unsorted, rank);

  // Reparto de los "nuevo" en turnos por asignatura: sin esto, con la cola
  // vacía las dos o tres asignaturas de más impacto (más dependientes, más
  // evaluaciones próximas) copan casi todos los huecos de nuevo mientras el estudiante
  // cursa las 10 a la vez. `balancedNew` reordena solo los "nuevo" entre sí
  // (turnos por asignatura, por prioridad dentro de cada una, respetando
  // requisitos); `items` los vuelve a mezclar con repasos y primeros
  // recuerdos por prioridad, así que la asignatura de turno solo adelanta a
  // un repaso si de verdad toca antes.
  const balancedNew = balanceNewBySubject(index, rawItems);
  const items = mergeByPriority(
    balancedNew,
    rawItems.filter((i) => i.type !== "new"),
  );

  // 8. Plan dentro del presupuesto.
  const budget = minutes ?? state.settings.dailyMinutes;
  const reviewMinutes = items.reduce((sum, i) => sum + (i.type === "new" ? 0 : i.minutes), 0);
  const newCap = reviewMinutes > 0 ? Math.max(NEW_SHARE * budget, budget - reviewMinutes) : budget;
  const newSet = new Set(newIds);
  const plannedIds = new Set<string>();
  const planned: QueueItem[] = [];
  let used = 0;
  let newUsed = 0;
  for (const item of items) {
    if (used + item.minutes > budget + EPS) continue;
    if (item.type === "new") {
      if (newUsed + item.minutes > newCap + EPS) continue;
      if ((index.requiresOf.get(item.conceptId) ?? []).some((req) => newSet.has(req) && !plannedIds.has(req))) continue;
      newUsed += item.minutes;
    }
    planned.push(item);
    plannedIds.add(item.conceptId);
    used += item.minutes;
  }

  const totals: QueueTotals = { reviews: 0, first: 0, new: 0, minutes: 0 };
  for (const item of planned) {
    if (item.type === "review") totals.reviews++;
    else if (item.type === "first") totals.first++;
    else totals.new++;
    totals.minutes += item.minutes;
  }
  return { items, planned, totals };
}

/**
 * Ordenación topológica con prioridad: en cada paso sale el elemento de más
 * prioridad cuyos requisitos presentes en la cola ya han salido (solo se
 * restringen los nuevos). Un requisito hereda la prioridad de lo que bloquea,
 * para que salga justo antes y no retrase lo importante. O(n log n + aristas).
 */
function orderItems(index: CatalogIndex, items: QueueItem[], rank: (id: string) => number): QueueItem[] {
  const byId = new Map(items.map((i) => [i.conceptId, i]));
  const blockers = new Map<string, number>();
  const waiting = new Map<string, QueueItem[]>();
  for (const item of items) {
    if (item.type !== "new") continue;
    for (const req of index.requiresOf.get(item.conceptId) ?? []) {
      if (!byId.has(req)) continue;
      blockers.set(item.conceptId, (blockers.get(item.conceptId) ?? 0) + 1);
      const list = waiting.get(req);
      if (list) list.push(item);
      else waiting.set(req, [item]);
    }
  }
  // Prioridad efectiva = máx. de la propia y la de todo lo que espera por él (el grafo es acíclico).
  const effective = new Map<string, number>();
  const effectiveOf = (item: QueueItem): number => {
    const known = effective.get(item.conceptId);
    if (known !== undefined) return known;
    let value = item.priority;
    for (const dep of waiting.get(item.conceptId) ?? []) value = Math.max(value, effectiveOf(dep));
    effective.set(item.conceptId, value);
    return value;
  };
  const heap = new Heap<QueueItem>((a, b) => {
    const ea = effectiveOf(a);
    const eb = effectiveOf(b);
    if (ea !== eb) return ea > eb;
    if (a.priority !== b.priority) return a.priority > b.priority;
    return rank(a.conceptId) < rank(b.conceptId);
  });
  for (const item of items) if (!blockers.get(item.conceptId)) heap.push(item);
  const out: QueueItem[] = [];
  while (heap.size > 0) {
    const item = heap.pop()!;
    out.push(item);
    for (const dep of waiting.get(item.conceptId) ?? []) {
      const left = blockers.get(dep.conceptId)! - 1;
      blockers.set(dep.conceptId, left);
      if (left === 0) heap.push(dep);
    }
  }
  return out;
}

/**
 * Reordena solo los "nuevo" de una secuencia ya priorizada (`orderItems`),
 * en turnos por asignatura: cada vuelta da un turno, por prioridad, a cada
 * asignatura que todavía tenga un candidato listo (sus requisitos —los que
 * también sean "nuevo" hoy— ya emitidos). Conserva un orden topológicamente
 * válido: cada requisito sale antes que lo que lo necesita. El resto de la
 * secuencia (repasos, primeros recuerdos) no se toca aquí.
 */
function balanceNewBySubject(index: CatalogIndex, items: readonly QueueItem[]): QueueItem[] {
  const newSeq = items.filter((i) => i.type === "new");
  if (newSeq.length <= 1) return newSeq;

  const bySubject = new Map<string, QueueItem[]>();
  const subjectOrder: string[] = [];
  for (const item of newSeq) {
    const sid = index.conceptById.get(item.conceptId)?.subjectId ?? "";
    let list = bySubject.get(sid);
    if (!list) {
      list = [];
      bySubject.set(sid, list);
      subjectOrder.push(sid);
    }
    list.push(item);
  }
  subjectOrder.sort((a, b) => (index.subjectById.get(a)?.order ?? Number.MAX_SAFE_INTEGER) - (index.subjectById.get(b)?.order ?? Number.MAX_SAFE_INTEGER));
  // Dentro de cada asignatura, el turno sigue el temario (no el impacto): un
  // requisito muy básico pero con mucho impacto transitivo (p. ej. una base de
  // lógica que hace falta en medio catálogo) puede tener menos prioridad que
  // conceptos más avanzados de su propia asignatura; si el turno siguiera esa
  // prioridad bruta, esa base tardaría muchas vueltas en salir y bloquearía a
  // las demás asignaturas que la necesitan, deshaciendo el reparto.
  const rankOf = (id: string) => index.syllabusRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  for (const list of bySubject.values()) list.sort((a, b) => rankOf(a.conceptId) - rankOf(b.conceptId));

  const newIds = new Set(newSeq.map((i) => i.conceptId));
  const emitted = new Set<string>();
  const out: QueueItem[] = [];
  let active = new Set(subjectOrder);
  while (out.length < newSeq.length && active.size > 0) {
    let progressed = false;
    for (const sid of active) {
      const list = bySubject.get(sid)!;
      if (list.length === 0) {
        active.delete(sid);
        continue;
      }
      // El primero listo de esta asignatura en esta vuelta, no necesariamente
      // el de temario más bajo: si ese va detrás de un requisito que tardará
      // más (p. ej. de otra asignatura), no tiene sentido bloquear con él a
      // otro concepto de la misma asignatura que ya está listo.
      const readyIdx = list.findIndex((item) =>
        (index.requiresOf.get(item.conceptId) ?? []).every((req) => !newIds.has(req) || emitted.has(req)),
      );
      if (readyIdx === -1) continue; // nada de esta asignatura está listo todavía: a la próxima vuelta
      const [item] = list.splice(readyIdx, 1);
      out.push(item);
      emitted.add(item.conceptId);
      progressed = true;
      if (list.length === 0) active.delete(sid);
    }
    if (!progressed) break; // no debería pasar: newSeq ya es un orden topológico válido
  }
  // Por si queda algo sin emitir (no debería), se añade al final en su orden original.
  if (out.length < newSeq.length) {
    const done = new Set(out.map((i) => i.conceptId));
    for (const item of newSeq) if (!done.has(item.conceptId)) out.push(item);
  }
  return out;
}

/** Mezcla dos secuencias ya ordenadas por prioridad descendente en una sola, estable. */
function mergeByPriority(a: readonly QueueItem[], b: readonly QueueItem[]): QueueItem[] {
  const out: QueueItem[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) out.push(a[i].priority >= b[j].priority ? a[i++] : b[j++]);
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}
