import { useEffect, useId, useRef, useState } from "react";

/**
 * Mantiene montado un elemento mientras dura su animación de salida.
 * Devuelve `mounted` (pintarlo o no) y `state` ("open" | "closed") para el CSS.
 */
export function useExitTransition(open: boolean, ms = 220): { mounted: boolean; state: "open" | "closed" } {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");

  useEffect(() => {
    if (open) {
      setMounted(true);
      // un fotograma en "closed" para que la transición de entrada arranque
      const id = requestAnimationFrame(() => setState("open"));
      return () => cancelAnimationFrame(id);
    }
    setState("closed");
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setMounted(false), reduce ? 0 : ms);
    return () => clearTimeout(t);
  }, [open, ms]);

  return { mounted, state };
}

/** Devuelve el foco al elemento que lo tenía cuando `active` pasó a true. */
export function useRestoreFocus(active: boolean): void {
  const prev = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    prev.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = prev.current;
      if (el && el.isConnected && typeof el.focus === "function") el.focus({ preventScroll: true });
    };
  }, [active]);
}

/** true si el usuario pide movimiento reducido (se actualiza en vivo). */
export function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** useId apto para referencias SVG url(#…): solo letras, cifras, guiones y guiones bajos. */
export function useSvgId(prefix = "u"): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
