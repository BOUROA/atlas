import { useSaveStatus, type SaveStatus } from "../../state/store";
import { cx } from "../../ui";

const TEXT: Record<SaveStatus, string> = {
  loading: "Cargando…",
  saved: "Guardado",
  saving: "Guardando…",
  offline: "Sin conexión: se guarda en este navegador",
  error: "No se pudo guardar: se reintentará",
};
const SHORT: Record<SaveStatus, string> = {
  loading: "Cargando",
  saved: "Guardado",
  saving: "Guardando",
  offline: "Sin conexión",
  error: "Sin guardar",
};

/** Punto de estado de guardado + texto (el texto largo va en el tooltip). */
export function SaveIndicator({ compact = false }: { compact?: boolean }) {
  const status = useSaveStatus();
  return (
    <span className={cx("shell-save", `shell-save--${status}`, compact && "shell-save--compact")} role="status" aria-live="polite" title={TEXT[status]}>
      <i aria-hidden="true" />
      <span className={compact ? "sr-only" : "shell-save-text"}>{compact ? TEXT[status] : SHORT[status]}</span>
    </span>
  );
}
