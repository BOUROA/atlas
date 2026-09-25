import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { cx } from "./cx";

export type DialogProps = {
  open: boolean;
  /** Se llama al pulsar Esc, el botón de cerrar o fuera del diálogo. */
  onClose: () => void;
  title: ReactNode;
  /** Etiqueta mono sobre el título. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Acciones al pie (alineadas a la derecha). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Cerrar al pulsar fuera (por defecto sí). */
  dismissable?: boolean;
  closeLabel?: string;
  className?: string;
};

/**
 * Diálogo modal accesible sobre <dialog> nativo: foco atrapado por el navegador,
 * Esc cierra y el foco vuelve al elemento que lo abrió. El foco inicial va al
 * elemento con `data-autofocus` (p. ej. el primer campo) o, si no hay, al primero enfocable.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = "md",
  dismissable = true,
  closeLabel = "Cerrar",
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      const opener = document.activeElement as HTMLElement | null;
      el.showModal();
      // foco inicial: el elemento marcado con data-autofocus (si no, el primero enfocable)
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      return () => {
        if (el.open) el.close();
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      };
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx("ui-dialog", `ui-dialog--${size}`, className)}
      aria-labelledby={titleId}
      aria-describedby={description != null ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // solo si el clic empezó y acabó fuera de la caja (no al soltar una selección)
        if (dismissable && downOnBackdrop.current && e.target === e.currentTarget) onCloseRef.current();
        downOnBackdrop.current = false;
      }}
    >
      {open && (
        <div className="ui-dialog-box">
          <header className="ui-dialog-head">
            <div>
              {eyebrow != null && <p className="mono-label is-gold">{eyebrow}</p>}
              <h2 id={titleId} className="ui-dialog-title">
                {title}
              </h2>
              {description != null && (
                <p id={descId} className="ui-dialog-desc">
                  {description}
                </p>
              )}
            </div>
            <IconButton aria-label={closeLabel} icon={<X size={18} />} onClick={() => onCloseRef.current()} tooltip={false} className="ui-dialog-close" />
          </header>
          {children != null && <div className="ui-dialog-body">{children}</div>}
          {footer != null && <footer className="ui-dialog-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
