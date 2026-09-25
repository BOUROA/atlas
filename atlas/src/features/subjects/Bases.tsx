// Pestaña "Bases": requisitos externos de la asignatura, ordenados por
// cuántos de sus conceptos dependen de cada uno.
import { catalog } from "../../state/catalog";
import { useDerived } from "../../state/derived";
import { href, openConcept } from "../../state/router";
import { externalBases } from "../../domain/graph";
import { progressOf } from "../../domain/tutor/mastery";
import { Button, EmptyState, ICON_SIZE, Icons, LevelBars, SubjectTag, plural } from "../../ui";
import { LIT_LEVEL } from "./helpers";

export function Bases({ subjectId }: { subjectId: string }) {
  const derived = useDerived();
  const bases = externalBases(catalog, subjectId);

  if (bases.length === 0) {
    return <EmptyState size="sm" title="Sin bases externas" description="Esta asignatura no requiere directamente ningún concepto de otra." />;
  }

  const missing = bases.filter((b) => progressOf(derived.progress, b.conceptId).level < LIT_LEVEL);
  const practiceHref = missing.length === 0 ? null : href(`/sesion?ids=${missing.map((b) => encodeURIComponent(b.conceptId)).join(",")}`);

  return (
    <div className="subjects-bases">
      <p className="subjects-tab-intro tone-2">{plural(bases.length, "base", "bases")} · ordenadas por cuánto dependen de ellas</p>
      <ul className="subjects-bases-list">
        {bases.map((b) => {
          const concept = catalog.conceptById.get(b.conceptId);
          if (!concept) return null;
          const p = progressOf(derived.progress, b.conceptId);
          return (
            <li key={b.conceptId}>
              <button type="button" className="subjects-bases-row" onClick={() => openConcept(b.conceptId)}>
                <SubjectTag subjectId={concept.subjectId} />
                <span className="subjects-bases-name">{concept.name}</span>
                <LevelBars level={p.level} subjectId={concept.subjectId} size="sm" />
                <span className="subjects-bases-dep tone-3">
                  <Icons.dependencies aria-hidden="true" {...ICON_SIZE.row} /> sostiene {b.dependents.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {practiceHref && (
        <Button variant="ghost" icon={<Icons.session />} href={practiceHref}>
          Practicar las que no están iluminadas
        </Button>
      )}
    </div>
  );
}
