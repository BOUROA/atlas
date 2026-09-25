// Pestaña "Estrellas guía": galería de medallones (leyendas y perfiles destacados).
import type { Legend, Profile } from "../../domain/types";
import { legendProgress, profileProgress } from "../../domain/legends";
import { isLegend, legends, profiles } from "../../state/catalog";
import { useDerived } from "../../state/derived";
import { href } from "../../state/router";
import { Badge, EmptyState, ProgressBar, pct, plural } from "../../ui";
import { guideInitials, guidePrimarySubject } from "./helpers";

function GuideTile({ guide }: { guide: Legend | Profile }) {
  const derived = useDerived();
  const legend = isLegend(guide);
  const progress = legend ? legendProgress(guide, derived.progress) : profileProgress(guide as Profile, derived.progress);
  const subjectId = guidePrimarySubject(guide);
  return (
    <li className="missions-guide-tile">
      <a className="missions-card-link" href={href(`/guia/${guide.id}`)} aria-label={`${guide.name}, abrir estrella guía`} />
      <Badge
        label={guide.name}
        monogram={guideInitials(guide.name)}
        subjectId={progress.completed ? undefined : subjectId}
        color={progress.golden ? "var(--gold)" : progress.completed ? "var(--star)" : undefined}
        progress={progress.ratio}
        size={68}
        caption={false}
      />
      <div className="missions-guide-body">
        <h3>{guide.name}</h3>
        <p className="tone-3">{guide.tagline}</p>
        <ProgressBar
          value={progress.ratio}
          tone={progress.golden ? "gold" : "subject"}
          subjectId={subjectId}
          size="xs"
          label={`Su constelación: ${pct(progress.ratio)}${progress.golden ? ", dominada" : progress.completed ? ", encendida" : ""}`}
        />
      </div>
    </li>
  );
}

export function GuidesGallery() {
  if (legends.length === 0 && profiles.length === 0) {
    return <EmptyState title="Sin estrellas guía todavía" description="El catálogo de leyendas y perfiles está vacío." />;
  }
  return (
    <div className="missions-guides">
      {legends.length > 0 && (
        <section className="missions-guide-group">
          <p className="mono-label missions-group-label">Leyendas · {plural(legends.length, "referente histórico", "referentes históricos")}</p>
          <ul className="missions-guide-grid">
            {legends.map((l) => (
              <GuideTile key={l.id} guide={l} />
            ))}
          </ul>
        </section>
      )}
      {profiles.length > 0 && (
        <section className="missions-guide-group">
          <p className="mono-label missions-group-label">Perfiles destacados · {plural(profiles.length, "trayectoria contemporánea", "trayectorias contemporáneas")}</p>
          <ul className="missions-guide-grid">
            {profiles.map((p) => (
              <GuideTile key={p.id} guide={p} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
