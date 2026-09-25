import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export type TabItem<T extends string = string> = {
  id: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
};

export type TabsProps<T extends string> = {
  /** Id base: las pestañas son `${id}-tab-${item}` y los paneles `${id}-panel-${item}`. */
  id: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  size?: "md" | "lg";
  className?: string;
};

export const tabId = (tabs: string, item: string) => `${tabs}-tab-${item}`;
export const panelId = (tabs: string, item: string) => `${tabs}-panel-${item}`;

/**
 * Pestañas con tabindex itinerante: ← → Inicio Fin cambian de pestaña (activación
 * automática). La activa se subraya en oro. Pinta el contenido con <TabPanel>.
 */
export function Tabs<T extends string>({ id, items, value, onChange, size = "md", className, ...aria }: TabsProps<T>) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const enabled = items.filter((i) => !i.disabled);

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = enabled.findIndex((i) => i.id === value);
    let next: TabItem<T> | undefined;
    if (e.key === "ArrowRight") next = enabled[(idx + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className={cx("ui-tabs", `ui-tabs--${size}`, className)} role="tablist" aria-label={aria["aria-label"]} onKeyDown={move}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) refs.current.set(item.id, el);
              else refs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            id={tabId(id, item.id)}
            aria-selected={selected}
            aria-controls={panelId(id, item.id)}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={cx("ui-tab", selected && "is-selected")}
            onClick={() => onChange(item.id)}
          >
            {item.icon != null && (
              <span className="ui-tab-icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="ui-tab-label">{item.label}</span>
            {item.count != null && <em className="ui-tab-count num">{item.count}</em>}
          </button>
        );
      })}
    </div>
  );
}

export type TabPanelProps = {
  /** El mismo `id` que se pasó a <Tabs>. */
  tabs: string;
  /** Pestaña a la que pertenece este panel. */
  tab: string;
  children: ReactNode;
  className?: string;
};

/** Panel de una pestaña. Píntalo solo para la pestaña activa. */
export function TabPanel({ tabs, tab, children, className }: TabPanelProps) {
  return (
    <div role="tabpanel" id={panelId(tabs, tab)} aria-labelledby={tabId(tabs, tab)} tabIndex={0} className={cx("ui-tabpanel", className)}>
      {children}
    </div>
  );
}
