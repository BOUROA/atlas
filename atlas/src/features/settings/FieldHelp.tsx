/**
 * ⓘ junto a un título: abre la explicación larga en un tooltip en vez de
 * dejarla fija como párrafo (regla de densidad 6, docs/diseno-visual.md).
 */
import { Icons, ICON_SIZE, Tooltip } from "../../ui";

export function FieldHelp({ label, content }: { label: string; content: string }) {
  return (
    <Tooltip content={content}>
      <button type="button" className="settings-field-help" aria-label={`Ayuda: ${label}`}>
        <Icons.help size={ICON_SIZE.row.size} strokeWidth={ICON_SIZE.row.strokeWidth} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
