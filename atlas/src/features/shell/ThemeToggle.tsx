import { setSettings } from "../../state/actions";
import { useUserState } from "../../state/store";
import { Icons, IconButton } from "../../ui";
import type { Settings } from "../../domain/types";

type Theme = Settings["theme"];
const NEXT: Record<Theme, Theme> = { dark: "light", light: "system", system: "dark" };
export const THEME_NAMES: Record<Theme, string> = { dark: "Observatorio (oscuro)", light: "Carta impresa (claro)", system: "el del sistema" };

/**
 * Cambia el tema en ciclo: Observatorio → Carta impresa → sistema. Se guarda
 * en settings.theme. Un solo icono (`contrast`, exclusivo de tema): `moon`
 * queda reservado para el comodín, el estado actual se lee en el tooltip.
 */
export function ThemeToggle() {
  const theme = useUserState((s) => s.settings.theme);
  return (
    <IconButton
      aria-label={`Tema: ${THEME_NAMES[theme]}. Cambiar a ${THEME_NAMES[NEXT[theme]]}`}
      icon={<Icons.theme />}
      tooltipSide="bottom"
      tooltipAlign="end"
      onClick={() => setSettings({ theme: NEXT[theme] })}
    />
  );
}

/** Pasa al siguiente tema (acción del buscador). */
export const cycleTheme = (current: Theme) => setSettings({ theme: NEXT[current] });
