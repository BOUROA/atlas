// Task 12 · Progreso: bitácora de misiones (insignias de las superadas + intentos)
// y galería de estrellas guía (medallones con el progreso de su constelación).
import { useMemo } from "react";
import { PASSING_GRADE, scoreOf } from "../../domain/expeditions";
import { legendProgress, profileProgress } from "../../domain/legends";
import type { ConceptProgress } from "../../domain/tutor/mastery";
import type { UserState } from "../../domain/types";
import { expeditions, guides, isLegend } from "../../state/catalog";
import { href } from "../../state/router";
import { Badge, EmptyState, Ring, Section, cx, pct, plural } from "../../ui";
import { initials } from "../today/helpers";

export function MissionsLogSection({ state }: { state: UserState }) {
  const rows = useMemo(() => {
    const out: { id: string; label: string; sublabel: string; attempts: number; best: number; passed: boolean; lastAt: string }[] = [];
    for (const exp of expeditions) {
      const attempts = (state.expeditions?.[exp.id] ?? []).filter((a) => a.endedAt);
      if (attempts.length === 0) continue;
      const best = Math.max(...attempts.map((a) => scoreOf(exp, a)));
      const lastAt = attempts.map((a) => a.endedAt!).sort().at(-1)!;
      out.push({ id: exp.id, label: exp.course, sublabel: `${exp.university} · ${exp.term}`, attempts: attempts.length, best, passed: best >= PASSING_GRADE, lastAt });
    }
    return out.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  }, [state.expeditions]);

  const passedCount = rows.filter((r) => r.passed).length;

  return (
    <Section
      card
      aria-label="Bitácora de misiones"
      eyebrow={`${passedCount} de ${rows.length} superadas`}
      title="Bitácora de misiones"
      action={
        <a className="progress-link" href={href("/misiones")}>
          Ir a misiones
        </a>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          size="sm"
          tone="dashed"
          title="Aún no has hecho ninguna misión"
          description="Las misiones son exámenes reales de otras universidades. Ve a Misiones para intentar la primera."
          action={
            <a className="progress-link" href={href("/misiones")}>
              Ver misiones
            </a>
          }
        />
      ) : (
        <div className="progress-missions">
          {rows.map((r) => (
            <a key={r.id} className="progress-mission" href={href(`/mision/${r.id}`)}>
              <Badge
                size={64}
                monogram={initials(r.label, 3)}
                locked={!r.passed}
                label={r.label}
                sublabel={r.sublabel}
                meta={r.passed ? `nota ${r.best.toFixed(1)}` : `${plural(r.attempts, "intento", "intentos")}`}
              />
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}

export function GuidesGallerySection({ progress }: { progress: ReadonlyMap<string, ConceptProgress> }) {
  const rows = useMemo(
    () =>
      guides
        .map((g) => ({ guide: g, p: isLegend(g) ? legendProgress(g, progress) : profileProgress(g, progress) }))
        .filter((r) => r.p.total > 0)
        .sort((a, b) => b.p.ratio - a.p.ratio),
    [progress],
  );
  const completed = rows.filter((r) => r.p.completed).length;
  // La mayoría empiezan a 0: solo se listan las empezadas, con un enlace al resto (auditoría › Progreso #3).
  const started = rows.filter((r) => r.p.done > 0);

  return (
    <Section
      card
      aria-label="Galería de estrellas guía"
      eyebrow={`${completed} de ${rows.length} encendidas`}
      title="Estrellas guía"
      action={
        <a className="progress-link" href={href("/misiones")}>
          Ver todas ({rows.length})
        </a>
      }
    >
      {started.length === 0 ? (
        <EmptyState size="sm" tone="dashed" title="Sin constelaciones aún" description="Cada estrella guía tiene su propia ruta de conceptos: enciéndela poco a poco al estudiar." />
      ) : (
        <div className="progress-guides">
          {started.map(({ guide, p }) => (
            <a key={guide.id} className="progress-guide" href={href(`/guia/${guide.id}`)}>
              <span className={cx("progress-guide-medal", p.golden && "is-golden")}>
                <Ring value={p.ratio} size={56} thickness={4} tone={p.completed ? "star" : "gold"} label={<span className="progress-guide-mono">{initials(guide.name)}</span>} />
              </span>
              <b>{guide.name}</b>
              <small>
                {p.done} / {p.total} · {pct(p.ratio)}
              </small>
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}
