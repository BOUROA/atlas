// Apuntes por tema: content/apuntes/<asignatura>/<unidad>.md (docs/apuntes-guia.md).
// Carga perezosa (import.meta.glob sin `eager`) para no inflar el bundle inicial:
// cada fichero solo se descarga cuando se abre su lector (#/apuntes/<unidad>).
const files = import.meta.glob<string>("../../content/apuntes/*/*.md", { query: "?raw", import: "default" });

/** unitId ("logica.t1") → ruta del glob que lo carga. Se deriva del nombre de fichero. */
const pathByUnitId = new Map<string, string>();
for (const path of Object.keys(files)) {
  const unitId = path.slice(path.lastIndexOf("/") + 1, -".md".length);
  pathByUnitId.set(unitId, path);
}

/** true si el tema tiene apuntes (síncrono: no descarga el fichero). */
export function hasNotes(unitId: string): boolean {
  return pathByUnitId.has(unitId);
}

/** Ids de tema con apuntes, sin orden particular. */
export function notesUnitIds(): string[] {
  return [...pathByUnitId.keys()];
}

/** Carga el Markdown del tema (lanza si no tiene apuntes: compruébalo antes con `hasNotes`). */
export function loadNotes(unitId: string): Promise<string> {
  const path = pathByUnitId.get(unitId);
  if (!path) return Promise.reject(new Error(`Sin apuntes: "${unitId}"`));
  return files[path]();
}
