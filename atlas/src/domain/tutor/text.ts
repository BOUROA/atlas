// Pequeñas utilidades de redacción en español para los textos del tutor. Puro.

/** "1 concepto" / "3 conceptos". */
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "A", "A y B", "A, B y 3 más" (como mucho `max` nombres). */
export function listNames(names: readonly string[], max = 2): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= max) return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(", ")} y ${names.length - max} más`;
}

/** Plazo hasta una fecha futura: "hoy", "mañana", "en 5 días". */
export const inDays = (n: number): string => (n <= 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`);

/** Tiempo transcurrido: "hoy", "ayer", "hace 5 días". */
export const daysAgo = (n: number): string => (n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`);

export const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** Primera letra en minúscula salvo que parezca una sigla ("Parcial 1" → "parcial 1", "PEC 2" se queda). */
export const lowerFirst = (s: string): string =>
  s.length > 1 && s[1] === s[1].toUpperCase() && s[1] !== s[1].toLowerCase() ? s : s.charAt(0).toLowerCase() + s.slice(1);
