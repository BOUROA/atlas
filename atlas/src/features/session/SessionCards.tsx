/**
 * Las dos tarjetas del modo sesión: concepto nuevo ("toca estudiarlo") y
 * repaso (comprobación de recuerdo). Reciben todo por props; index.tsx lleva
 * el estado (revelado, confianza, calificación) y el teclado.
 */
import type { ReactNode } from "react";
import type { CatalogConcept, Grade, Question } from "../../domain/types";
import type { ConceptView } from "../../state/derived";
import { catalog } from "../../state/catalog";
import { Button, Icons, InkCard, Kbd, LevelBars, Md, SubjectTag, plural } from "../../ui";
import { Notes } from "../concept/Notes";

function Eyebrow({ concept }: { concept: CatalogConcept }) {
  const unit = catalog.unitById.get(concept.unitId);
  return (
    <div className="session-eyebrow">
      <SubjectTag subjectId={concept.subjectId} variant="name" />
      {unit && (
        <span className="session-unit">
          Tema {unit.number} · {unit.title}
        </span>
      )}
    </div>
  );
}

function BasesList({ view }: { view: ConceptView }) {
  if (view.prerequisites.length === 0) return null;
  return (
    <div>
      <p className="session-block-title">Bases</p>
      <ul className="session-bases-list">
        {view.prerequisites.slice(0, 6).map((p) => {
          const c = catalog.conceptById.get(p.id);
          return (
            <li key={p.id} className="session-base-row">
              <LevelBars level={p.level} size="sm" />
              <b>{c?.name ?? p.id}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FooterRow({ children }: { children: ReactNode }) {
  return <footer className="session-footer">{children}</footer>;
}

export function SessionNewCard({
  view,
  elapsedLabel,
  onSeen,
  onSkip,
  onOpenFicha,
}: {
  view: ConceptView;
  elapsedLabel: string;
  onSeen: () => void;
  onSkip: () => void;
  onOpenFicha: () => void;
}) {
  return (
    <InkCard className="session-card-wrap" aria-label={`Concepto nuevo: ${view.concept.name}`}>
      <Eyebrow concept={view.concept} />
      <p className="session-kind-tag">
        <Icons.newConcept aria-hidden="true" /> Toca estudiarlo
      </p>
      <h1 className="session-name">{view.concept.name}</h1>
      {view.concept.summary && <p className="session-summary-text">{view.concept.summary}</p>}
      <BasesList view={view} />
      <div style={{ marginTop: 16 }}>
        <p className="session-block-title">Mis apuntes</p>
        <Notes conceptId={view.concept.id} variant="links" />
      </div>
      <FooterRow>
        <div className="session-footer-main">
          <Button variant="primary" size="lg" icon={<Icons.seen />} kbd="Intro" onClick={onSeen}>
            Lo he estudiado
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Saltar
          </Button>
          <Button variant="quiet" size="sm" icon={<Icons.view size={15} />} kbd="E" onClick={onOpenFicha}>
            Ver ficha
          </Button>
        </div>
        <span className="session-timer-mini" aria-live="off">
          Estudiando desde hace {elapsedLabel}
        </span>
      </FooterRow>
    </InkCard>
  );
}

const GRADE_LABEL: Record<Grade, string> = { 1: "Otra vez", 2: "Difícil", 3: "Bien", 4: "Fácil" };

export function SessionReviewCard({
  view,
  question,
  revealed,
  confidence,
  onConfidence,
  exercise,
  onExercise,
  onReveal,
  onGrade,
  onNoRecall,
  onOpenFicha,
  gradePreview,
  xpFlash,
}: {
  view: ConceptView;
  question: Question | null;
  revealed: boolean;
  confidence: 1 | 2 | 3 | null;
  onConfidence: (c: 1 | 2 | 3) => void;
  exercise: boolean;
  onExercise: (v: boolean) => void;
  onReveal: () => void;
  onGrade: (g: Grade) => void;
  onNoRecall: () => void;
  onOpenFicha: () => void;
  gradePreview: Record<Grade, string>;
  xpFlash: { n: number; amount: number } | null;
}) {
  return (
    <InkCard className="session-card-wrap" aria-label={`Repaso: ${view.concept.name}`}>
      <Eyebrow concept={view.concept} />
      <p className="session-kind-tag">
        <Icons.review aria-hidden="true" /> Comprobación de recuerdo
      </p>
      <h1 className="session-name">{view.concept.name}</h1>
      <p className="session-prompt">{question ? question.prompt : "Explícalo con tus palabras o resuelve un ejercicio en papel."}</p>

      {!revealed && (
        <div className="session-confidence">
          <span className="session-confidence-label">¿Cómo de seguro estás?</span>
          {(
            [
              ["A", "Dudo", 1],
              ["S", "Creo que sí", 2],
              ["D", "Seguro", 3],
            ] as const
          ).map(([key, label, value]) => (
            <Button key={key} size="sm" variant={confidence === value ? "ink" : "ghost"} kbd={key} onClick={() => onConfidence(value)} aria-pressed={confidence === value}>
              {label}
            </Button>
          ))}
        </div>
      )}

      <label className="session-check">
        <input type="checkbox" checked={exercise} onChange={(e) => onExercise(e.target.checked)} />
        <i aria-hidden="true">
          <Icons.exercises />
        </i>
        He resuelto ejercicios de esto <Kbd>X</Kbd>
      </label>

      {!revealed ? (
        <button type="button" className="session-reveal-btn" onClick={onReveal}>
          <Icons.view size={16} aria-hidden="true" /> Pulsa <Kbd>Espacio</Kbd> para ver la respuesta
        </button>
      ) : (
        <div className="session-reveal-body">
          {question && (
            <div className="session-answer-block">
              <p className="mono-label is-gold">Respuesta</p>
              <Md size="sm">{question.answer}</Md>
              {question.explanation && <Md size="sm">{question.explanation}</Md>}
            </div>
          )}
          {view.concept.summary && (
            <div>
              <p className="session-block-title">Resumen</p>
              <Md size="sm">{view.concept.summary}</Md>
            </div>
          )}
          <BasesList view={view} />
          <div>
            <p className="session-block-title">Mis apuntes</p>
            <Notes conceptId={view.concept.id} variant="links" />
          </div>
        </div>
      )}

      {revealed && (
        <div className="session-grades" role="group" aria-label="Calificación">
          {([1, 2, 3, 4] as const).map((g) => (
            <button key={g} type="button" className={`session-grade session-grade--${g}`} onClick={() => onGrade(g)}>
              <span className="session-grade-label">{GRADE_LABEL[g]}</span>
              <span className="session-grade-when">{gradePreview[g]}</span>
              <Kbd>{String(g)}</Kbd>
            </button>
          ))}
          {xpFlash != null && (
            <span key={xpFlash.n} className="session-xpfloat" aria-hidden="true">
              +{xpFlash.amount} XP
            </span>
          )}
        </div>
      )}

      <div className="session-no-recall">
        <Button variant="ghost" size="sm" onClick={onNoRecall}>
          No lo recuerdo
        </Button>
      </div>

      <FooterRow>
        <div className="session-footer-main">
          <Button variant="quiet" size="sm" icon={<Icons.view size={15} />} kbd="E" onClick={onOpenFicha}>
            Ver ficha
          </Button>
        </div>
        <span className="session-timer-mini">{plural(view.events.length, "evento previo", "eventos previos")}</span>
      </FooterRow>
    </InkCard>
  );
}
