// Plantilla de calendario online: evaluación continua (40 %) + examen final
// (60 %) para las asignaturas que todavía no tienen ninguna evaluación
// (especificación §3). Puro: no lee ni escribe el estado, solo lo propone.
import type { CatalogIndex } from "./catalog";
import { addDays, dayKey, parseDayKey } from "./time";
import { DEFAULT_FINAL_DAY } from "./route";
import { subjectStateOf, type Assessment, type UserState } from "./types";

/** Días laborables entre `startDay` y `endDay`, ambos incluidos. */
function businessDays(startDay: string, endDay: string): string[] {
  const days: string[] = [];
  const end = parseDayKey(endDay);
  for (let d = parseDayKey(startDay); d <= end; d = addDays(d, 1)) {
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) days.push(dayKey(d));
  }
  return days;
}

/**
 * La evaluación que queda al editar `existing` con `next` (spec §3): la marca
 * `template` se quita en cuanto cambian la fecha o el peso, y solo entonces.
 * Si `next` no trae la clave `template` (un formulario que no la conoce), se
 * conserva la de `existing`; un `template: false` explícito se respeta. Nunca
 * deja la clave con valor falso o indefinido.
 */
export function assessmentAfterEdit(existing: Assessment | undefined, next: Assessment): Assessment {
  const { template: _given, ...rest } = next;
  const flag = "template" in next ? next.template : existing?.template;
  const edited = existing !== undefined && (next.date !== existing.date || next.weight !== existing.weight);
  return flag && !edited ? { ...rest, template: true } : rest;
}

/** Días laborables del 8 al 19 de febrero de 2027, uno por asignatura (spec §3). */
export const TEMPLATE_FINAL_DAYS: readonly string[] = businessDays(DEFAULT_FINAL_DAY, "2027-02-19");

/**
 * Propone la plantilla online para las asignaturas del curso actual que aún no
 * tienen ninguna evaluación: "Evaluación continua" (sin fecha, peso 40) y
 * "Examen final" (peso 60), con fecha escalonada en un día laborable según la
 * posición de la asignatura entre las del curso actual (si hay más asignaturas
 * que días, se usa el último). Ambas con `template: true`. No modifica el estado.
 */
export function onlineTemplate(index: CatalogIndex, state: UserState): Record<string, Assessment[]> {
  const out: Record<string, Assessment[]> = {};
  index.subjects.filter((s) => s.status === "current").forEach((subject, i) => {
    if (subjectStateOf(state, subject.id).assessments.length > 0) return;
    const unitIds = (index.unitsBySubject.get(subject.id) ?? []).map((u) => u.id);
    const day = TEMPLATE_FINAL_DAYS[Math.min(i, TEMPLATE_FINAL_DAYS.length - 1)];
    out[subject.id] = [
      { id: `${subject.id}.plantilla.continua`, title: "Evaluación continua", kind: "entrega", weight: 40, unitIds, template: true },
      { id: `${subject.id}.plantilla.final`, title: "Examen final", kind: "final", date: day, weight: 60, unitIds, template: true },
    ];
  });
  return out;
}
