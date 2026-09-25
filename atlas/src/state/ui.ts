// Estado efímero de la interfaz compartido entre pantallas y shell (no se guarda):
// buscador Ctrl K y diálogo «Hoy en clase he visto…».
import { useSyncExternalStore } from "react";

export type UiState = { searchOpen: boolean; classLogOpen: boolean };

let ui: UiState = { searchOpen: false, classLogOpen: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<UiState>) => {
  const next = { ...ui, ...patch };
  if (next.searchOpen === ui.searchOpen && next.classLogOpen === ui.classLogOpen) return;
  ui = next;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const get = () => ui;

export function useUi(): UiState {
  return useSyncExternalStore(subscribe, get, get);
}

/** Abre el buscador (Ctrl K). */
export const openSearch = () => set({ searchOpen: true, classLogOpen: false });
export const closeSearch = () => set({ searchOpen: false });
/** Abre «Hoy en clase he visto…» (atajo N). */
export const openClassLog = () => set({ classLogOpen: true, searchOpen: false });
export const closeClassLog = () => set({ classLogOpen: false });
