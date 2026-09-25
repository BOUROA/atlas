// Pestaña "Camino": el sendero de estrellas de una asignatura hasta el
// máximo (spec 2026-09-25-mision-del-dia-camino §4). Selector de las diez
// asignaturas, el sendero y, al lado, la ficha, "Estás aquí" y "Hasta el máximo".
import { useMemo } from "react";
import { Hourglass, Lock, MapPin, Mountain, Play, Rocket } from "lucide-react";
import type { PathNode } from "../../../domain/camino";
import { catalog, currentSubjects, expeditionById, trialById } from "../../../state/catalog";
import { useDerived, useSubjectLevels, useSubjectPath } from "../../../state/derived";
import { useRoute } from "../../../state/router";
import { Button, EmptyState, ICON_SIZE, Icons, IconButton, Ring, Tooltip, cx, minutesShort, plural, pct as pctFmt } from "../../../ui";
import { caminoStats, climbMinutesLabel, climbToMax, defaultCaminoSubject, nodeCta, nodeHref, nodeShortLabel } from "./helpers";
import { SkyTrail } from "./SkyTrail";
import { SubjectRail } from "./SubjectRail";

const TOP_LEVEL = 7;

/** Siete segmentos: encendidos hasta `level`, el siguiente marcado aparte. */
function Lv7({ level, next }: { level: number; next: number | null }) {
  return (
    <span className="camino-lv7" role="img" aria-label={`Nivel ${level} de ${TOP_LEVEL}`}>
      {Array.from({ length: TOP_LEVEL }, (_, i) => i + 1).map((n) => (
        <i key={n} className={n <= level ? "is-on" : n === next ? "is-next" : undefined} />
      ))}
    </span>
  );
}

/** Icono y meta del nodo "estás aquí", según su tipo. */
function HereMeta({ node }: { node: PathNode }) {
  const row = ICON_SIZE.row;
  if (node.kind === "elite") {
    const exp = node.expeditionId ? expeditionById.get(node.expeditionId) : undefined;
    return (
      <>
        {exp && (
          <span className="camino-here-tag">
            <Rocket aria-hidden="true" {...row} /> {exp.university}
          </span>
        )}
        {exp && (
          <span className="camino-here-tag">
            <Icons.duration aria-hidden="true" {...row} /> {minutesShort(exp.durationMin)}
          </span>
        )}
      </>
    );
  }
  if (node.trialId) {
    const trial = trialById.get(node.trialId);
    const ready = node.readiness >= 0.7;
    return (
      <>
        {trial && (
          <span className="camino-here-tag">
            <Icons.duration aria-hidden="true" {...row} /> {minutesShort(trial.durationMin)} · {plural(trial.problems.length, "problema", "problemas")}
          </span>
        )}
        <span className={cx("rumbo-tag", ready ? "rumbo-tag--ready" : "rumbo-tag--muted")}>
          {ready ? <>Listo · {pctFmt(node.readiness)}</> : <>Preparación {pctFmt(node.readiness)}</>}
        </span>
      </>
    );
  }
  const total = catalog.conceptsByUnit.get(node.id)?.length ?? 0;
  const readyCount = Math.round(node.readiness * total);
  return (
    <span className="camino-here-tag">
      <Icons.readiness aria-hidden="true" {...row} /> {readyCount} de {total} listos
    </span>
  );
}

function HereIcon({ node }: { node: PathNode }) {
  if (node.summit) return <Mountain aria-hidden="true" {...ICON_SIZE.header} />;
  if (node.kind === "elite") return <Rocket aria-hidden="true" {...ICON_SIZE.header} />;
  if (node.kind === "sim-parcial" || node.kind === "sim-final") return <Hourglass aria-hidden="true" {...ICON_SIZE.header} />;
  return <Icons.unit aria-hidden="true" {...ICON_SIZE.header} />;
}

