/**
 * Ficha de concepto (cuerpo del panel lateral, ?c=<id>) · Task 5. El host
 * (ConceptPanelHost) ya pone título, SubjectTag + tema, «Ver en el mapa» y
 * cerrar; aquí solo va el cuerpo.
 */
import { useMemo } from "react";
import { dayKey, daysBetween } from "../../domain/time";
import { neededEarly } from "../../domain/tutor/advance";
import { catalog } from "../../state/catalog";
import { hasNotes } from "../../state/notes";
import { useConceptView, useDerived } from "../../state/derived";
import { declareKnown, undoLast } from "../../state/actions";
import { href } from "../../state/router";
import { useUserState } from "../../state/store";
import { Button, EmptyState, Freshness, Icons, LevelBars, Md, Section, TeX, relDays, toast } from "../../ui";
import { StudyMenu } from "./StudyMenu";
import { AppearsIn, BasesSection, DependentsSection, HistoryTimeline, ImpactBlock, ResourcesSection } from "./Sections";
import { Notes } from "./Notes";
import "./concept.css";

const KIND_LABEL: Record<string, string> = {
  concepto: "Concepto",
  definicion: "Definición",
  teorema: "Teorema",
  metodo: "Método",
  algoritmo: "Algoritmo",
  estructura: "Estructura",
  herramienta: "Herramienta",
};

export function ConceptPanel({ conceptId }: { conceptId: string }) {
  const view = useConceptView(conceptId);
  const derived = useDerived();
  const state = useUserState((s) => s);

  const early = useMemo(() => neededEarly(catalog, state), [state]);

  if (!view) return <EmptyState size="sm" title="Concepto no encontrado" description={conceptId} />;

  const { concept, progress } = view;
  const declareIt = () => {
    declareKnown(concept.id);
    toast(`Declarado: ${concept.name}`, {
      description: "Se confirmará con un repaso en los próximos días.",
      tone: "gold",
      action: { label: "Deshacer", onClick: undoLast },
    });
  };
  const earlyForThis = early.find((e) => e.conceptId === conceptId);
  const litPrereqs = view.prerequisites.filter((p) => p.level >= 2).length;
  const hasTheory = !!(concept.intuition || concept.definition || concept.formulas.length > 0 || concept.example || concept.mistakes.length > 0);

  return (
    <div className="concept-body">
      <header className="concept-header">
        <div className="concept-kind-row">
          <span className="concept-kind-chip">{KIND_LABEL[concept.kind] ?? concept.kind}</span>
          <span className="concept-diff-dots" role="img" aria-label={`Dificultad ${concept.difficulty} de 4`}>
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={i <= concept.difficulty ? "is-on" : undefined} />
            ))}
          </span>
        </div>
        <div className="concept-level-row">
          <LevelBars level={progress.level} showLabel="name" cooling={(progress.retrievability ?? 1) < 0.65} />
          {progress.declared && <span className="concept-declared-note">Declarado: pendiente de comprobar</span>}
        </div>
        <div className="concept-fresh-row">
          <Freshness r={progress.retrievability} variant="track" showPct />
          {progress.due && <span>Próximo repaso: {relDays(daysBetween(dayKey(derived.now), dayKey(progress.due)))}</span>}
        </div>
        <div className="concept-actions">
          <StudyMenu conceptId={concept.id} conceptName={concept.name} />
          <Button variant="ghost" onClick={declareIt} disabled={progress.level >= 3}>
            Ya lo domino
          </Button>
          <Button variant="quiet" icon={<Icons.session size={15} />} href={href(`/sesion?ids=${encodeURIComponent(concept.id)}`)}>
            Practicar en sesión
          </Button>
          {hasNotes(concept.unitId) && (
            <Button
              variant="quiet"
              icon={<Icons.notes size={15} />}
              href={href(`/apuntes/${concept.unitId}?concepto=${encodeURIComponent(concept.id)}`)}
            >
              Leer en los apuntes
            </Button>
          )}
        </div>
      </header>

      <Section card tone="glow" eyebrow="Impacto" title="Por qué importa">
        <ImpactBlock
          neededIn={view.neededIn}
          dependents={view.impact.dependents}
          directDependents={view.dependents.length}
          prereqCount={view.prerequisites.length}
          prereqLitCount={litPrereqs}
          early={earlyForThis}
        />
      </Section>

      <Section eyebrow="Resumen" title="En una frase">
        <p className="concept-summary">{concept.summary}</p>
      </Section>

      {hasTheory && (
        <Section eyebrow="Teoría" title="Para profundizar">
          {concept.intuition && (
            <div className="concept-theory-block">
              <p className="concept-block-title">Intuición</p>
              <Md size="sm">{concept.intuition}</Md>
            </div>
          )}
          {concept.definition && (
            <div className="concept-theory-block">
              <p className="concept-block-title">Definición</p>
              <Md size="sm">{concept.definition}</Md>
            </div>
          )}
          {concept.formulas.length > 0 && (
            <div className="concept-theory-block">
              <p className="concept-block-title">Fórmulas</p>
              {concept.formulas.map((f) => (
                <div key={f.label}>
                  <p className="concept-block-title">{f.label}</p>
                  <TeX math={f.latex} />
                </div>
              ))}
            </div>
          )}
          {concept.example && (
            <div className="concept-theory-block">
              <p className="concept-block-title">Ejemplo</p>
              <Md size="sm">{concept.example.statement}</Md>
              <ol className="concept-list">
                {concept.example.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <Md size="sm">{`**Resultado:** ${concept.example.result}`}</Md>
            </div>
          )}
          {concept.mistakes.length > 0 && (
            <div className="concept-theory-block">
              <p className="concept-block-title">Errores frecuentes</p>
              <ul className="concept-list">
                {concept.mistakes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {concept.questions.length > 0 && (
        <Section eyebrow="Preguntas" title="Para comprobarte">
          {concept.questions.map((q) => (
            <details key={q.id} className="concept-question">
              <summary>{q.prompt}</summary>
              <div className="concept-question-answer">
                <Md size="sm">{q.answer}</Md>
                {q.explanation && <Md size="sm">{q.explanation}</Md>}
              </div>
            </details>
          ))}
        </Section>
      )}

      <ResourcesSection resources={concept.resources} sources={concept.sources} />

      <Section eyebrow="Requisitos" title="Bases">
        <BasesSection conceptId={concept.id} direct={view.prerequisites} progress={derived.progress} />
      </Section>

      <Section eyebrow="Dependientes" title="¿Para qué?">
        <DependentsSection dependents={view.dependents} />
      </Section>

      <AppearsIn conceptId={concept.id} progress={derived.progress} />

      <Section eyebrow="Tu material" title="Mis apuntes">
        <Notes conceptId={concept.id} variant="full" />
      </Section>

      <Section eyebrow="Cronología" title="Historial">
        <HistoryTimeline events={view.events} />
      </Section>
    </div>
  );
}
