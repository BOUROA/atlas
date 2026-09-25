// Rutas por hash: #/ruta/param?consulta. La ficha de concepto se abre con
// ?c=<id> sobre cualquier ruta (el botón atrás la cierra y la vuelve a abrir).
import { useSyncExternalStore } from "react";

export type RouteName =
  | "hoy"
  | "sesion"
  | "asignaturas"
  | "asignatura"
  | "mapa"
  | "misiones"
  | "mision"
  | "guia"
  | "prueba"
  | "apuntes"
  | "progreso"
  | "ajustes"
  | "ui";

export type Route = {
  name: RouteName;
  /** Parámetros de ruta: `id` en asignatura, mision, guia y prueba. */
  params: Record<string, string>;
  /** Consulta (?a=b). No la mutes: usa `setQuery`. */
  query: URLSearchParams;
  /** Ruta normalizada sin consulta, p. ej. "/asignatura/calculo". */
  path: string;
};

const SIMPLE: Record<string, RouteName> = {
  "": "hoy",
  hoy: "hoy",
  sesion: "sesion",
  asignaturas: "asignaturas",
  mapa: "mapa",
  misiones: "misiones",
  progreso: "progreso",
  ajustes: "ajustes",
  ui: "ui",
};
const WITH_ID: Record<string, RouteName> = { asignatura: "asignatura", mision: "mision", guia: "guia", prueba: "prueba", apuntes: "apuntes" };

/** Interpreta un hash ("#/asignatura/calculo?tab=evaluacion"). Lo desconocido va a Hoy. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const qi = raw.indexOf("?");
  const pathPart = (qi >= 0 ? raw.slice(0, qi) : raw).replace(/^\/+|\/+$/g, "");
  const query = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : "");
  const [head = "", id, ...rest] = pathPart.split("/").map((p) => decodeURIComponent(p));
  if (rest.length === 0) {
    if (id === undefined && head in SIMPLE) return { name: SIMPLE[head], params: {}, query, path: `/${head || "hoy"}` };
    if (id !== undefined && id !== "" && head in WITH_ID) return { name: WITH_ID[head], params: { id }, query, path: `/${head}/${encodeURIComponent(id)}` };
  }
  return { name: "hoy", params: {}, query, path: "/hoy" };
}

let current: Route = parseHash(typeof window === "undefined" ? "" : window.location.hash);
const listeners = new Set<() => void>();

function refresh() {
  const next = parseHash(window.location.hash);
  if (next.path === current.path && next.query.toString() === current.query.toString()) return;
  current = next;
  for (const l of listeners) l();
}

if (typeof window !== "undefined") window.addEventListener("hashchange", refresh);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getRoute = () => current;

/** Ruta actual (se actualiza con el hash). */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, getRoute);
}
/** Ruta actual fuera de React. */
export const currentRoute = (): Route => current;

const toHash = (path: string) => `#${path.startsWith("#") ? path.slice(1) : path.startsWith("/") ? path : `/${path}`}`;

/**
 * Navega a una ruta: navigate("/asignatura/calculo?tab=evaluacion").
 * Por defecto añade una entrada al historial; `replace` la sustituye.
 * `keepConcept` conserva la ficha abierta (?c=) en la ruta nueva.
 */
export function navigate(path: string, opts: { replace?: boolean; keepConcept?: boolean } = {}): void {
  let hash = toHash(path);
  if (opts.keepConcept) {
    const c = current.query.get("c");
    if (c) {
      const target = parseHash(hash);
      target.query.set("c", c);
      hash = `#${target.path}?${target.query.toString()}`;
    }
  }
  if (hash === window.location.hash) return;
  if (opts.replace) {
    history.replaceState(history.state, "", hash);
    refresh();
  } else window.location.hash = hash;
}

/** Enlace para un <a href>: href("/mapa?lente=examen") → "#/mapa?lente=examen". */
export const href = (path: string): string => toHash(path);

/** Cambia parámetros de la consulta de la ruta actual (null los quita). Por defecto sustituye la entrada. */
export function setQuery(patch: Record<string, string | number | null | undefined>, opts: { push?: boolean } = {}): void {
  const q = new URLSearchParams(current.query);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const qs = q.toString();
  navigate(`${current.path}${qs ? `?${qs}` : ""}`, { replace: !opts.push });
}

/** Abre la ficha de un concepto sobre la ruta actual (entrada nueva en el historial). */
export function openConcept(conceptId: string): void {
  if (current.query.get("c") === conceptId) return;
  setQuery({ c: conceptId }, { push: true });
}

/** Cierra la ficha (sustituye la entrada: atrás vuelve a la ruta anterior a abrirla). */
export function closeConcept(): void {
  if (current.query.has("c")) setQuery({ c: null });
}

/** Concepto abierto en la ficha (?c=), o null. */
export const conceptParam = (): string | null => current.query.get("c");
