// #/guia/:id — perfil de una estrella guía (leyenda o perfil destacado).
import { Star as StarIcon } from "lucide-react";
import type { Legend, Profile } from "../../domain/types";
import { legendProgress, profileProgress } from "../../domain/legends";
import { progressOf } from "../../domain/tutor/mastery";
import { catalog, guideById, isLegend } from "../../state/catalog";
import { useDerived } from "../../state/derived";
import { href, openConcept } from "../../state/router";
import { Badge, Button, EmptyState, Icons, LevelBars, Md, Page, ProgressBar, SubjectTag, num, pct, plural, type IconName } from "../../ui";
import { atlasFeatureInfo, guideInitials, guidePrimarySubject, stampKindLabel } from "./helpers";

// Sellos de las biografías: ilustración, no vocabulario — pero evitan chocar con un
// significado ya asignado (hito ≠ «siguiente», competición ≠ Progreso, título ≠ examen).
const STAMP_ICON: Record<string, IconName> = {
  premio: "badge",
  hito: "milestone",
  titulo: "diploma",
  competicion: "medal",
};

export function GuideScreen({ guideId }: { guideId: string }) {
  const guide = guideById.get(guideId);
  const derived = useDerived();

  if (!guide) {
    return (
      <Page as="main">
        <EmptyState title="Estrella guía desconocida" description={`No hay ninguna estrella guía con el identificador «${guideId}».`} />
      </Page>
    );
  }

  const legend = isLegend(guide);
  const progress = legend ? legendProgress(guide, derived.progress) : profileProgress(guide as Profile, derived.progress);
  const routeIds = legend ? (guide as Legend).route : (guide as Profile).territory;
  const milestones = legend ? (guide as Legend).milestones : (guide as Profile).path;
  const stamps = legend ? [] : (guide as Profile).stamps;
  const subjectId = guidePrimarySubject(guide);
  const feature = atlasFeatureInfo(guide.studyLesson.atlasFeature);
  const years = legend ? (guide as Legend).years : (guide as Profile).born ? `n. ${(guide as Profile).born}` : undefined;
  const metaParts = [legend ? "Leyenda" : "Perfil destacado", years, guide.origin, !legend ? (guide as Profile).field : undefined].filter(
    (x): x is string => !!x,
  );

  return (
    <Page as="main">
      <header className="missions-guide-head">
        <Badge label={guide.name} monogram={guideInitials(guide.name)} subjectId={subjectId} size={88} caption={false} />
        <div>
          <p className="mono-label">{metaParts.join(" · ")}</p>
          <h1>{guide.name}</h1>
          <p className="serif-italic missions-guide-tagline">{guide.tagline}</p>
        </div>
      </header>

      <section className="missions-guide-story">
        <Md size="sm">{guide.story}</Md>
      </section>

      {milestones.length > 0 && (
        <section className="missions-guide-section">
          <h2>Hitos</h2>
          <ol className="missions-milestones">
            {milestones.map((m, i) => (
              <li key={i}>
                <span className="missions-milestone-year num">{m.year}</span>
                {m.age != null && <span className="missions-milestone-age tone-3">{m.age} años</span>}
                <p>{m.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {stamps.length > 0 && (
        <section className="missions-guide-section">
          <h2>Sus insignias</h2>
          <ul className="missions-stamps">
            {stamps.map((s, i) => {
              const Icon = Icons[STAMP_ICON[s.kind]] ?? StarIcon;
              return (
                <li key={i}>
                  <Badge label={s.title} sublabel={stampKindLabel(s.kind)} meta={s.year} icon={<Icon />} size={56} color="var(--gold)" />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="missions-guide-section">
        <h2>Su huella en tu mapa</h2>
        <p className="tone-2">
          {plural(progress.done, "concepto encendido", "conceptos encendidos")} de {num(progress.total)} en su constelación
          {progress.golden ? " · dominada por completo" : progress.completed ? " · toda encendida" : ""}
        </p>
        <ProgressBar
          value={progress.ratio}
          tone={progress.golden ? "gold" : "subject"}
          subjectId={subjectId}
          size="md"
          label={`Su constelación: ${pct(progress.ratio)}`}
        />
        <ul className="missions-route">
          {routeIds.map((id) => {
            const c = catalog.conceptById.get(id);
            if (!c) return null;
            const p = progressOf(derived.progress, id);
            return (
              <li key={id}>
                <button type="button" className="missions-territory-row" onClick={() => openConcept(id)}>
                  <LevelBars level={p.level} subjectId={c.subjectId} size="sm" />
                  <span className="missions-territory-name">{c.name}</span>
                  <SubjectTag subjectId={c.subjectId} size="sm" />
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" href={href(`/mapa?lente=guia&guia=${guide.id}`)}>
          Ver su ruta en el mapa
        </Button>
      </section>

      <section className="missions-guide-section missions-lesson">
        <h2>Lección de estudio</h2>
        <div className="missions-lesson-card">
          <p className="serif-italic missions-lesson-title">{guide.studyLesson.title}</p>
          <p className="tone-2">{guide.studyLesson.text}</p>
          {feature && (
            <Button variant="ghost" href={href(feature.href)}>
              {feature.label}
            </Button>
          )}
        </div>
      </section>

      {guide.sources.length > 0 && (
        <section className="missions-guide-section">
          <h2>Fuentes</h2>
          <ul className="missions-sources">
            {guide.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
