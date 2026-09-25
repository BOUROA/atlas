// Misión de hoy, en cadena (spec 2026-09-25-mision-del-dia-camino §5, maqueta
// docs/maquetas/mision-cadena.html): un nodo por misión del plan congelado del
// día, la actual desplegada, y un nodo de recompensa («Día redondo») al final.
// Sustituye a la antigua «Sesión de hoy» como bloque protagonista de Hoy.
import { useMemo, type ReactNode } from "react";
import { CalendarCheck, CalendarClock, Route, Target, type LucideIcon } from "lucide-react";
import { trialReadiness } from "../../domain/trials";
import type { DayMission, DayMissionKind, UserState } from "../../domain/types";
import type { MissionStatus } from "../../domain/plan";
import { catalog, currentSubjects, trialById } from "../../state/catalog";
import { navigate, href } from "../../state/router";
import type { Derived } from "../../state/derive-core";
import type { DayPlanView } from "../../state/derived";
import {
  Button, EmptyState, ICON_SIZE, Icons, InkCard, ProgressBar, SubjectTag, Tooltip,
  cx, minutes as fmtMinutes, minutesShort, num, pct, pluralWord,
} from "../../ui";
import { leastFreshSubject } from "./helpers";

const SIZE_BTN = { size: ICON_SIZE.button.size, strokeWidth: ICON_SIZE.button.strokeWidth };
const SIZE_ROW = { size: ICON_SIZE.row.size, strokeWidth: ICON_SIZE.row.strokeWidth };
const SIZE_LABEL = { size: ICON_SIZE.label.size, strokeWidth: ICON_SIZE.label.strokeWidth };
/** Icono dentro de un nodo de 60 px (misma proporción que la maqueta). */
const SIZE_NODE = { size: 22, strokeWidth: 1.5 };

const KIND_LABEL: Record<DayMissionKind, string> = {
  review: "Calentamiento", reinforce: "Refuerzo", advance: "Avance", trial: "Demuestra",
};
/** Iconos del vocabulario (`docs/diseno-visual.md`) salvo Refuerzo (`target`), propuesto para esta pantalla. */
const KIND_ICON: Record<DayMissionKind, LucideIcon> = {
  review: Icons.review, reinforce: Target, advance: Icons.newConcept, trial: Icons.control,
};
/** Código corto para el nodo móvil cuando la misión no tiene asignatura (Calentamiento, Refuerzo). */
const KIND_ABBR: Record<DayMissionKind, string> = { review: "REP", reinforce: "REF", advance: "AVA", trial: "DEM" };

type MissionExtra = { unitNumber?: number; readiness?: number };

/** CTA de una misión (spec §5): repasos, conceptos o la prueba. */
function missionHref(m: DayMission): string {
  if (m.kind === "review") return "/sesion?modo=repasos";
  if (m.kind === "trial") return `/prueba/${encodeURIComponent(m.trialId ?? "")}`;
  return `/sesion?ids=${m.conceptIds.map(encodeURIComponent).join(",")}`;
}

const subjectsOf = (m: DayMission): Set<string> => {
  const out = new Set<string>();
  for (const id of m.conceptIds) {
    const sid = catalog.conceptById.get(id)?.subjectId;
    if (sid) out.add(sid);
  }
  return out;
};

/**
 * Anillo de progreso dorado con un icono dentro (no `Ring` de `ui/`: su regla
 * `.ui-ring svg{width:100%;height:100%}` también encoge a 0×0 el icono lucide
 * que le pasemos como `label`, pensado solo para texto). Mismo trazo que la maqueta.
 */
