// #/mision/:id — territorio, problemas, cronómetro y corrección de una misión.
import { useEffect, useMemo, useReducer, useState } from "react";
import { Pause } from "lucide-react";
import type { ExpeditionAttempt, StudyEvent } from "../../domain/types";
import { PASSING_GRADE, readiness, scoreOf, territory } from "../../domain/expeditions";
import { progressOf } from "../../domain/tutor/mastery";
import { catalog, expeditionById } from "../../state/catalog";
import { useUserState } from "../../state/store";
import { useDerived } from "../../state/derived";
import { href, openConcept } from "../../state/router";
import { gradeExpedition, startExpedition } from "../../state/actions";
import { Badge, Button, EmptyState, Icons, LevelBars, Page, Ring, Section, Segmented, dateLong, minutes, pct, plural } from "../../ui";
import { bestAttempt, gradeNum, missionKindLabel, openAttempt, universityInitials } from "./helpers";

const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

function practiceHrefForMissing(missingIds: readonly string[]): string | null {
  if (missingIds.length === 0) return null;
  return `/sesion?ids=${missingIds.map((id) => encodeURIComponent(id)).join(",")}`;
}

/** Cronómetro del intento en marcha: milisegundos transcurridos desde `startedAt`, menos las pausas locales. */
function useElapsed(startedAt: string | undefined, running: boolean): number {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);
  return startedAt ? Date.now() - Date.parse(startedAt) : 0;
}

