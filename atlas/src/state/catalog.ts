// Catálogo cargado de content/ (se empaqueta con la app). Inmutable.
import { buildCatalog, CatalogIndex } from "../domain/catalog";
import type { Expedition, Legend, Profile, Subject, SubjectContent, Trial } from "../domain/types";
import subjectsJson from "../../content/subjects.json";
import expeditionsJson from "../../content/expeditions.json";
import legendsJson from "../../content/legends.json";
import profilesJson from "../../content/profiles.json";

const subjectList = subjectsJson as Subject[];

// Solo los ficheros de asignatura declarados en subjects.json (content/ también
// guarda misiones, leyendas y perfiles).
const subjectFiles = new Set(subjectList.map((s) => s.file));
const files = import.meta.glob<SubjectContent>("../../content/*.json", { eager: true, import: "default" });
const contents = Object.entries(files)
  .filter(([path]) => subjectFiles.has(path.slice(path.lastIndexOf("/") + 1)))
  .map(([, content]) => content);

/** Índice del catálogo completo (asignaturas, temas, conceptos y relaciones). */
export const catalog = new CatalogIndex(buildCatalog(subjectList, contents));

/** Asignaturas del curso actual, en orden de carril (`order`). */
const current: Subject[] = catalog.subjects.filter((s) => s.status === "current");
export const currentSubjects: readonly Subject[] = current;

/**
 * FlipyERP Academy: aplica el itinerario del alumno. Las constelaciones
 * asignadas pasan a "current" (activas en el motor) y el resto a "future"
 * (visibles como pendientes). Se llama una sola vez, al arrancar y ANTES de
 * montar la app, porque los derivados leen `status` y `currentSubjects`.
 * No es un control de acceso: el contenido completo va en el paquete, que el
 * servidor solo entrega con sesión iniciada.
 */
export function applyEnrollment(subjectIds: readonly string[]): void {
  const enrolled = new Set(subjectIds);
  for (const s of catalog.subjects) (s as { status: Subject["status"] }).status = enrolled.has(s.id) ? "current" : "future";
  current.splice(0, current.length, ...catalog.subjects.filter((s) => s.status === "current"));
}

/** Misiones: exámenes reales de otras universidades. */
export const expeditions: readonly Expedition[] = (expeditionsJson as unknown as { expeditions: Expedition[] }).expeditions;
/** Estrellas guía históricas (leyendas). */
export const legends: readonly Legend[] = (legendsJson as unknown as { legends: Legend[] }).legends;
/** Estrellas guía contemporáneas (perfiles destacados). */
export const profiles: readonly Profile[] = (profilesJson as unknown as { profiles: Profile[] }).profiles;
/** Todas las estrellas guía (leyendas y perfiles), como las espera `evaluateAchievements`. */
export const guides: readonly (Legend | Profile)[] = [...legends, ...profiles];

export const expeditionById: ReadonlyMap<string, Expedition> = new Map(expeditions.map((e) => [e.id, e]));
export const guideById: ReadonlyMap<string, Legend | Profile> = new Map(guides.map((g) => [g.id, g]));

/** true si la estrella guía es una leyenda (tiene `route`); si no, es un perfil (tiene `territory`). */
export const isLegend = (g: Legend | Profile): g is Legend => "route" in g;

// Pruebas sintéticas: un fichero por asignatura en content/trials/ (la
// carpeta puede no existir todavía o estar vacía). El fichero guarda
// `subjectId` una sola vez; se copia en cada prueba.
type TrialFile = { subjectId: string; trials: Omit<Trial, "subjectId">[] };
const trialFiles = import.meta.glob<TrialFile>("../../content/trials/*.json", { eager: true, import: "default" });

/** Pruebas sintéticas de todas las asignaturas piloto (un fichero sin `trials` no aporta ninguna). */
export const trials: readonly Trial[] = Object.values(trialFiles).flatMap((f) => (f.trials ?? []).map((t) => ({ ...t, subjectId: f.subjectId })));
export const trialById: ReadonlyMap<string, Trial> = new Map(trials.map((t) => [t.id, t]));
export const trialsBySubject: ReadonlyMap<string, readonly Trial[]> = (() => {
  const bySubject = new Map<string, Trial[]>();
  for (const t of trials) {
    const list = bySubject.get(t.subjectId);
    if (list) list.push(t);
    else bySubject.set(t.subjectId, [t]);
  }
  return bySubject;
})();
