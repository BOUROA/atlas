// Panel de ficha sobre cualquier ruta: se abre con ?c=<id>.
import { useRef } from "react";
import { ConceptPanel } from "../concept";
import { catalog } from "../../state/catalog";
import { closeConcept, navigate, useRoute } from "../../state/router";
import { Icons, IconButton, SidePanel, SubjectTag } from "../../ui";

export function ConceptPanelHost() {
  const { query } = useRoute();
  const id = query.get("c");
  const concept = id ? catalog.conceptById.get(id) : undefined;
  // Conserva el último concepto mientras el panel se cierra con su animación.
  const lastRef = useRef(concept);
  if (concept) lastRef.current = concept;
  const shown = concept ?? lastRef.current;
  const unit = shown ? catalog.unitById.get(shown.unitId) : undefined;

  return (
    <SidePanel
      open={!!concept}
      onClose={closeConcept}
      title={shown?.name ?? ""}
      closeLabel="Cerrar la ficha"
      eyebrow={
        shown && (
          <>
            <SubjectTag subjectId={shown.subjectId} size="sm" />
            {unit && (
              <span>
                Tema {unit.number} · {unit.title}
              </span>
            )}
          </>
        )
      }
      actions={
        shown && (
          <IconButton
            aria-label="Ver en el mapa"
            icon={<Icons.map />}
            tooltipSide="bottom"
            tooltipAlign="end"
            onClick={() => navigate(`/mapa?foco=${encodeURIComponent(shown.id)}`)}
          />
        )
      }
    >
      {shown && <ConceptPanel key={shown.id} conceptId={shown.id} />}
    </SidePanel>
  );
}