export function MissionDetailScreen({ missionId }: { missionId: string }) {
  const exp = expeditionById.get(missionId);
  const state = useUserState((s) => s);
  const derived = useDerived();

  const [correcting, setCorrecting] = useState(false);
  const [scores, setScores] = useState<Record<string, 0 | 0.5 | 1>>({});
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [xpBefore, setXpBefore] = useState<number | null>(null);
  const [justGraded, setJustGraded] = useState<{ attempt: ExpeditionAttempt; events: StudyEvent[] } | null>(null);

  const open = exp ? openAttempt(exp, state) : null;
  const elapsedRaw = useElapsed(open?.startedAt, !!open && pausedAt == null);
  const elapsed = Math.max(0, elapsedRaw - pausedMs - (pausedAt != null ? Date.now() - pausedAt : 0));

  useEffect(() => {
    // un intento nuevo (o ninguno) reinicia la corrección, las pausas locales y el resumen anterior
    setCorrecting(false);
    setPausedAt(null);
    setPausedMs(0);
    setScores(open?.scores ?? {});
    if (open) {
      setJustGraded(null);
      setXpBefore(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.id]);

  if (!exp) {
    return (
      <Page as="main">
        <EmptyState title="Misión desconocida" description={`No hay ninguna misión con el identificador «${missionId}».`} />
      </Page>
    );
  }

  const territoryIds = territory(exp);
  const ready = readiness(exp, derived.progress);
  const missingSet = new Set(ready.missing);
  const practiceHref = practiceHrefForMissing(ready.missing);
  const best = bestAttempt(exp, state);
  const history = (state.expeditions?.[exp.id] ?? []).filter((a) => a.endedAt).sort((a, b) => Date.parse(b.endedAt!) - Date.parse(a.endedAt!));

  const sameDoc = exp.sameDocument === true;

  const handleStart = () => {
    startExpedition(exp.id);
    setJustGraded(null);
  };

  const handleOpenSolutions = () => {
    window.open(exp.solutionsUrl, "_blank", "noopener,noreferrer");
    setCorrecting(true);
  };

  const handleSave = () => {
    if (!open) return;
    setXpBefore(derived.xp.total);
    const fullScores: Record<string, 0 | 0.5 | 1> = {};
    for (const p of exp.problems) fullScores[p.n] = scores[p.n] ?? 0;
    const events = gradeExpedition(exp.id, open.id, fullScores);
    const gradedAttempt: ExpeditionAttempt = { ...open, endedAt: new Date().toISOString(), scores: fullScores };
    setJustGraded({ attempt: gradedAttempt, events });
    setCorrecting(false);
  };

  // XP ganada por la corrección: la diferencia entre el total tras guardar y el capturado justo antes.
  const xpGained = justGraded && xpBefore != null ? derived.xp.total - xpBefore : null;

  const summaryScore = justGraded ? scoreOf(exp, justGraded.attempt) : null;
  const summaryPassed = summaryScore != null && summaryScore >= PASSING_GRADE;

  return (
    <Page as="main">
      <header className="missions-detail-head">
        <div className="missions-detail-seal">
          <Badge label={exp.university} monogram={universityInitials(exp.university)} size={56} caption={false} color={best && best.score >= PASSING_GRADE ? "var(--gold)" : "var(--text-3)"} />
        </div>
        <div className="missions-detail-titles">
          <p className="mono-label">
            {exp.university} · {exp.course} · {exp.term} · {missionKindLabel(exp.kind)}
          </p>
          <h1>{exp.title}</h1>
          <p className="tone-2 missions-detail-meta">
            {minutes(exp.durationMin)}
            {exp.durationEstimated ? " (duración estimada)" : ""} · nivel {exp.level}
            {best && (
              <>
                {" · mejor nota "}
                <b className={best.score >= PASSING_GRADE ? "gold-text" : undefined}>{gradeNum(best.score)}</b>
              </>
            )}
          </p>
        </div>
        <div className="missions-detail-ready">
          <Ring value={ready.ratio} size={56} thickness={4} aria-label={`Preparación: ${pct(ready.ratio)}${ready.ready ? ", estás listo" : ""}`} />
          <span className={ready.ready ? "gold-text" : "tone-3"}>{ready.ready ? "Estás listo" : "Aún no"}</span>
        </div>
      </header>

      {exp.whyThisOne && (
        <p className="missions-why serif-italic">
          &ldquo;{exp.whyThisOne}&rdquo;
        </p>
      )}

      <Section card title="Territorio" eyebrow={`${plural(territoryIds.length, "concepto", "conceptos")} · ${pct(ready.ratio)} preparado`}>
        <ul className="missions-territory">
          {territoryIds.map((id) => {
            const c = catalog.conceptById.get(id);
            if (!c) return null;
            const p = progressOf(derived.progress, id);
            const missing = missingSet.has(id);
            return (
              <li key={id} className={missing ? "is-missing" : undefined}>
                <button type="button" className="missions-territory-row" onClick={() => openConcept(id)}>
                  <LevelBars level={p.level} subjectId={c.subjectId} size="sm" />
                  <span className="missions-territory-name">{c.name}</span>
                  {missing && <em className="missions-tag">aún no</em>}
                </button>
              </li>
            );
          })}
        </ul>
        {practiceHref && (
          <Button variant="ghost" size="sm" icon={<Icons.session />} href={href(practiceHref)}>
            Practicar lo que falta
          </Button>
        )}
      </Section>

      <Section card title="Problemas" eyebrow={plural(exp.problems.length, "problema", "problemas")}>
        <ol className="missions-problems">
          {exp.problems.map((p) => (
            <li key={p.n} className="missions-problem">
              <div className="missions-problem-head">
                <span className="missions-problem-n mono-label">{p.n}</span>
                <p>{p.topic}</p>
                {p.points != null && <span className="tone-3 mono-label">{plural(p.points, "punto", "puntos")}</span>}
              </div>
              <ul className="missions-problem-concepts">
                {p.concepts.map((cid) => {
                  const c = catalog.conceptById.get(cid);
                  if (!c) return null;
                  return (
                    <li key={cid}>
                      <button type="button" className="missions-chip" onClick={() => openConcept(cid)}>
                        {c.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {correcting && (
                <Segmented
                  aria-label={`Corrección del problema ${p.n}`}
                  size="sm"
                  variant="chips"
                  value={String(scores[p.n] ?? 0)}
                  onChange={(v) => setScores((s) => ({ ...s, [p.n]: Number(v) as 0 | 0.5 | 1 }))}
                  options={[
                    { value: "0", label: "0" },
                    { value: "0.5", label: "½" },
                    { value: "1", label: "1" },
                  ]}
                />
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section card title="Licencia y créditos">
        <p className="tone-2">{exp.license}</p>
        <p className="tone-3">
          Fuente: {exp.university} · {exp.course} — {exp.courseName} ({exp.term}).
        </p>
        <div className="missions-links">
          <Button variant="ghost" icon={<Icons.external />} href={exp.url} target="_blank" rel="noopener noreferrer">
            Abrir enunciado oficial
          </Button>
          {sameDoc && <p className="missions-samedoc tone-3">El enunciado y las soluciones están en el mismo documento: no mires la solución antes de acabar.</p>}
        </div>
      </Section>

      <Section card title={open ? "En marcha" : history.length > 0 ? "Otro intento" : "Empezar"} eyebrow="Misión">
        {justGraded && summaryScore != null && (
          <div className="missions-summary">
            <Badge
              icon={<Icons.badge />}
              size={72}
              celebrate={summaryPassed}
              locked={!summaryPassed}
              label={summaryPassed ? "Misión superada" : "Sin superar"}
              sublabel={`${exp.university} · ${exp.course}`}
              meta={dateLong(justGraded.attempt.endedAt!)}
            />
            <div className="missions-summary-body">
              <p className="missions-summary-grade">
                Nota: <b className="num">{gradeNum(summaryScore)}</b>
              </p>
              {xpGained != null && xpGained > 0 && (
                <p className="tone-2">
                  +<span className="num">{xpGained}</span> XP
                </p>
              )}
              {justGraded.events.length > 0 ? (
                <div className="missions-reinforced">
                  <span className="mono-label">Conceptos reforzados</span>
                  <ul>
                    {justGraded.events.map((e) => {
                      const c = catalog.conceptById.get(e.conceptId);
                      return (
                        <li key={e.conceptId}>
                          <button type="button" className="missions-chip" onClick={() => openConcept(e.conceptId)}>
                            {c?.name ?? e.conceptId}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="tone-3">Ningún problema con nota ½ o 1: nada que reforzar esta vez.</p>
              )}
            </div>
          </div>
        )}

        {open ? (
          <div className="missions-timer">
            <div className="missions-timer-clock num">{formatClock(elapsed)}</div>
            <p className="tone-3">de {minutes(exp.durationMin)} previstos</p>
            <div className="missions-timer-actions">
              <Button
                variant="ghost"
                icon={pausedAt != null ? <Icons.session /> : <Pause />}
                onClick={() => {
                  if (pausedAt != null) {
                    setPausedMs((m) => m + (Date.now() - pausedAt));
                    setPausedAt(null);
                  } else setPausedAt(Date.now());
                }}
              >
                {pausedAt != null ? "Reanudar" : "Pausar"}
              </Button>
              {!correcting ? (
                <Button variant="primary" icon={<Icons.submit />} onClick={handleOpenSolutions}>
                  Corregir
                </Button>
              ) : (
                <Button variant="primary" icon={<Icons.submit />} onClick={handleSave}>
                  Guardar corrección
                </Button>
              )}
            </div>
            {correcting && <p className="tone-3">Corrige cada problema con 0 · ½ · 1 más abajo y guarda cuando termines.</p>}
          </div>
        ) : (
          <Button variant="primary" size="lg" icon={history.length > 0 ? <Icons.retry /> : <Icons.session />} onClick={handleStart}>
            {history.length > 0 ? "Repetir misión" : "Empezar"}
          </Button>
        )}
      </Section>

      {history.length > 0 && (
        <Section card title="Intentos anteriores" eyebrow={plural(history.length, "intento", "intentos")}>
          <ul className="missions-history">
            {history.map((a) => {
              const score = scoreOf(exp, a);
              const passed = score >= PASSING_GRADE;
              return (
                <li key={a.id} className={passed ? "is-passed" : undefined}>
                  <span>{dateLong(a.endedAt!)}</span>
                  <b className="num">{gradeNum(score)}</b>
                  <span className="tone-3">{passed ? "superada" : "no superada"}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </Page>
  );
}
