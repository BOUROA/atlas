/** Control deslizante accesible, con la cifra actual a la derecha de la etiqueta. */
import { useId } from "react";
import { FieldHelp } from "./FieldHelp";

export function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <span className="settings-field-label">
          <label htmlFor={id}>{label}</label>
          {hint && <FieldHelp label={label} content={hint} />}
        </span>
        <span className="settings-field-value num">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="settings-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format(value)}
      />
    </div>
  );
}
