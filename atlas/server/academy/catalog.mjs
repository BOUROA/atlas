// Metadatos del catálogo que necesita el servidor: asignaturas (constelaciones)
// e itinerarios. El contenido completo lo empaqueta el frontend; el servidor
// solo decide qué constelaciones tiene asignadas cada alumno.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class EnrollmentError extends Error {}

export function loadCatalogMeta(contentDir) {
  const subjects = JSON.parse(readFileSync(join(contentDir, "subjects.json"), "utf8"));
  const itinerariesFile = join(contentDir, "itineraries.json");
  const itineraries = existsSync(itinerariesFile) ? JSON.parse(readFileSync(itinerariesFile, "utf8")) : [];
  return buildCatalogMeta(subjects, itineraries);
}

export function buildCatalogMeta(subjects, itineraries) {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const itineraryById = new Map(itineraries.map((i) => [i.id, i]));
  return { subjects, itineraries, subjectById, itineraryById };
}

/**
 * Cierra una lista de constelaciones con sus prerrequisitos (campo
 * `prerequisites` de subjects.json), sin repetir y en el orden del catálogo.
 * Lanza EnrollmentError si alguna no existe.
 */
export function closeOverPrerequisites(meta, ids) {
  const out = new Set();
  const visit = (id) => {
    if (out.has(id)) return;
    const subject = meta.subjectById.get(id);
    if (!subject) throw new EnrollmentError(`Constelación desconocida: ${id}`);
    out.add(id);
    for (const pre of subject.prerequisites ?? []) visit(pre);
  };
  for (const id of ids) visit(id);
  return meta.subjects.filter((s) => out.has(s.id)).map((s) => s.id);
}

/**
 * Resuelve lo que se asigna a un alumno:
 *  - con `itineraryId`: las constelaciones de ese itinerario más `subjectIds` extra;
 *  - sin él (a medida): exactamente `subjectIds`.
 * En ambos casos se añaden los prerrequisitos.
 *
 * @param {ReturnType<typeof buildCatalogMeta>} meta
 * @param {{ itineraryId?: string | null, subjectIds?: string[] }} [request]
 * @returns {{ itineraryId: string | null, subjectIds: string[] }}
 */
export function resolveEnrollment(meta, { itineraryId = null, subjectIds = [] } = {}) {
  if (!Array.isArray(subjectIds) || subjectIds.some((id) => typeof id !== "string")) {
    throw new EnrollmentError("subjectIds debe ser una lista de ids");
  }
  let base = [];
  if (itineraryId) {
    const itinerary = meta.itineraryById.get(itineraryId);
    if (!itinerary) throw new EnrollmentError(`Itinerario desconocido: ${itineraryId}`);
    base = itinerary.subjects;
  }
  const ids = closeOverPrerequisites(meta, [...base, ...subjectIds]);
  if (ids.length === 0) throw new EnrollmentError("El itinerario no tiene ninguna constelación");
  return { itineraryId: itineraryId || null, subjectIds: ids };
}
