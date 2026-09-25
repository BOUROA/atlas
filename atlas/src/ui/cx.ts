/** Une clases CSS ignorando los valores vacíos. */
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  let out = "";
  for (const p of parts) if (p) out = out ? `${out} ${p}` : p;
  return out;
}

/** Hash FNV-1a de 32 bits: estable para derivar semillas y variaciones visuales. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generador pseudoaleatorio determinista (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
