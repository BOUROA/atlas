/**
 * Asignaturas · Task 6.
 *
 * export function SubjectsScreen(): JSX.Element — lista (#/asignaturas), sin props.
 * export function SubjectDetailScreen(props: { subjectId: string; tab: string | null }): JSX.Element
 *   — detalle (#/asignatura/:id?tab=temario|evaluacion|bases|despues).
 */
import "./subjects.css";

export { SubjectsScreen } from "./SubjectsList";
export { SubjectDetailScreen } from "./SubjectDetail";