export function CaminoTab() {
  const { query } = useRoute();
  const levels = useSubjectLevels();
  const derived = useDerived();

  const subjectId = useMemo(() => {
    const asked = query.get("asig");
    if (asked && currentSubjects.some((s) => s.id === asked)) return asked;
    return defaultCaminoSubject(currentSubjects, levels) ?? currentSubjects[0]?.id;
  }, [query, levels]);

  // Hooks siempre en el mismo orden: con el catálogo vacío, `useSubjectPath` recibe
  // un id vacío (camino sin nodos) y el estado vacío se pinta abajo, tras llamarlos.
  const path = useSubjectPath(subjectId ?? "");

  if (!subjectId) {
    return <EmptyState title="Sin asignaturas" description="Todavía no hay asignaturas en el catálogo para trazar un camino." />;
  }

  const subject = catalog.subjectById.get(subjectId);
  const stats = caminoStats(path);
  const climb = climbToMax(path);
  const minutesLeft = climbMinutesLabel(path);
  const here = path.current >= 0 ? path.nodes[path.current] : undefined;
  const finished = path.current < 0;
  const capped = path.level.nextLevel === null && !finished;

  return (
    <div className="camino-tab">
      <SubjectRail subjectId={subjectId} />

      <div className="camino-layout">
        <section className="camino-skycard" aria-label={`Camino de ${subject?.name ?? subjectId}`}>
          <div className="camino-skycard-corner">
            <span className="camino-legend">
              <Icons.gradeStar aria-hidden="true" {...ICON_SIZE.label} /> 1 desde 7 · 2 desde 8,5 · 3 desde 9,5
            </span>
            <Tooltip content="Se sube de abajo arriba. Estrella: tema o control. Planeta: simulacro. Tras el máximo, la escalera de élite hasta la Cumbre.">
              <IconButton aria-label="Cómo se lee el camino" icon={<Icons.help aria-hidden="true" />} variant="quiet" size="sm" tooltip={false} />
            </Tooltip>
          </div>
          <SkyTrail subjectId={subjectId} path={path} progress={derived.progress} />
        </section>

        <aside className="camino-side">
          <section className="camino-card camino-subj">
            <span className="camino-lvring">
              <Ring value={path.level.level / TOP_LEVEL} size={76} thickness={4} tone="gold" label={<span className="num camino-lvring-n">{path.level.level}</span>} aria-label={`Nivel ${path.level.level} de ${TOP_LEVEL}`} />
            </span>
            <div className="camino-subj-body">
              <h2>{subject?.shortName ?? subjectId}</h2>
              <p className="mono-label is-gold">
                Nivel {path.level.level} · {path.level.label}
              </p>
              <div className="camino-subj-lv7">
                <Lv7 level={path.level.level} next={path.level.nextLevel} />
                <span className="num tone-3">
                  {path.level.level} / {TOP_LEVEL}
                </span>
              </div>
            </div>
            <div className="camino-kv">
              {stats.hasTrials && (
                <span className="camino-kv-item" title="Estrellas de nota">
                  <Icons.gradeStar aria-hidden="true" {...ICON_SIZE.row} />
                  <b className="num">{stats.starsEarned}</b> / {stats.starsMax}
                </span>
              )}
              <span className="camino-kv-item" title="Pasos hechos">
                <Icons.done aria-hidden="true" {...ICON_SIZE.row} />
                <b className="num">{stats.stepsDone}</b> / {stats.stepsTotal} pasos
              </span>
              {stats.controlsTotal > 0 && (
                <span className="camino-kv-item" title="Controles superados">
                  <Icons.control aria-hidden="true" {...ICON_SIZE.row} />
                  <b className="num">{stats.controlsDone}</b> / {stats.controlsTotal}
                </span>
              )}
            </div>
          </section>

          <section className={cx("camino-card camino-here", finished && "is-finished")}>
            {finished ? (
              <>
                <span className="camino-here-eyebrow">
                  <Mountain aria-hidden="true" {...ICON_SIZE.row} /> <b>Cumbre alcanzada</b>
                </span>
                <h3>Camino completo</h3>
                <p className="tone-2">{subject?.shortName ?? subjectId} ha llegado al máximo del Camino.</p>
              </>
            ) : here ? (
              <>
                <span className="camino-here-eyebrow">
                  <MapPin aria-hidden="true" {...ICON_SIZE.row} /> <b>Estás aquí</b>
                </span>
                <h3>
                  <HereIcon node={here} />
                  {nodeShortLabel(here)}
                </h3>
                <div className="camino-here-meta">
                  <HereMeta node={here} />
                </div>
                {path.level.nextLevel != null ? (
                  <div className="camino-here-next">
                    <Icons.next aria-hidden="true" {...ICON_SIZE.row} />
                    <span className="tone-3">Siguiente</span>
                    <b>
                      Nivel {path.level.nextLevel} · {path.level.next}
                    </b>
                    <Lv7 level={path.level.level} next={path.level.nextLevel} />
                  </div>
                ) : (
                  capped && (
                    <div className="camino-here-next is-muted">
                      <Lock aria-hidden="true" {...ICON_SIZE.row} />
                      <span className="tone-3">Pruebas en camino</span>
                    </div>
                  )
                )}
                <div className="camino-here-cta">
                  <Button variant="primary" size="lg" icon={<Play aria-hidden="true" />} href={nodeHref(here, derived.progress)}>
                    {nodeCta(here)}
                  </Button>
                </div>
              </>
            ) : null}
          </section>

          <section className="camino-card camino-climb">
            <div className="camino-climb-head">
              <h2>Hasta el máximo</h2>
              {minutesLeft && (
                <span className="tone-3 num camino-climb-time">
                  <Icons.duration aria-hidden="true" {...ICON_SIZE.row} /> {minutesLeft}
                </span>
              )}
            </div>
            {climb.length > 0 ? (
              <ul className="camino-climb-list">
                {climb.map((row) => (
                  <li key={row.key} className={cx(row.isMax && "is-max")}>
                    {row.kind === "elite" ? <Rocket aria-hidden="true" {...ICON_SIZE.row} /> : <Hourglass aria-hidden="true" {...ICON_SIZE.row} />}
                    <span className="camino-climb-name">
                      {row.label}
                      {row.tag && <small>{row.tag}</small>}
                    </span>
                    <span className="num tone-3 camino-climb-meta">{row.meta}</span>
                  </li>
                ))}
              </ul>
            ) : finished ? (
              <p className="tone-3">Ya está todo hecho: el camino de {subject?.shortName ?? subjectId} está completo.</p>
            ) : capped ? (
              <p className="tone-3">
                <Lock aria-hidden="true" {...ICON_SIZE.row} /> Pruebas en camino: por ahora, {subject?.shortName ?? subjectId} solo tiene pasos de temario.
              </p>
            ) : (
              <p className="tone-3">Sigue por el temario para llegar a la siguiente prueba.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
