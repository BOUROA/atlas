import type { CSSProperties } from "react";
import { cx } from "./cx";
import { subjectAbbr, subjectColor, subjectFg, subjectName, subjectSoft } from "./subjects";

type SubjectVars = CSSProperties & { "--c"?: string; "--c-soft"?: string; "--c-fg"?: string };

const varsFor = (subjectId: string): SubjectVars => ({
  "--c": subjectColor(subjectId),
  "--c-soft": subjectSoft(subjectId),
  "--c-fg": subjectFg(subjectId),
});

export type SubjectTagProps = {
  subjectId: string;
  /**
   * code: abreviatura en mono sobre el color al 18 % (tablas, cola) ·
   * name: punto con brillo + nombre (listas, cabeceras).
   */
  variant?: "code" | "name";
  /** Nombre a mostrar/anunciar; por defecto el nombre completo conocido. */
  name?: string;
  size?: "sm" | "md";
  className?: string;
};

/** Etiqueta de asignatura: «CAL» o «• Cálculo». El nombre completo va en title/abbr. */
export function SubjectTag({ subjectId, variant = "code", name, size = "md", className }: SubjectTagProps) {
  const full = name ?? subjectName(subjectId);
  if (variant === "name") {
    return (
      <span className={cx("ui-subject-name", `ui-subject-name--${size}`, className)} style={varsFor(subjectId)}>
        <span className="ui-subject-dot" aria-hidden="true" />
        <span className="ui-subject-name-text">{full}</span>
      </span>
    );
  }
  return (
    <abbr className={cx("ui-subject-tag", `ui-subject-tag--${size}`, className)} title={full} style={varsFor(subjectId)}>
      {subjectAbbr(subjectId)}
    </abbr>
  );
}

export type SubjectDotProps = {
  subjectId?: string;
  /** Color CSS alternativo (si no hay asignatura). */
  color?: string;
  size?: number;
  /** Si se da, el punto se anuncia con este texto; si no, es decorativo. */
  label?: string;
  glow?: boolean;
  className?: string;
};

/** Punto del color de la asignatura, con brillo suave en el tema oscuro. */
export function SubjectDot({ subjectId, color, size = 7, label, glow = true, className }: SubjectDotProps) {
  const style: SubjectVars = {
    "--c": color ?? (subjectId ? subjectColor(subjectId) : "var(--text-3)"),
    width: size,
    height: size,
  };
  return (
    <span
      className={cx("ui-subject-dot", !glow && "ui-subject-dot--flat", className)}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
