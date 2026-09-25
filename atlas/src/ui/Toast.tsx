import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { cx } from "./cx";

export type ToastTone = "default" | "gold" | "frost" | "ember";

export type ToastOptions = {
  /** Botón de acción ("Deshacer"). Al pulsarlo el aviso se cierra. */
  action?: { label: string; onClick: () => void };
  description?: ReactNode;
  tone?: ToastTone;
  /** Icono o insignia a la izquierda. */
  icon?: ReactNode;
  /** ms antes de cerrarse (por defecto 4000; 0 = no se cierra solo). */
  duration?: number;
  /** Reutiliza un id para sustituir un aviso ya visible. */
  id?: string;
};

type ToastItem = ToastOptions & { id: string; message: ReactNode; leaving?: boolean };

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;
const MAX_VISIBLE = 4;

function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => items;

function dismiss(id?: string) {
  items = items.map((t) => (id == null || t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    items = items.filter((t) => !(t.leaving && (id == null || t.id === id)));
    emit();
  }, 180);
}

/**
 * Muestra un aviso en la pila de abajo a la derecha (4 s por defecto).
 * toast("Registrado: Límites", { action: { label: "Deshacer", onClick: undoLast } })
 * Devuelve el id del aviso.
 */
export function toast(message: ReactNode, opts: ToastOptions = {}): string {
  const id = opts.id ?? `t${++seq}`;
  const next: ToastItem = { duration: 4000, tone: "default", ...opts, id, message };
  const exists = items.some((t) => t.id === id);
  items = exists ? items.map((t) => (t.id === id ? next : t)) : [...items, next].slice(-MAX_VISIBLE);
  emit();
  return id;
}
toast.dismiss = dismiss;

function ToastView({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration ?? 4000);
  const started = useRef(Date.now());

  useEffect(() => {
    remaining.current = item.duration ?? 4000;
  }, [item.duration, item.message]);

  useEffect(() => {
    if (!item.duration || paused || item.leaving) return;
    started.current = Date.now();
    const t = setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started.current));
    };
  }, [item.id, item.duration, item.leaving, paused]);

  return (
    <div
      className={cx("ui-toast", `ui-toast--${item.tone ?? "default"}`, item.leaving && "is-leaving")}
      role={item.tone === "ember" ? "alert" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {item.icon != null && (
        <span className="ui-toast-icon" aria-hidden="true">
          {item.icon}
        </span>
      )}
      <div className="ui-toast-text">
        <p className="ui-toast-msg">{item.message}</p>
        {item.description != null && <p className="ui-toast-desc">{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          className="ui-toast-action"
          onClick={() => {
            item.action?.onClick();
            dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      <IconButton aria-label="Cerrar aviso" icon={<X size={15} />} size="sm" tooltip={false} onClick={() => dismiss(item.id)} className="ui-toast-close" />
    </div>
  );
}

/** Pila de avisos. Móntala una vez (el shell de la app). */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  // sin avisos también se pinta la región, para que los lectores de pantalla la conozcan
  return createPortal(
    <section className="ui-toaster" aria-label="Avisos" aria-live="polite">
      {list.map((t) => (
        <ToastView key={t.id} item={t} />
      ))}
    </section>,
    document.body,
  );
}
