/**
 * Apuntes por tema · #/apuntes/:id.
 *
 * export function NotesScreen(props: { unitId: string }): JSX.Element
 */
// El cuerpo se pinta con TrialMd (Markdown + tablas + KaTeX): trae su propio
// CSS aparte del de la pantalla de prueba, así que lo importamos aquí para no
// depender de haber visitado antes una prueba.
import "../trial/trial.css";
import "./notes.css";

export { NotesScreen } from "./NotesScreen";
