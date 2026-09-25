import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  size?: "sm" | "md";
  /** pill: cápsula con la opción activa elevada · chips: píldoras separadas. */
  variant?: "pill" | "chips";
  className?: string;
};

/** Control segmentado (grupo de opción única). Flechas ← → para cambiar. */
export function Segmented<T extends string>({ options, value, onChange, size = "md", variant = "pill", className, ...aria }: SegmentedProps<T>) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const enabled = options.filter((o) => !o.disabled);

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = enabled.findIndex((o) => o.value === value);
    let next: SegmentedOption<T> | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = enabled[(idx + 1) % enabled.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  return (
    <div className={cx("ui-seg", `ui-seg--${variant}`, `ui-seg--${size}`, className)} role="radiogroup" aria-label={aria["aria-label"]} onKeyDown={move}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) refs.current.set(o.value, el);
              else refs.current.delete(o.value);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            className={cx("ui-seg-opt", on && "is-on")}
            onClick={() => onChange(o.value)}
          >
            {o.icon != null && (
              <span className="ui-seg-icon" aria-hidden="true">
                {o.icon}
              </span>
            )}
            {o.label}
            {o.count != null && <em className="num">{o.count}</em>}
          </button>
        );
      })}
    </div>
  );
}
