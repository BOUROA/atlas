import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { cx } from "./cx";
import { useExitTransition } from "./hooks";

export type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Etiqueta mono sobre el título (p. ej. la asignatura). */
  eyebrow?: ReactNode;
  /** Acciones extra en la cabecera, a la izquierda del botón de cerrar. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Pie fijo (acciones principales). */
  footer?: ReactNode;
  /** Ancho en escritorio (por defecto 520 px). */
  width?: number;
  closeLabel?: string;
  className?: string;
};

/**
 * Panel lateral derecho (≥ 768 px) u hoja inferior (móvil). No es modal en
 * escritorio: la página sigue usable detrás (p. ej. el mapa). Esc o el botón lo
 * cierran; en móvil también el velo y arrastrar el asa hacia abajo.
 */
export function SidePanel({
  open,
  onClose,
  title,
  eyebrow,
  actions,
  children,
  footer,
  width,
  closeLabel = "Cerrar panel",
  className,
}: SidePanelProps) {
  const { mounted, state } = useExitTransition(open, 260);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const drag = useRef<{ y: number; dy: number } | null>(null);

  // el panel se pinta en <body> (por encima de cualquier contexto de apilamiento);
  // si se abre dentro de un ámbito con data-theme propio, lo hereda
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [scopeTheme, setScopeTheme] = useState<string | undefined>(undefined);
  useLayoutEffect(() => {
    const scope = anchorRef.current?.closest<HTMLElement>("[data-theme]");
    setScopeTheme(scope && scope !== document.documentElement ? scope.dataset.theme : undefined);
  }, [mounted]);

  // foco al abrir (cuando ya está montado) y devolución al cerrar si seguía dentro
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) openerRef.current = document.activeElement as HTMLElement | null;
  }, [open]);
  useEffect(() => {
    if (!open || !mounted) return;
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      const inside = !active || active === document.body || (panel != null && panel.contains(active));
      const opener = openerRef.current;
      if (inside && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, mounted]);

  // Esc cierra salvo que haya un diálogo modal abierto encima
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted) return <span ref={anchorRef} hidden />;

  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !panelRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panelRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onHandleUp = () => {
    if (!drag.current || !panelRef.current) return;
    const { dy } = drag.current;
    drag.current = null;
    panelRef.current.style.transform = "";
    if (dy > 110) onCloseRef.current();
  };

  const style = width ? ({ "--panel-w": `${width}px` } as CSSProperties) : undefined;

  return (
    <>
      <span ref={anchorRef} hidden />
      {createPortal(
        <div data-theme={scopeTheme} className="ui-panel-portal">
          <div className="ui-panel-scrim" data-state={state} onClick={() => onCloseRef.current()} aria-hidden="true" />
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-state={state}
            className={cx("ui-panel", className)}
            style={style}
          >
            <div
              className="ui-panel-handle"
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              aria-hidden="true"
            >
              <span />
            </div>
            <header className="ui-panel-head">
              <div className="ui-panel-titles">
                {eyebrow != null && <div className="ui-panel-eyebrow mono-label">{eyebrow}</div>}
                <h2 id={titleId} className="ui-panel-title">
                  {title}
                </h2>
              </div>
              <div className="ui-panel-actions">
                {actions}
                <IconButton aria-label={closeLabel} icon={<X size={18} />} onClick={() => onCloseRef.current()} tooltipSide="bottom" tooltipAlign="end" />
              </div>
            </header>
            <div className="ui-panel-body">{children}</div>
            {footer != null && <footer className="ui-panel-foot">{footer}</footer>}
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
