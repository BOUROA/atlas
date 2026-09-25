// Campañas de élite: la escalera de misiones (expediciones) de una
// asignatura, ordenada por dificultad (especificación §5). Puro: reutiliza
// `scoreOf`, `readiness` y `PASSING_GRADE` de expeditions.ts.
import { PASSING_GRADE, readiness, scoreOf, type Readiness } from "./expeditions";
import type { Expedition, UserState } from "./types";
import type { ConceptProgress } from "./tutor/mastery";

const KIND_ORDER: Record<Expedition["kind"], number> = { quiz: 0, parcial: 1, final: 2 };
/** Dificultad por defecto cuando la misión no declara la suya, según su tipo. */
const FALLBACK_DIFFICULTY: Record<Expedition["kind"], NonNullable<Expedition["difficulty"]>> = { quiz: 1, parcial: 2, final: 3 };

export type CampaignRung = {
  expedition: Expedition;
  difficulty: NonNullable<Expedition["difficulty"]>;
  /** Mejor nota de los intentos terminados, o `null` si no se ha intentado. */
  best: number | null;
  /** true si `best` ≥ 7. */
  passed: boolean;
  /** El primer peldaño sin superar. */
  isNext: boolean;
  /** El último peldaño de la campaña. */
  isSummit: boolean;
  readiness: Readiness;
};
export type Campaign = {
  subjectId: string;
  /** Peldaños, ordenados por dificultad, después por tipo (quiz < parcial < final) y después por id. */
  rungs: CampaignRung[];
  /** Peldaños superados. */
  passed: number;
  /** true si la cumbre (el último peldaño) está superada. */
  summitPassed: boolean;
};

/** Mejor nota de los intentos terminados de una misión, o `null` si ninguno lo está. */
export function bestExpeditionScore(exp: Expedition, state: UserState): number | null {
  const attempts = (state.expeditions?.[exp.id] ?? []).filter((a) => a.endedAt);
  if (attempts.length === 0) return null;
  return Math.max(...attempts.map((a) => scoreOf(exp, a)));
}

/**
 * Campaña de élite de una asignatura: las misiones que la incluyen en `subjects`,
 * ordenadas por dificultad (la propia o, si no la declara, la de su tipo), después
 * por tipo y después por id. El siguiente peldaño es el primero sin superar; la
 * cumbre es el último de la lista.
 */
export function campaignOf(
  subjectId: string,
  expeditions: readonly Expedition[],
  state: UserState,
  progress: ReadonlyMap<string, ConceptProgress>,
): Campaign {
  const own = expeditions
    .filter((e) => e.subjects.includes(subjectId))
    .map((e) => ({ e, difficulty: e.difficulty ?? FALLBACK_DIFFICULTY[e.kind] }))
    .sort((a, b) => a.difficulty - b.difficulty || KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] || a.e.id.localeCompare(b.e.id));

  let foundNext = false;
  const rungs: CampaignRung[] = own.map(({ e, difficulty }, i) => {
    const best = bestExpeditionScore(e, state);
    const passed = best !== null && best >= PASSING_GRADE;
    const isNext = !passed && !foundNext;
    if (isNext) foundNext = true;
    return { expedition: e, difficulty, best, passed, isNext, isSummit: i === own.length - 1, readiness: readiness(e, progress) };
  });

  return {
    subjectId,
    rungs,
    passed: rungs.filter((r) => r.passed).length,
    summitPassed: rungs.length > 0 ? rungs[rungs.length - 1].passed : false,
  };
}