function MissionRing({
  value, size, children, className, "aria-label": ariaLabel,
}: { value: number; size: number; children: ReactNode; className?: string; "aria-label"?: string }) {
  const stroke = size <= 44 ? 2 : 2.5;
  const r = size / 2 - stroke - 0.5;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={cx("today-mission-ring", className)} style={{ width: size, height: size }} role={ariaLabel ? "img" : undefined} aria-label={ariaLabel}>
      <svg className="today-mission-ring-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="today-mission-ring-track" strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="today-mission-ring-arc"
            strokeWidth={stroke}
            strokeDasharray={`${v * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="today-mission-ring-ic">{children}</span>
    </span>
  );
}

/** Misión de hoy: cadena de misiones con la actual desplegada y la recompensa del día. */
export function MissionChainSection({ state, derived, dayPlan }: { state: UserState; derived: Derived; dayPlan: DayPlanView }) {
  const { plan, statuses, done, total, completed, minutes: planMinutes, tomorrow } = dayPlan;
  const missions = plan.missions;
  const currentIndex = useMemo(() => statuses.findIndex((s) => !s.done), [statuses]);

  const extras = useMemo(
    () =>
      missions.map((m): MissionExtra => {
        if (m.kind === "advance" && m.unitId) return { unitNumber: catalog.unitById.get(m.unitId)?.number };
        if (m.kind === "trial" && m.trialId) {
          const trial = trialById.get(m.trialId);
          if (!trial) return {};
          const unitNumber = trial.unitIds[0] ? catalog.unitById.get(trial.unitIds[0])?.number : undefined;
          return { unitNumber, readiness: trialReadiness(trial, catalog, derived.progress).ratio };
        }
        return {};
      }),
    [missions, derived.progress],
  );

  const leastFresh = total === 0 ? leastFreshSubject(catalog, currentSubjects, derived.progress) : null;

  return (
    <InkCard aria-label="Misión de hoy" className="today-mission">
      <div className="today-mission-top">
        <p className="mono-label is-gold">✦ Misión de hoy</p>
        <Tooltip content="Plan cerrado al empezar el día; cada misión se marca sola al hacerla. Lo que no termines pasa a mañana, sin culpa.">
          <button type="button" className="today-info" aria-label="Cómo funciona la Misión de hoy">
            <Icons.help aria-hidden="true" {...SIZE_ROW} />
          </button>
        </Tooltip>
        {total > 0 && (
          <div className="today-mission-tokens">
            <span className="today-t">
              <Icons.done aria-hidden="true" {...SIZE_BTN} />
              <b className="num">{done}</b> / {total} hechas
            </span>
            <span className="today-t" title="Plan de hoy / presupuesto diario">
              <Icons.duration aria-hidden="true" {...SIZE_BTN} />
              <b className="num">{fmtMinutes(planMinutes)}</b> / {fmtMinutes(state.settings.dailyMinutes)}
            </span>
            {plan.focus.length > 0 && (
              <span className="today-t" title="Asignaturas en foco (rotación)">
                <Icons.subject aria-hidden="true" {...SIZE_BTN} />
                {plan.focus.map((sid) => (
                  <SubjectTag key={sid} subjectId={sid} variant="code" size="sm" />
                ))}
              </span>
            )}
            <span className={cx("today-t", derived.streak.activeToday && "is-gold")}>
              <Icons.streak aria-hidden="true" {...SIZE_BTN} />
              racha{" "}
              <b className="num">{derived.streak.activeToday ? num(derived.streak.current) : `→ ${num(derived.streak.current + 1)}`}</b>
            </span>
          </div>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          size="md"
          title="Sin misión hoy"
          description={
            leastFresh
              ? `No hay conceptos nuevos ni repasos que encajen en el plan. Buen momento para practicar ejercicios de ${leastFresh.shortName}.`
              : "No hay conceptos nuevos ni repasos que encajen en el plan. Estudia libremente desde «En la cola»."
          }
          action={
            <Button variant="ghost" onClick={() => navigate(leastFresh ? `/sesion?asig=${leastFresh.id}` : "/sesion")}>
              Estudiar libremente
            </Button>
          }
        />
      ) : (
        <>
          <div className="today-mission-chain" role="list" aria-label="Misiones de hoy">
            {completed && (
              <div className="today-mission-item" role="listitem">
                <CompletedPanel />
              </div>
            )}
            {missions.map((m, i) => {
              const status = statuses[i];
              const isCurrent = !completed && i === currentIndex;
              const showLink = i > 0 || completed;
              return (
                <div key={m.id} className="today-mission-item" role="listitem">
                  {showLink && (
                    <span className={cx("today-mission-link", (completed || i === currentIndex || i === currentIndex + 1) && "is-lit")} aria-hidden="true" />
                  )}
                  {isCurrent ? (
                    <CurrentPanel mission={m} status={status} extra={extras[i]} index={i} next={nextLabel(missions, i)} showKbd />
                  ) : (
                    <ChainNode mission={m} status={status} extra={extras[i]} index={i} done={completed || status.done} />
                  )}
                </div>
              );
            })}
            <div className="today-mission-item" role="listitem">
              <span className={cx("today-mission-link", completed && "is-lit")} aria-hidden="true" />
              <PrizeNode completed={completed} />
            </div>
          </div>

          {/* Móvil: tira de nodos pequeños + la actual (o el día hecho) desplegada debajo (maqueta -390). */}
          <div className="today-mission-mobile">
            <div className="today-mission-strip" role="list" aria-label="Misiones de hoy">
              {missions.map((m, i) => {
                const status = statuses[i];
                const isCurrent = !completed && i === currentIndex;
                return (
                  <div key={m.id} className="today-mission-strip-item" role="listitem">
                    {i > 0 && (
                      <span className={cx("today-mission-link", "is-strip", (completed || i === currentIndex || i === currentIndex + 1) && "is-lit")} aria-hidden="true" />
                    )}
                    <StripNode mission={m} status={status} current={isCurrent} done={completed || status.done} />
                  </div>
                );
              })}
              <div className="today-mission-strip-item" role="listitem">
                <span className={cx("today-mission-link", "is-strip", completed && "is-lit")} aria-hidden="true" />
                <PrizeNode completed={completed} compact />
              </div>
            </div>
            {completed ? (
              <CompletedPanel />
            ) : (
              currentIndex >= 0 && (
                <CurrentPanel
                  mission={missions[currentIndex]}
                  status={statuses[currentIndex]}
                  extra={extras[currentIndex]}
                  index={currentIndex}
                  next={nextLabel(missions, currentIndex)}
                />
              )
            )}
          </div>

          <div className="today-mission-tomorrow">
            <span className="today-mission-tomorrow-label">
              <span className="today-t">
                <CalendarClock aria-hidden="true" {...SIZE_ROW} />
                <b>Mañana</b>
              </span>
            </span>
            {tomorrow.reviews === 0 && tomorrow.focus.length === 0 ? (
              <span className="today-t today-mission-tomorrow-empty">Sin previsión todavía</span>
            ) : (
              <span className="today-mission-mini" title="Previsión: la rotación de mañana y los repasos que vencen">
                {tomorrow.reviews > 0 && (
                  <>
                    <span className="today-mission-mn is-rv">
                      <span className="today-mission-mn-c">
                        <Icons.review aria-hidden="true" {...SIZE_LABEL} />
                      </span>
                      <span className="num">≈ {num(tomorrow.reviews)}</span>
                    </span>
                    {tomorrow.focus.length > 0 && <span className="today-mission-link is-mini" aria-hidden="true" />}
                  </>
                )}
                {tomorrow.focus.map((sid, i) => (
                  <span key={sid} className="today-mission-mn-group">
                    <span className="today-mission-mn">
                      <span className="today-mission-mn-c">
                        <Icons.newConcept aria-hidden="true" {...SIZE_LABEL} />
                      </span>
                      <SubjectTag subjectId={sid} variant="code" size="sm" />
                    </span>
                    {i < tomorrow.focus.length - 1 && <span className="today-mission-link is-mini" aria-hidden="true" />}
                  </span>
                ))}
              </span>
            )}
            <a className="today-link today-mission-camino" href={href("/misiones?tab=camino")}>
              <Route aria-hidden="true" {...SIZE_ROW} />
              Camino
              <Icons.open aria-hidden="true" {...SIZE_ROW} />
            </a>
          </div>
        </>
      )}
    </InkCard>
  );
}

function nextLabel(missions: readonly DayMission[], index: number): ReactNode {
  const next = missions[index + 1];
  if (!next) return "Día redondo";
  return (
    <>
      {KIND_LABEL[next.kind]} {next.subjectId && <SubjectTag subjectId={next.subjectId} variant="code" size="sm" />}
    </>
  );
}

function missionMeta(m: DayMission): ReactNode {
  if (m.subjectId) return <SubjectTag subjectId={m.subjectId} variant="code" size="sm" />;
  return null;
}

function unitLabel(extra: MissionExtra, m: DayMission): string {
  return extra.unitNumber !== undefined ? `T${extra.unitNumber} · ${minutesShort(m.minutes)}` : minutesShort(m.minutes);
}

/** Nodo compacto de la cadena (escritorio): hecho o pendiente, con su ficha corta. */
function ChainNode({ mission, status, extra, index, done }: { mission: DayMission; status: MissionStatus; extra: MissionExtra; index: number; done: boolean }) {
  const KindIcon = KIND_ICON[mission.kind];
  return (
    <div className={cx("today-mission-node", done && "is-done")}>
      <span className="today-mission-node-n mono-label num">{String(index + 1).padStart(2, "0")}</span>
      <span className="today-mission-node-ic">
        {done ? <Icons.done aria-hidden="true" {...SIZE_NODE} /> : <KindIcon aria-hidden="true" {...SIZE_NODE} />}
        {!done && <NodeBadge mission={mission} status={status} extra={extra} />}
      </span>
      <span className="today-mission-node-title">
        <b>{KIND_LABEL[mission.kind]}</b>
        <span className="today-mission-node-meta">
          {mission.kind === "advance" || mission.kind === "trial" ? (
            <>
              {missionMeta(mission)}
              <span>{unitLabel(extra, mission)}</span>
            </>
          ) : (
            <span>{minutesShort(mission.minutes)}</span>
          )}
        </span>
      </span>
    </div>
  );
}

const BADGE_LABEL: Partial<Record<DayMissionKind, string>> = { review: "repasos", reinforce: "conceptos", advance: "nuevos" };

/** Ficha de la esquina de un nodo pendiente: la cuenta objetivo, o la preparación de una prueba. */
function NodeBadge({ mission, status, extra }: { mission: DayMission; status: MissionStatus; extra: MissionExtra }) {
  if (mission.kind === "trial") {
    const ratio = extra.readiness ?? 0;
    return (
      <span className="today-mission-node-badge is-gold num" title={`Listo · preparación ${pct(ratio)}`}>
        {pct(ratio)}
      </span>
    );
  }
  return (
    <span className="today-mission-node-badge num" title={`${status.target} ${BADGE_LABEL[mission.kind]}`}>
      {status.target}
    </span>
  );
}

/** Nodo diminuto de la tira móvil: solo el círculo y una etiqueta corta. */
function StripNode({ mission, status, current, done }: { mission: DayMission; status: MissionStatus; current: boolean; done: boolean }) {
  const KindIcon = KIND_ICON[mission.kind];
  const label = mission.subjectId ? <SubjectTag subjectId={mission.subjectId} variant="code" size="sm" /> : KIND_ABBR[mission.kind];
  return (
    <div className={cx("today-mission-strip-node", current && "is-current", done && "is-done")}>
      {current ? (
        <MissionRing value={status.target > 0 ? status.count / status.target : 0} size={40}>
          <KindIcon aria-hidden="true" size={16} strokeWidth={1.5} />
        </MissionRing>
      ) : (
        <span className="today-mission-node-ic is-sm">{done ? <Icons.done aria-hidden="true" {...SIZE_LABEL} /> : <KindIcon aria-hidden="true" {...SIZE_LABEL} />}</span>
      )}
      <small className="today-mission-strip-label num">{current ? `${status.count}/${status.target}` : label}</small>
    </div>
  );
}

/** Nodo final: la recompensa del día, +60 XP al completar todas las misiones. */
function PrizeNode({ completed, compact }: { completed: boolean; compact?: boolean }) {
  return (
    <div className={cx("today-mission-node", "is-prize", completed && "is-done")}>
      <span className={cx("today-mission-node-ic", "is-prize", compact && "is-sm")}>
        {completed ? <Icons.done aria-hidden="true" {...(compact ? SIZE_LABEL : SIZE_NODE)} /> : <CalendarCheck aria-hidden="true" {...(compact ? SIZE_LABEL : SIZE_NODE)} />}
      </span>
      {compact ? (
        <small className="today-mission-strip-label num">+60</small>
      ) : (
        <span className="today-mission-node-title">
          <b>Día redondo</b>
          <span className="today-t is-gold">
            <Icons.xp aria-hidden="true" {...SIZE_LABEL} />
            <b className="num">+60 XP</b>
          </span>
        </span>
      )}
    </div>
  );
}

/** Panel desplegado de la misión en curso: título, progreso, «Seguir» y lo siguiente. */
function CurrentPanel({
  mission, status, extra, index, next, showKbd, className,
}: {
  mission: DayMission; status: MissionStatus; extra: MissionExtra; index: number; next: ReactNode; showKbd?: boolean; className?: string;
}) {
  const KindIcon = KIND_ICON[mission.kind];
  const isTrial = mission.kind === "trial";
  const ringValue = isTrial ? (status.done ? 1 : 0) : status.target > 0 ? status.count / status.target : 0;
  const subjects = mission.kind === "review" || mission.kind === "reinforce" ? subjectsOf(mission) : null;

  return (
    <div className={cx("today-mission-current", className)}>
      <div className="today-mission-current-head">
        <MissionRing value={ringValue} size={60} className="today-mission-current-ring" aria-label={`Progreso: ${status.count} de ${status.target}`}>
          <KindIcon aria-hidden="true" size={22} strokeWidth={1.5} />
        </MissionRing>
        <div>
          <p className="mono-label today-mission-current-n">{String(index + 1).padStart(2, "0")} · en curso</p>
          <h3>{mission.title}</h3>
        </div>
      </div>
      <div className="today-mission-current-meta">
        {mission.kind === "review" && (
          <>
            <span className="today-t">
              <b className="num">{status.target}</b> {pluralWord(status.target, "repaso", "repasos")}
            </span>
            {subjects && subjects.size > 0 && (
              <span className="today-t">
                <Icons.subject aria-hidden="true" {...SIZE_BTN} />
                <b className="num">{subjects.size}</b> {pluralWord(subjects.size, "asignatura", "asignaturas")}
              </span>
            )}
            <span className="today-t">
              <Icons.duration aria-hidden="true" {...SIZE_BTN} />
              <span className="num">{minutesShort(mission.minutes)}</span>
            </span>
          </>
        )}
        {mission.kind === "reinforce" && (
          <>
            <span className="today-t">
              <b className="num">{status.target}</b> {pluralWord(status.target, "concepto", "conceptos")}
            </span>
            {subjects && subjects.size > 0 && (
              <span className="today-t">
                <Icons.subject aria-hidden="true" {...SIZE_BTN} />
                <b className="num">{subjects.size}</b> {pluralWord(subjects.size, "asignatura", "asignaturas")}
              </span>
            )}
            <span className="today-t">
              <Icons.duration aria-hidden="true" {...SIZE_BTN} />
              <span className="num">{minutesShort(mission.minutes)}</span>
            </span>
          </>
        )}
        {mission.kind === "advance" && mission.subjectId && (
          <>
            <span className="today-t">
              <b className="num">{status.target}</b> {pluralWord(status.target, "concepto nuevo", "conceptos nuevos")}
            </span>
            <SubjectTag subjectId={mission.subjectId} variant="code" size="sm" />
            {extra.unitNumber !== undefined && <span className="today-t">Tema {extra.unitNumber}</span>}
            <span className="today-t">
              <Icons.duration aria-hidden="true" {...SIZE_BTN} />
              <span className="num">{minutesShort(mission.minutes)}</span>
            </span>
          </>
        )}
        {isTrial && mission.subjectId && (
          <>
            <SubjectTag subjectId={mission.subjectId} variant="code" size="sm" />
            {extra.unitNumber !== undefined && <span className="today-t">Tema {extra.unitNumber}</span>}
            {extra.readiness !== undefined && (
              <span className="today-t is-gold">
                <Icons.readiness aria-hidden="true" {...SIZE_BTN} />
                Preparación <b className="num">{pct(extra.readiness)}</b>
              </span>
            )}
            <span className="today-t">
              <Icons.duration aria-hidden="true" {...SIZE_BTN} />
              <span className="num">{minutesShort(mission.minutes)}</span>
            </span>
          </>
        )}
      </div>
      {!isTrial && (
        <div className="today-mission-current-progress">
          <ProgressBar value={status.count} max={status.target} size="sm" tone="gold" label={`${mission.title}: ${status.count} de ${status.target}`} />
          <span className="today-mission-current-progress-n num">
            <b>{status.count}</b> / {status.target}
          </span>
        </div>
      )}
      <div className="today-mission-current-cta">
        <Button variant="primary" size="lg" icon={<Icons.session fill="currentColor" {...SIZE_BTN} />} kbd={showKbd ? "S" : undefined} onClick={() => navigate(missionHref(mission))}>
          Seguir
        </Button>
        <span className="today-t">
          <Icons.next aria-hidden="true" {...SIZE_ROW} />
          Después: {next}
        </span>
      </div>
    </div>
  );
}

/** Estado del día completado: calmado, sin diálogo, en el hueco del panel desplegado. */
function CompletedPanel({ className }: { className?: string }) {
  return (
    <div className={cx("today-mission-current", "today-mission-current--done", className)}>
      <div className="today-mission-current-head">
        <span className="today-mission-node-ic is-done today-mission-current-ic">
          <CalendarCheck aria-hidden="true" size={24} strokeWidth={1.5} />
        </span>
        <div>
          <p className="mono-label today-mission-current-n is-gold">Día redondo</p>
          <h3>Hecho por hoy</h3>
        </div>
      </div>
      <p className="today-mission-current-done-text">
        Todas las misiones de hoy están hechas. Mañana, más.
        <span className="today-t is-gold">
          <Icons.xp aria-hidden="true" {...SIZE_ROW} />
          <b className="num">+60 XP</b>
        </span>
      </p>
    </div>
  );
}
