// Estado personal: store externo (useSyncExternalStore) persistido en el
// servidor local (GET/PUT /api/state) con copia en localStorage.
//
// - init(): carga del servidor; si no hay datos, usa la caché o un estado vacío y lo sube.
//   Si el servidor no responde, arranca con la caché ("offline") y reintenta cada 15 s.
// - update(fn): cambio inmutable; notifica, guarda en la caché y en el servidor (debounce 800 ms).
// - 409 (otro dispositivo guardó antes): fusiona con mergeStates y reintenta una vez.
// - Al ocultar la pestaña se guarda ya; al cerrarla, keepalive si cabe y la caché
//   marcada como pendiente (se fusiona en el siguiente arranque).
import { useRef, useSyncExternalStore } from "react";
import { emptyUserState, type UserState } from "../domain/types";
import { mergeStates } from "../domain/sync";
import { redirectToLogin } from "./session";

export type SaveStatus = "loading" | "saved" | "saving" | "offline" | "error";

const API = "/api/state";
/**
 * Clave de la caché en localStorage. En FlipyERP Academy se separa por usuario
 * (setCacheNamespace) para que dos personas en el mismo navegador nunca
 * fusionen sus progresos.
 */
let cacheKey = "atlas.v2.cache";
const SAVE_DEBOUNCE_MS = 800;
const CACHE_DEBOUNCE_MS = 250;
const RETRY_MS = 15_000;
const REQUEST_TIMEOUT_MS = 8_000;
/** Límite de cuerpo de fetch keepalive (64 KB) con margen. */
const KEEPALIVE_MAX = 60_000;

type CacheRecord = { rev: number; dirty: boolean; state: UserState };

let state: UserState = emptyUserState(new Date().toISOString());
let rev = 0;
let status: SaveStatus = "loading";
let dirty = false;
let saving = false;
let saveAgain = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let cacheTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let initPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();
const statusListeners = new Set<() => void>();

const notify = () => {
  for (const l of listeners) l();
};
const setStatus = (next: SaveStatus) => {
  if (next === status) return;
  status = next;
  for (const l of statusListeners) l();
};

/** Estado válido de la versión 2 (lo mínimo para no romper la app). */
export function isUserState(x: unknown): x is UserState {
  const s = x as UserState | null;
  return !!s && typeof s === "object" && s.version === 2 && Array.isArray(s.events) && Array.isArray(s.sessions)
    && !!s.settings && typeof s.settings === "object" && !!s.notes && !!s.subjects && !!s.achievements && !!s.seen;
}

/** Rellena campos que falten en estados antiguos o parciales. */
function normalize(s: UserState): UserState {
  const base = emptyUserState(s.createdAt ?? new Date().toISOString());
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...s.settings },
    seen: { ...base.seen, ...s.seen },
  };
}

function readCache(): CacheRecord | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRecord | UserState;
    if (isUserState(parsed)) return { rev: 0, dirty: true, state: normalize(parsed) };
    const rec = parsed as CacheRecord;
    return isUserState(rec.state) ? { rev: rec.rev ?? 0, dirty: !!rec.dirty, state: normalize(rec.state) } : null;
  } catch {
    return null;
  }
}

function writeCacheNow() {
  if (cacheTimer) {
    clearTimeout(cacheTimer);
    cacheTimer = null;
  }
  try {
    const rec: CacheRecord = { rev, dirty, state };
    localStorage.setItem(cacheKey, JSON.stringify(rec));
  } catch {
    /* sin espacio o sin almacenamiento: el servidor sigue siendo la copia buena */
  }
}
const writeCacheSoon = () => {
  if (cacheTimer) return;
  cacheTimer = setTimeout(writeCacheNow, CACHE_DEBOUNCE_MS);
};

async function request(method: "GET" | "PUT", body?: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(API, {
      method,
      cache: "no-store",
      signal: ctrl.signal,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // FlipyERP Academy: la sesión ha caducado o se ha cerrado en otro sitio.
    // La caché queda marcada como pendiente y se fusiona al volver a entrar.
    if (res.status === 401) {
      writeCacheNow();
      redirectToLogin();
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}

const isNetworkError = (e: unknown) => e instanceof TypeError || (e instanceof DOMException && e.name === "AbortError");

function scheduleSave(delay = SAVE_DEBOUNCE_MS) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void save();
  }, delay);
}

