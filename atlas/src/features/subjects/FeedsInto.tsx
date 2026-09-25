// Pestaña "Te servirá para": asignaturas y conceptos que dependen de esta,
// una fila por asignatura con un avance de 3 conceptos; el resto, al abrirla
// (regla 4: fusionar en filas en vez de 76 chips sueltos).
import { catalog } from "../../state/catalog";
import { openConcept } from "../../state/router";
import { feedsInto } from "../../domain/graph";
import { EmptyState, SubjectTag, plural } from "../../ui";

const PREVIEW_SHOWN = 3;

export function FeedsInto({ subjectId }: { subjectId: string }) {
  const feeds = feedsInto(catalog, subjectId);

  if (feeds.length === 0) {
    return <EmptyState size="sm" title="Aún no alimenta a otra asignatura" description="Ningún concepto de otra asignatura requiere todavía uno de esta." />;
  }

  return (
    <ul className="subjects-feeds-list">
      {feeds.map((feed) => {
        const subject = catalog.subjectById.get(feed.subjectId);
        if (!subject) return null;
        const names = feed.concepts.map((id) => catalog.conceptById.get(id)?.name).filter((n): n is string => !!n);
        const shown = names.slice(0, PREVIEW_SHOWN);
        const rest = names.length - shown.length;
        return (
          <li key={feed.subjectId} className="subjects-feeds-row-wrap">
            <details className="subjects-feeds-row">
              <summary>
                <SubjectTag subjectId={feed.subjectId} variant="name" />
                <span className="tone-3 subjects-feeds-count">{plural(feed.concepts.length, "concepto", "conceptos")}</span>
                <span className="tone-3 subjects-feeds-preview">
                  {shown.join(", ")}
                  {rest > 0 && ` +${rest}`}
                </span>
              </summary>
              <ul className="subjects-feeds-chips">
                {feed.concepts.map((id) => {
                  const c = catalog.conceptById.get(id);
                  if (!c) return null;
                  return (
                    <li key={id}>
                      <button type="button" className="subjects-chip" onClick={() => openConcept(id)}>
                        {c.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
