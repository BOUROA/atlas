// Utilidades de fecha puras (sin React ni DOM). Nunca usar Date.now() ni
// `new Date()` sin argumentos aquí: todo recibe la fecha como parámetro.

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Formato "YYYY-MM-DD" (DayKey). */
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "YYYY-MM-DD" en la zona horaria local, a partir de un Date o un string.
 * Un string que ya tiene forma "YYYY-MM-DD" se devuelve tal cual (idempotente):
 * `new Date("YYYY-MM-DD")` lo interpretaría como medianoche UTC, que en husos
 * horarios al oeste de UTC cae en el día anterior en hora local.
 */
export const dayKey = (d: Date | string): string => {
  if (typeof d === "string" && DAY_KEY_RE.test(d)) return d;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) throw new Error(`dayKey: fecha inválida (${JSON.stringify(d)})`);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

/** Construye la medianoche local del DayKey dado (inverso de `dayKey` para strings de solo fecha). */
export const parseDayKey = (key: string): Date => {
  if (!DAY_KEY_RE.test(key)) throw new Error(`parseDayKey: se esperaba "YYYY-MM-DD", se recibió ${JSON.stringify(key)}`);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Diferencia en días naturales entre dos "YYYY-MM-DD", ignorando el cambio de hora. */
export const daysBetween = (a: string, b: string): number => {
  if (!DAY_KEY_RE.test(a)) throw new Error(`daysBetween: se esperaba "YYYY-MM-DD", se recibió ${JSON.stringify(a)}`);
  if (!DAY_KEY_RE.test(b)) throw new Error(`daysBetween: se esperaba "YYYY-MM-DD", se recibió ${JSON.stringify(b)}`);
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const utcA = Date.UTC(ay, am - 1, ad);
  const utcB = Date.UTC(by, bm - 1, bd);
  return Math.round((utcB - utcA) / 86_400_000);
};

/** Clave de semana ISO-8601 (lunes a domingo), p.ej. "2026-W39". */
export const isoWeekKey = (d: Date): string => {
  // Se trabaja sobre una fecha UTC construida a partir de los componentes
  // locales, para que el algoritmo estándar de semana ISO no se vea afectado
  // por el cambio de hora.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // lunes = 1 ... domingo = 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // jueves de esa semana ISO
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
};

/** Nuevo Date, n días después (o antes, si n < 0), preservando la hora local. */
export const addDays = (d: Date, n: number): Date => {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
};

/** Nuevo Date a medianoche local del mismo día. */
export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * `dayKey` con memoria del último día: para recorrer muchos instantes (ISO o
 * milisegundos) casi ordenados sin crear un Date por cada uno. Cada llamada a
 * `createDayKeyer()` devuelve una función independiente.
 */
export const createDayKeyer = (): ((at: string | number) => string) => {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  let key = "";
  return (at) => {
    const t = typeof at === "number" ? at : Date.parse(at);
    if (t >= lo && t < hi) return key;
    const d = new Date(t);
    key = dayKey(d);
    lo = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    hi = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    return key;
  };
};
