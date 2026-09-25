// Atajos globales (fuera de campos de texto y sin diálogos abiertos):
//   Ctrl/Cmd+K o «/»  buscador          g h  Hoy        g a  Asignaturas
//   n                 registrar clase   g m  Mapa       g i  Misiones
//   s                 empezar sesión    g p  Progreso   g j  Ajustes
import { useEffect } from "react";
import { navigate, currentRoute } from "../../state/router";
import { openClassLog, openSearch } from "../../state/ui";

const SEQUENCE_MS = 1200;
const G_TARGETS: Record<string, string> = { h: "/hoy", a: "/asignaturas", m: "/mapa", i: "/misiones", p: "/progreso", j: "/ajustes" };

const isTyping = (el: Element | null) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
};

export function useGlobalShortcuts(): void {
  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && key === "k") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(document.activeElement)) return;
      if (document.querySelector("dialog[open]")) return;
      if (currentRoute().name === "sesion") return; // la sesión tiene sus propias teclas

      if (gAt && Date.now() - gAt < SEQUENCE_MS) {
        gAt = 0;
        const target = G_TARGETS[key];
        if (target) {
          e.preventDefault();
          navigate(target);
        }
        return;
      }
      if (key === "g") {
        gAt = Date.now();
        return;
      }
      if (key === "/") {
        e.preventDefault();
        openSearch();
      } else if (key === "n") {
        e.preventDefault();
        openClassLog();
      } else if (key === "s") {
        e.preventDefault();
        navigate("/sesion");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
