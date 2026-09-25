// Estrella o tema bajo el puntero (fuera de React: solo lo leen el tooltip y las aristas de hover).
import { useSyncExternalStore } from "react";

export type Hover = { kind: "node" | "unit"; id: string } | null;

let hover: Hover = null;
const listeners = new Set<() => void>();

export function setHover(h: Hover) {
  if (h?.id === hover?.id && h?.kind === hover?.kind) return;
  hover = h;
  for (const l of listeners) l();
}
export const getHover = () => hover;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const useHover = (): Hover => useSyncExternalStore(subscribe, getHover, getHover);
