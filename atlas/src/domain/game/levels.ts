// Nivel de jugador y rangos (especificación §7). Puro.

/** XP necesaria para pasar del nivel `n` al `n + 1`. */
export const xpToNext = (n: number): number => Math.round(120 * n ** 1.6);

export type PlayerLevel = { level: number; into: number; needed: number };

/** Nivel a partir de la XP total: empieza en 1 y resta `xpToNext` sucesivos. */
export function levelFromXp(xp: number): PlayerLevel {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, needed: xpToNext(level) };
}

/** Rangos astronómicos, uno cada 5 niveles (sistema visual «Observatorio»). */
export const RANKS = [
  "Polvo estelar", "Nebulosa", "Protoestrella", "Estrella", "Gigante",
  "Supergigante", "Púlsar", "Cúmulo", "Galaxia", "Supernova",
] as const;
export type Rank = (typeof RANKS)[number];

export const rankOf = (level: number): Rank => RANKS[Math.max(0, Math.min(9, Math.floor((level - 1) / 5)))];
