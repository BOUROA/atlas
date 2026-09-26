/** Subsecciones de la ficha: impacto, bases/¿para qué?, aparece en, historial. */
import { useMemo, useState } from "react";
import { Crown, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Resource, StudyEvent } from "../../domain/types";
import { prerequisitesDeep, type NeededIn, type Reached } from "../../domain/graph";
import type { NeededEarly } from "../../domain/tutor/advance";
import { territory, readiness } from "../../domain/expeditions";
import { legendProgress, profileProgress } from "../../domain/legends";
import type { ConceptProgress } from "../../domain/tutor/mastery";
import { catalog, expeditions, guides, isLegend } from "../../state/catalog";
import { openConcept, href } from "../../state/router";
import { Icons, LevelBars, Section, SubjectTag, dateShort, pluralWord, pct, time } from "../../ui";

const shortName = (id: string) => catalog.subjectById.get(id)?.shortName ?? id;
const conceptName = (id: string) => catalog.conceptById.get(id)?.name ?? id;

function ConceptLink({ id }: { id: string }) {
  return (
    <button type="button" className="concept-inline-link" onClick={() => openConcept(id)}>
      {conceptName(id)}
    </button>
  );
}

/* ───────── Impacto ───────── */

export function ImpactBlock({
  neededIn,
  dependents,
  directDependents,
  prereqCount,
  prereqLitCount,
  early,
}: {
  neededIn: NeededIn[];
  /** Dependientes transitivos (todo lo que se apoya en él, a cualquier profundidad). */
  dependents: number;
  /** Dependientes directos (lo que lo requiere a él en concreto). */
  directDependents: number;
  prereqCount: number;
  prereqLitCount: number;
  early?: NeededEarly;
}) {
  const depends = neededIn.filter((n) => n.role === "depends");
  const declared = neededIn.filter((n) => n.role !== "depends");
  return (
    <div className="concept-impact">
      {neededIn.length > 0 && (
        <div className="concept-impact-needed">
          <b>Lo necesitarás en</b>
          <ul className="concept-impact-needed-list">
            {depends.map((n) => (
              <li key={n.subjectId}>
                <SubjectTag subjectId={n.subjectId} variant="name" size="sm" />
                <span className="concept-impact-via">
                  vía{" "}
                  {n.via.slice(0, 3).map((id, j) => (
                    <span key={id}>
                      {j > 0 && ", "}
                      <ConceptLink id={id} />
                    </span>
                  ))}
                  {n.via.length > 3 ? ` y ${n.via.length - 3} más` : ""}
                </span>
              </li>
            ))}
            {declared.map((n) => (
              <li key={n.subjectId}>
                <SubjectTag subjectId={n.subjectId} variant="name" size="sm" />
                <span className="concept-impact-via">{n.role === "studied" ? "también se estudia aquí" : "se usa aquí"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="concept-impact-stats">
        <span>
          {dependents > directDependents ? (
            <>
              Base directa de <b className="num">{directDependents}</b> {pluralWord(directDependents, "concepto", "conceptos")} ·{" "}
              <b className="num">{dependents}</b> en total
            </>
          ) : (
            <>
              <b className="num">{dependents}</b> {dependents === 1 ? "concepto desbloqueado" : "conceptos desbloqueados"}
            </>
          )}
        </span>
        <span>
          Se apoya en <b className="num">{prereqCount}</b> {pluralWord(prereqCount, "base", "bases")} (<b className="num">{prereqLitCount}</b> ya {pluralWord(prereqLitCount, "iluminada", "iluminadas")})
        </span>
      </div>
      {early && (
        <p className="concept-impact-early ember-text">
          Adelántalo: ya lo necesitas en {shortName(early.bySubject)} (vía {conceptName(early.via)})
        </p>
      )}
    </div>
  );
}

/* ───────── Bases y ¿para qué? ───────── */

export function BasesSection({
  conceptId,
  direct,
  progress,
}: {
  conceptId: string;
  direct: { id: string; level: number; reason: string }[];
  progress: ReadonlyMap<string, ConceptProgress>;
}) {
  const [expanded, setExpanded] = useState(false);
  const deep = useMemo<Reached[]>(() => (expanded ? prerequisitesDeep(catalog, conceptId) : []), [expanded, conceptId]);
  const reasonOf = useMemo(() => new Map(direct.map((d) => [d.id, d.reason])), [direct]);

  if (direct.length === 0) return <p className="concept-empty-note">No requiere ninguna otra estrella.</p>;

  const rows = expanded ? deep : direct.map((d) => ({ id: d.id, depth: 1 }));
  const levelOf = (id: string) => progress.get(id)?.level ?? 0;

  return (
    <div>
      <ul className="concept-bases-list">
        {rows.map((r) => (
          <li key={r.id} className="concept-base-row">
            <LevelBars level={levelOf(r.id) as 0 | 1 | 2 | 3} size="sm" />
            <span className="concept-base-name">
              <ConceptLink id={r.id} />
            </span>
            <span className="concept-base-reason">{r.depth === 1 ? reasonOf.get(r.id) ?? "" : `a ${r.depth} pasos`}</span>
          </li>
        ))}
      </ul>
      {direct.length > 0 && (
        <button type="button" className="concept-textbtn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Ver solo las directas" : "Ver todo el camino"} <Icons.open size={13} className={expanded ? "is-rot" : undefined} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function DependentsSection({ dependents }: { dependents: { id: string; subjectId: string }[] }) {
  if (dependents.length === 0) return <p className="concept-empty-note">Aún no desbloquea nada.</p>;
  const bySubject = new Map<string, string[]>();
  for (const d of dependents) {
    const list = bySubject.get(d.subjectId);
    if (list) list.push(d.id);
    else bySubject.set(d.subjectId, [d.id]);
  }
  return (
    <ul className="concept-dependents-list">
      {[...bySubject].map(([subjectId, ids]) => (
        <li key={subjectId} className="concept-dependents-row">
          <SubjectTag subjectId={subjectId} variant="name" size="sm" />
          <span>
            {ids.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <ConceptLink id={id} />
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ───────── Aparece en ───────── */

export function AppearsIn({ conceptId, progress }: { conceptId: string; progress: ReadonlyMap<string, ConceptProgress> }) {
  const missions = useMemo(() => expeditions.filter((e) => territory(e).includes(conceptId)), [conceptId]);
  const guideHits = useMemo(() => guides.filter((g) => (isLegend(g) ? g.route : g.territory).includes(conceptId)), [conceptId]);
  if (missions.length === 0 && guideHits.length === 0) return null;

  return (
    <Section card eyebrow="Puntos del cielo" title="Aparece en">
      {missions.length > 0 && (
        <div className="concept-appears-group">
          <p className="concept-block-title">
            <Icons.mission size={13} aria-hidden="true" /> Misiones
          </p>
          <ul className="concept-appears-list">
            {missions.map((m) => {
              const r = readiness(m, progress);
              return (
                <li key={m.id}>
                  <a className="concept-appears-row" href={href(`/mision/${encodeURIComponent(m.id)}`)}>
                    <span>
                      {m.university} · {m.course} — {m.title}
                    </span>
                    <span className="concept-appears-pct num">{pct(r.ratio)} lista</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {guideHits.length > 0 && (
        <div className="concept-appears-group">
          <p className="concept-block-title">
            <Icons.guide size={13} aria-hidden="true" /> Estrellas guía
          </p>
          <ul className="concept-appears-list">
            {guideHits.map((g) => {
              const legend = isLegend(g);
              const gp = legend ? legendProgress(g, progress) : profileProgress(g, progress);
              return (
                <li key={g.id}>
                  <a className="concept-appears-row" href={href(`/guia/${encodeURIComponent(g.id)}`)}>
                    <span>{g.name}</span>
                    <span className="concept-appears-pct num">{pct(gp.ratio)} encendida</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
}

/* ───────── Recursos (FlipyERP Academy) ───────── */

const RESOURCE_KIND: Record<Resource["kind"], string> = {
  curso: "Curso",
  documentacion: "Documentación",
  repositorio: "Repositorio",
  articulo: "Artículo",
};

/**
 * Recursos externos del concepto (cursos gratuitos, documentación) y ficheros
 * de FlipyERP en los que se basa. Los cursos externos se estudian fuera; aquí
 * se comprueba con las preguntas del concepto.
 */
export function ResourcesSection({ resources = [], sources = [] }: { resources?: Resource[]; sources?: string[] }) {
  if (resources.length === 0 && sources.length === 0) return null;
  return (
    <Section card eyebrow="Fuera de Atlas" title="Recursos">
      {resources.length > 0 && (
        <div className="concept-appears-group">
          <p className="concept-block-title">
            <Icons.open size={13} aria-hidden="true" /> Estudia aquí y vuelve a comprobarte
          </p>
          <ul className="concept-appears-list">
            {resources.map((r) => (
              <li key={r.url + r.title}>
                <a className="concept-appears-row" href={r.url} target="_blank" rel="noopener noreferrer">
                  <span>
                    {r.title} <span className="concept-base-reason">· {r.provider}</span>
                  </span>
                  <span className="concept-appears-pct">
                    {RESOURCE_KIND[r.kind]}
                    {r.minutes ? ` · ${r.minutes} min` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sources.length > 0 && (
        <div className="concept-appears-group">
          <p className="concept-block-title">
            <Icons.notes size={13} aria-hidden="true" /> En el código de FlipyERP
          </p>
          <ul className="concept-list">
            {sources.map((s) => (
              <li key={s}>
                <code>{s}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

/* ───────── Historial ───────── */

const SOURCE_LABEL: Record<string, string> = {
  session: "en una sesión",
  class: "en clase",
  concept: "desde la ficha",
  quick: "registro rápido",
  challenge: "en una misión",
};

function EventRow({ e }: { e: StudyEvent }) {
  let Icon = Icons.seen;
  let text = "Visto";
  if (e.kind === "seen") {
    Icon = Icons.seen;
    text = "Visto";
  } else if (e.kind === "declared") {
    Icon = Crown;
    text = "Declarado dominado";
  } else if (e.kind === "implicit") {
    Icon = Icons.review;
    text = "Repaso implícito";
  } else if (e.kind === "review") {
    if (e.attempted === false) {
      Icon = ThumbsDown;
      text = "Mostró la respuesta sin intentarlo";
    } else {
      const names: Record<number, string> = { 1: "Otra vez", 2: "Difícil", 3: "Bien", 4: "Fácil" };
      Icon = (e.grade ?? 0) >= 3 ? ThumbsUp : ThumbsDown;
      text = `Repaso: ${names[e.grade ?? 1] ?? "?"}`;
      if (e.questionKind === "exercise") text += " (ejercicio)";
    }
  }
  return (
    <li className="concept-history-row">
      <Icon size={14} aria-hidden="true" />
      <span className="concept-history-text">
        {text}
        {e.source && SOURCE_LABEL[e.source] ? ` · ${SOURCE_LABEL[e.source]}` : ""}
      </span>
      <span className="concept-history-date mono-label">
        {dateShort(e.at)} · {time(e.at)}
      </span>
    </li>
  );
}

export function HistoryTimeline({ events }: { events: StudyEvent[] }) {
  if (events.length === 0) return <p className="concept-empty-note">Aún no hay historial.</p>;
  const reversed = [...events].reverse();
  return (
    <ul className="concept-history-list">
      {reversed.map((e) => (
        <EventRow key={e.id} e={e} />
      ))}
    </ul>
  );
}
