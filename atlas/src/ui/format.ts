// Formatos de presentación en español de España. Puros: sin React ni DOM.
// Entre cifra y unidad se usa espacio duro (U+00A0) para que "88 %" o
// "2 h 10 min" no se partan al final de línea.

const NBSP = " ";
const MINUS = "−";

const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAYS_INITIAL = ["D", "L", "M", "X", "J", "V", "S"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const nf = new Map<number, Intl.NumberFormat>();
/** Número con separadores españoles: 12.340 · 3,5 (es-ES no agrupa cifras de 4 dígitos). */
export function num(n: number, digits = 0): string {
  let f = nf.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    nf.set(digits, f);
  }
  return f.format(n);
}

/** Palabra en singular o plural según n (sin la cifra). */
export function pluralWord(n: number, one: string, many: string): string {
  return Math.abs(n) === 1 ? one : many;
}

/** Cifra + palabra concordada: plural(1, "concepto", "conceptos") → "1 concepto". */
export function plural(n: number, one: string, many: string): string {
  return `${num(n)}${NBSP}${pluralWord(n, one, many)}`;
}

/** Proporción 0–1 como porcentaje: pct(0.876) → "88 %". null → "—". */
export function pct(r: number | null | undefined, digits = 0): string {
  if (r == null || Number.isNaN(r)) return "—";
  return `${num(r * 100, digits)}${NBSP}%`;
}

/** Minutos legibles: 130 → "2 h 10 min" · 45 → "45 min" · 180 → "3 h". */
export function minutes(m: number): string {
  const total = Math.max(0, Math.round(m));
  const h = Math.floor(total / 60);
  const min = total % 60;
  if (h === 0) return `${min}${NBSP}min`;
  if (min === 0) return `${num(h)}${NBSP}h`;
  return `${num(h)}${NBSP}h ${min}${NBSP}min`;
}

/** Minutos compactos para etiquetas estrechas: 26 → "26′" · 130 → "2 h 10". */
export function minutesShort(m: number): string {
  const total = Math.max(0, Math.round(m));
  if (total < 60) return `${total}′`;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return min === 0 ? `${num(h)}${NBSP}h` : `${num(h)}${NBSP}h${NBSP}${String(min).padStart(2, "0")}`;
}

/** Días relativos: 0 "hoy" · 1 "mañana" · −1 "ayer" · 5 "en 5 días" · −3 "hace 3 días". */
export function relDays(n: number): string {
  const d = Math.round(n);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  return d > 0 ? `en ${num(d)}${NBSP}días` : `hace ${num(-d)}${NBSP}días`;
}

/** Cifra con signo tipográfico: 3 → "+3" · −2 → "−2" · 0 → "0". */
export function signed(n: number, digits = 0): string {
  if (n > 0) return `+${num(n, digits)}`;
  if (n < 0) return `${MINUS}${num(-n, digits)}`;
  return num(0, digits);
}

/**
 * Convierte a Date. Un "YYYY-MM-DD" se interpreta como medianoche local
 * (new Date("2026-10-03") sería medianoche UTC y podría caer en el día anterior).
 */
export function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(input);
}

/** Clave de día local "YYYY-MM-DD". */
export function dayKeyOf(input: Date | string | number): string {
  const d = toDate(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Día de la semana: "jueves" · "jue" (short) · "J" (initial, L M X J V S D). */
export function weekday(date: Date | string, style: "long" | "short" | "initial" = "long"): string {
  const i = toDate(date).getDay();
  return style === "short" ? WEEKDAYS_SHORT[i] : style === "initial" ? WEEKDAYS_INITIAL[i] : WEEKDAYS_LONG[i];
}

/** Mes: "septiembre" · "sep" (short). */
export function month(date: Date | string, style: "long" | "short" = "long"): string {
  const i = toDate(date).getMonth();
  return style === "short" ? MONTHS_SHORT[i] : MONTHS_LONG[i];
}

/** Fecha corta: "sáb 3 oct". */
export function dateShort(iso: Date | string): string {
  const d = toDate(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Fecha larga: "jueves, 24 de septiembre" (con year: "… de 2026"). */
export function dateLong(iso: Date | string, opts: { year?: boolean } = {}): string {
  const d = toDate(iso);
  const base = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
  return opts.year ? `${base} de ${d.getFullYear()}` : base;
}

/** Hora "19:10". */
export function time(iso: Date | string): string {
  const d = toDate(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Primera letra en mayúscula: "jueves" → "Jueves". */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("es-ES") + s.slice(1) : s;
}
