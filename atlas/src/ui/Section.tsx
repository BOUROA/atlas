import { createElement, useId, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "./cx";

export type SectionProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** Título en serif. */
  title: ReactNode;
  /** Etiqueta mono en versalitas encima del título ("Ordenada por impacto"). */
  eyebrow?: ReactNode;
  /** Resalta la etiqueta superior en dorado. */
  eyebrowGold?: boolean;
  /** Número de orden de la sección ("01"), delante de la etiqueta superior. */
  number?: string | number;
  /** Frase bajo el título, en gris. */
  description?: ReactNode;
  /** Acción a la derecha del título (enlace quiet, Segmented, etc.). */
  action?: ReactNode;
  /** Envuelve la sección en una Card. */
  card?: boolean;
  tone?: "default" | "glow" | "dashed" | "flat";
  pad?: "none" | "sm" | "md" | "lg";
  as?: "section" | "div" | "article" | "aside";
  headingLevel?: 2 | 3;
  ref?: Ref<HTMLElement>;
};

/**
 * Bloque con cabecera: etiqueta mono + título serif + acción opcional.
 * Con `card` es una tarjeta completa (el caso habitual en la maqueta).
 */
export function Section({
  title,
  eyebrow,
  eyebrowGold,
  number,
  description,
  action,
  card,
  tone = "default",
  pad = "md",
  as = "section",
  headingLevel = 2,
  className,
  children,
  ref,
  ...rest
}: SectionProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const numberText = number == null ? null : typeof number === "number" ? String(number).padStart(2, "0") : number;
  const head = (
    <header className="ui-section-head">
      <div className="ui-section-titles">
        {(eyebrow != null || numberText != null) && (
          <p className={cx("mono-label", "ui-section-eyebrow", eyebrowGold && "is-gold")}>
            {numberText != null && <span className="ui-section-number">{numberText}</span>}
            {eyebrow}
          </p>
        )}
        {createElement(`h${headingLevel}`, { id: titleId, className: "ui-section-title" }, title)}
        {description != null && <p className="ui-section-desc">{description}</p>}
      </div>
      {action != null && <div className="ui-section-action">{action}</div>}
    </header>
  );
  return createElement(
    as,
    {
      ref,
      "aria-labelledby": titleId,
      ...rest,
      className: cx("ui-section", card && "ui-card", card && `ui-card--${tone}`, card && `ui-pad--${pad}`, className),
    },
    head,
    children,
  );
}

export type PageProps = HTMLAttributes<HTMLElement> & { as?: "main" | "div"; ref?: Ref<HTMLElement> };

/** Contenedor de página: ancho máximo 1440, márgenes laterales y capa por encima del cielo. */
export function Page({ as = "div", className, ref, ...rest }: PageProps) {
  return createElement(as, { ref, ...rest, className: cx("ui-page", className) });
}