async function save(): Promise<void> {
  if (status === "loading") return;
  if (saving) {
    saveAgain = true;
    return;
  }
  if (!dirty) return;
  saving = true;
  setStatus("saving");
  try {
    let sent = state;
    let res = await request("PUT", { baseRev: rev, state: sent });
    if (res.status === 409) {
      const remote = (await res.json()) as { rev: number; state: UserState | null };
      rev = remote.rev;
      if (remote.state && isUserState(remote.state)) {
        state = mergeStates(state, normalize(remote.state));
        notify();
      }
      sent = state;
      res = await request("PUT", { baseRev: rev, state: sent });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { rev: number };
    rev = body.rev;
    if (state === sent) dirty = false;
    stopRetry();
    setStatus(dirty ? "saving" : "saved");
    writeCacheNow();
    if (dirty) scheduleSave();
  } catch (e) {
    setStatus(isNetworkError(e) ? "offline" : "error");
    writeCacheNow();
    startRetry();
  } finally {
    saving = false;
    if (saveAgain) {
      saveAgain = false;
      scheduleSave(0);
    }
  }
}

/** Recupera la conexión: trae el estado del servidor, lo fusiona con el local y guarda. */
async function reconnect(): Promise<void> {
  try {
    const res = await request("GET");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { rev: number; state: UserState | null };
    rev = body.rev;
    if (body.state && isUserState(body.state)) {
      const merged = mergeStates(normalize(body.state), state);
      if (merged !== state) {
        state = merged;
        notify();
      }
    }
    dirty = true;
    stopRetry();
    await save();
  } catch {
    setStatus("offline");
  }
}

function startRetry() {
  if (retryTimer) return;
  retryTimer = setInterval(() => void reconnect(), RETRY_MS);
}
function stopRetry() {
  if (!retryTimer) return;
  clearInterval(retryTimer);
  retryTimer = null;
}

async function doInit(): Promise<void> {
  const cached = readCache();
  const fresh = () => emptyUserState(new Date().toISOString());
  try {
    const res = await request("GET");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { rev: number; state: UserState | null };
    rev = body.rev;
    if (body.state && isUserState(body.state)) {
      const remote = normalize(body.state);
      // Cambios hechos sin conexión (o al cerrar) que no llegaron al servidor.
      if (cached?.dirty) {
        state = mergeStates(remote, cached.state);
        dirty = true;
      } else state = remote;
    } else {
      state = cached?.state ?? fresh();
      dirty = true;
    }
    status = "saved";
    writeCacheNow();
    if (dirty) await save();
  } catch {
    state = cached?.state ?? fresh();
    rev = cached?.rev ?? 0;
    dirty = cached?.dirty ?? true;
    status = "offline";
    startRetry();
  }
  for (const l of statusListeners) l();
  notify();
}

function onHidden() {
  if (document.visibilityState === "hidden" && dirty && status !== "loading") {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    void save();
  }
}

function onUnload() {
  if (!dirty || status === "loading") return;
  writeCacheNow();
  try {
    const body = JSON.stringify({ baseRev: rev, state });
    if (body.length < KEEPALIVE_MAX) {
      void fetch(API, { method: "PUT", keepalive: true, headers: { "content-type": "application/json" }, body });
    }
  } catch {
    /* la caché pendiente se fusiona en el próximo arranque */
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", onUnload);
  window.addEventListener("beforeunload", onUnload);
}

export const store = {
  /** Separa la caché local por usuario. Llamar antes de init(). */
  setCacheNamespace(userId: string): void {
    cacheKey = `academy.v1.cache.${userId}`;
  },
  getState(): UserState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Cambio inmutable: `fn` devuelve el nuevo estado (o el mismo para no hacer nada). */
  update(fn: (s: UserState) => UserState): void {
    const next = fn(state);
    if (next === state) return;
    state = next;
    dirty = true;
    notify();
    writeCacheSoon();
    if (status !== "loading") {
      if (status === "saved" || status === "error") setStatus("saving");
      scheduleSave();
    }
  },
  /** Sustituye el estado completo (importar copia) y lo guarda enseguida. */
  replace(next: UserState): void {
    state = normalize(next);
    dirty = true;
    notify();
    writeCacheNow();
    if (status !== "loading") scheduleSave(0);
  },
  status(): SaveStatus {
    return status;
  },
  subscribeStatus(listener: () => void): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  },
  /** Carga inicial (idempotente). */
  init(): Promise<void> {
    initPromise ??= doInit();
    return initPromise;
  },
  /** Guarda ya lo pendiente. */
  async flush(): Promise<void> {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    writeCacheNow();
    await save();
  },
};

/**
 * Lee una parte del estado y se vuelve a pintar cuando cambia.
 * `selector` debe devolver algo del propio estado (o un primitivo); si crea un
 * objeto nuevo, el componente se pinta con cada cambio del estado (sin bucles).
 */
export function useUserState<T>(selector: (s: UserState) => T): T {
  const memoRef = useRef<{ s: UserState; sel: (s: UserState) => T; v: T } | null>(null);
  const get = () => {
    const m = memoRef.current;
    if (m && m.s === state && m.sel === selector) return m.v;
    const v = selector(state);
    memoRef.current = { s: state, sel: selector, v };
    return v;
  };
  return useSyncExternalStore(store.subscribe, get, get);
}

/** Estado de guardado para el indicador de la cabecera. */
export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(store.subscribeStatus, store.status, store.status);
}
