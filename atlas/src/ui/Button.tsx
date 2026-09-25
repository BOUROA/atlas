import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "./cx";
import { Kbd } from "./Kbd";

export type ButtonVariant = "primary" | "ink" | "ghost" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonOwnProps = {
  /**
   * primary: la acción protagonista (dorada; una por pantalla) ·
   * ink: secundaria sólida · ghost: contorno discreto · quiet: enlace dorado.
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icono delante del texto (lucide). En primary lg va dentro de un disco. */
  icon?: ReactNode;
  /** Icono detrás del texto (p. ej. un chevron en quiet). */
  iconEnd?: ReactNode;
  /** Atajo visible: "Intro" o ["Ctrl", "K"]. Es decorativo: pon el atajo real en aria-keyshortcuts. */
  kbd?: string | string[];
  /** Ocupa todo el ancho disponible. */
  block?: boolean;
  /** Destello que recorre el botón primary lg (por defecto sí). */
  shine?: boolean;
  className?: string;
  children?: ReactNode;
};

export type ButtonProps = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps> & { href?: undefined; ref?: Ref<HTMLButtonElement> };

export type LinkButtonProps = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonOwnProps> & { href: string; ref?: Ref<HTMLAnchorElement> };

function classes(p: ButtonOwnProps) {
  const variant = p.variant ?? "ghost";
  const size = p.size ?? "md";
  const shine = variant === "primary" && size === "lg" && p.shine !== false;
  return cx("ui-btn", `ui-btn--${variant}`, `ui-btn--${size}`, p.block && "ui-btn--block", shine && "ui-btn--shine", p.className);
}

function Content({ icon, iconEnd, kbd, children, variant, size }: ButtonOwnProps) {
  const disc = variant === "primary" && size === "lg";
  return (
    <>
      {icon != null && (
        <span className={cx("ui-btn-icon", disc && "ui-btn-icon--disc")} aria-hidden="true">
          {icon}
        </span>
      )}
      {children != null && <span className="ui-btn-label">{children}</span>}
      {iconEnd != null && (
        <span className="ui-btn-icon ui-btn-icon--end" aria-hidden="true">
          {iconEnd}
        </span>
      )}
      {kbd != null && (
        <span className="ui-btn-kbd" aria-hidden="true">
          {typeof kbd === "string" ? <Kbd>{kbd}</Kbd> : <Kbd keys={kbd} />}
        </span>
      )}
    </>
  );
}

/**
 * Botón. Con `href` se pinta como enlace con el mismo aspecto.
 * <Button variant="primary" size="lg" icon={<Play />} kbd="Intro">Empezar sesión</Button>
 */
export function Button(props: ButtonProps | LinkButtonProps) {
  const { variant, size, icon, iconEnd, kbd, block, shine, className, children, ...rest } = props;
  const own = { variant: variant ?? "ghost", size: size ?? "md", icon, iconEnd, kbd, block, shine, className, children };
  if (typeof props.href === "string") {
    const { ref, ...anchor } = rest as LinkButtonProps;
    return (
      <a ref={ref} {...anchor} className={classes(own)}>
        <Content {...own} />
      </a>
    );
  }
  const { ref, type, ...button } = rest as ButtonProps;
  return (
    <button ref={ref} type={type ?? "button"} {...button} className={classes(own)}>
      <Content {...own} />
    </button>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  /** Obligatorio: nombre accesible del botón (y texto de su tooltip). */
  "aria-label": string;
  icon: ReactNode;
  variant?: "ghost" | "quiet" | "ink";
  size?: "sm" | "md" | "lg";
  /** Muestra el aria-label como tooltip al pasar o enfocar (por defecto sí). */
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom";
  /** Alineación del tooltip: "end" para botones pegados al borde derecho. */
  tooltipAlign?: "center" | "start" | "end";
  ref?: Ref<HTMLButtonElement>;
};

/** Botón solo con icono. El aria-label es obligatorio y se reutiliza como tooltip. */
export function IconButton({
  icon,
  variant = "quiet",
  size = "md",
  tooltip = true,
  tooltipSide = "top",
  tooltipAlign = "center",
  className,
  type,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      {...rest}
      data-tip={tooltip ? rest["aria-label"] : undefined}
      data-tip-side={tooltip ? tooltipSide : undefined}
      data-tip-align={tooltip && tooltipAlign !== "center" ? tooltipAlign : undefined}
      className={cx("ui-iconbtn", `ui-iconbtn--${variant}`, `ui-iconbtn--${size}`, className)}
    >
      <span aria-hidden="true" className="ui-iconbtn-glyph">
        {icon}
      </span>
    </button>
  );
}
