// Vista "Carta" (Trayectorias): una pista por asignatura, de su inicio de
// curso a su misión principal, con los pasos situados por fecha.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { RouteStep, SubjectRoute } from "../../../domain/route";
import { DEFAULT_FINAL_DAY, courseStartOf } from "../../../domain/route";
import { dayKey, daysBetween, parseDayKey } from "../../../domain/time";
import { catalog, trialById } from "../../../state/catalog";
import { useUserState } from "../../../state/store";
import { useDerived, useRoutes } from "../../../state/derived";
import { href } from "../../../state/router";
import { EmptyState, Icons, IconButton, Section, Star, SubjectDot, Tooltip, clamp, cx, dateShort, month, pct, plural, relDays, subjectColor, subjectFg, subjectName } from "../../../ui";
import { gradeNum } from "../helpers";
import { nearestBoss, stepEyebrow, stepHeading, stepHref, subjectShort } from "./helpers";
import { Planet, RouteMark, stepStateLabel } from "./RouteMark";

const ROW_H = 46;
/** Cabecera del eje: fila de la etiqueta "HOY" (arriba) y fila de los meses (debajo), sin solaparse. */
const AXIS_H = 46;
const PILL_Y = 12;
const MONTH_Y = AXIS_H - 10;
const MARGIN_BOTTOM = 12;
const MIN_CHART_WIDTH = 640;
const MIN_PLOT_W = 300;
/** Ancho del tooltip (CSS: .rumbo-chart-tip). */
const TIP_W = 256;
/** Por encima de esta y (px dentro de la carta) el tooltip cabe arriba del paso; si no, va debajo. */
const TIP_ABOVE_MIN_Y = 176;

type Hover = { step: RouteStep; route: SubjectRoute; x: number; y: number };

/** "21 OCT" a partir de un día "YYYY-MM-DD". */
const dayMonthUpper = (day: string): string => `${Number(day.slice(8, 10))} ${month(day, "short").toUpperCase()}`;

function monthTicks(start: string, end: string): { day: string; label: string }[] {
  const ticks: { day: string; label: string }[] = [];
  const s = parseDayKey(start);
  const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
  if (cursor < s) cursor.setMonth(cursor.getMonth() + 1);
  const e = parseDayKey(end);
  while (cursor <= e) {
    const day = dayKey(cursor);
    ticks.push({ day, label: month(day, "short").toUpperCase() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

/**
 * Ancho del contenedor de la carta (ocupa todo el ancho disponible; en móvil, mínimo 640 con scroll).
 * Ref de callback: mide también si el contenedor aparece después del primer render.
 */
function useElementWidth(): [(el: HTMLDivElement | null) => void, number, HTMLDivElement | null] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setWidth((w) => (w === el.clientWidth ? w : el.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width, el];
}

function ChartTooltip({ hover, chartWidth }: { hover: Hover; chartWidth: number }) {
  const { step, route } = hover;
  const trial = step.trialId ? trialById.get(step.trialId) : undefined;
  const concepts = step.unitIds.reduce((n, id) => n + (catalog.conceptsByUnit.get(id)?.length ?? 0), 0);
  const above = hover.y >= TIP_ABOVE_MIN_Y;
  const left = clamp(hover.x - TIP_W / 2, 4, Math.max(4, chartWidth - TIP_W - 4));
  const style = above ? { left, top: hover.y - 16, transform: "translateY(-100%)" } : { left, top: hover.y + 18 };
  return (
    <div className="rumbo-chart-tip" style={style} aria-hidden="true">
      <p className="rumbo-chart-tip-eyebrow">
        <SubjectDot subjectId={step.subjectId} />
        <span className="rumbo-step-subj">{subjectShort(step.subjectId, catalog)}</span>
        <span className="mono-label">{stepEyebrow(step, catalog)}</span>
      </p>
      <h4>{stepHeading(step)}</h4>
      <dl>
        <dt>{step.kind === "exam" ? "Fecha" : "Fecha objetivo"}</dt>
        <dd>
          {dateShort(step.due)} · {relDays(step.daysLeft)}
          {step.assumed ? " · provisional" : ""}
        </dd>
        {step.best != null ? (
          <>
            <dt>Mejor nota</dt>
            <dd>
              <span className="rumbo-score num">{gradeNum(step.best)}</span>
              {step.first != null && step.first !== step.best && <span className="tone-3"> · 1.º {gradeNum(step.first)}</span>}
            </dd>
          </>
        ) : (
          step.status !== "done" && (
            <>
              <dt>Preparación</dt>
              <dd>
                {pct(step.readiness)}
                {concepts > 0 && ` · ${Math.round(step.readiness * concepts)} de ${concepts} conceptos`}
              </dd>
            </>
          )
        )}
        {trial && (
          <>
            <dt>Prueba</dt>
            <dd>
              {trial.durationMin} min · {plural(trial.problems.length, "problema", "problemas")}
            </dd>
          </>
        )}
        <dt>Estado</dt>
        <dd className={step.status === "late" ? "rumbo-late-word" : undefined}>{stepStateLabel(step)}</dd>
      </dl>
      <div className="rumbo-chart-tip-foot">
        {subjectShort(route.subjectId, catalog)}: {route.done} de {route.total} pasos hechos
      </div>
    </div>
  );
}

type ChartProps = {
  routes: readonly SubjectRoute[];
  activeId: string | null;
  /** Ancho del SVG (la carta sin la columna de nombres). */
  width: number;
  rightGutter: number;
  axisStart: string;
  courseStart: string;
  end: string;
  today: string;
  onHover: (h: Hover | null | ((prev: Hover | null) => Hover | null)) => void;
  onSelect: (id: string | null) => void;
};

/** Margen izquierdo del trazado dentro del SVG (para que las marcas del inicio no se corten). */
const PLOT_PAD = 12;

/** Posición x (en el SVG) de un día. */
function xScale(axisStart: string, end: string, plotW: number) {
  const totalDays = Math.max(1, daysBetween(axisStart, end));
  return (day: string) => PLOT_PAD + clamp(daysBetween(axisStart, day) / totalDays, 0, 1) * plotW;
}

/**
 * El SVG de la carta (pistas, marcas, eje y "hoy"). Memoizado: pasar el ratón por los pasos
 * solo cambia el tooltip (estado del padre) y no vuelve a pintar las ~100 marcas. Es decorativo
 * para lectores de pantalla: la columna de nombres y el panel de debajo dan la misma información.
 */
const ChartSvg = memo(function ChartSvg({ routes, activeId, width, rightGutter, axisStart, courseStart, end, today, onHover, onSelect }: ChartProps) {
  const plotW = Math.max(MIN_PLOT_W, width - PLOT_PAD - rightGutter);
  const x = xScale(axisStart, end, plotW);
  const height = AXIS_H + routes.length * ROW_H + MARGIN_BOTTOM;
  const todayX = x(today);
  const courseStartX = x(courseStart);
  const ticks = monthTicks(axisStart, end);
  const firstTickX = ticks.length > 0 ? x(ticks[0].day) : Infinity;
  const showCourseStart = axisStart !== courseStart && Math.abs(courseStartX - todayX) >= 100;

  return (
    <svg className="rumbo-chart" width={width} height={height} aria-hidden="true">
      {ticks.map((t) => (
        <g key={t.day}>
          <line x1={x(t.day)} x2={x(t.day)} y1={MONTH_Y + 6} y2={height - 4} className="rumbo-chart-gridline" />
          <text x={x(t.day) + 5} y={MONTH_Y} className="rumbo-chart-axis">
            {t.label}
          </text>
        </g>
      ))}
      {firstTickX - PLOT_PAD >= 48 && (
        <text x={PLOT_PAD} y={MONTH_Y} className="rumbo-chart-axis">
          {dayMonthUpper(axisStart)}
        </text>
      )}

      {axisStart !== courseStart && (
        <g className="rumbo-chart-coursestart">
          <line x1={courseStartX} x2={courseStartX} y1={MONTH_Y + 6} y2={height - 4} strokeDasharray="1 4" />
          {showCourseStart && (
            <text x={courseStartX} y={PILL_Y + 3} textAnchor="middle">
              INICIO DE CURSO
            </text>
          )}
        </g>
      )}

      {routes.map((route, i) => {
        const y = AXIS_H + i * ROW_H + ROW_H / 2;
        const trackStart = x(courseStart);
        const trackEnd = x(route.boss?.due ?? end);
        const doneSteps = route.steps.filter((s) => s.status === "done" && s.kind !== "exam");
        const lastDone = doneSteps.length > 0 ? doneSteps.reduce((a, b) => (b.due > a.due ? b : a)) : undefined;
        const litEnd = lastDone ? x(lastDone.due) : trackStart;
        const color = subjectColor(route.subjectId);
        const active = route.subjectId === activeId;
        const bossDone = route.boss != null && (route.boss.status === "done" || route.boss.daysLeft < 0);
        const days = route.boss ? Math.max(0, route.boss.daysLeft) : null;
        return (
          <g key={route.subjectId} className={cx("rumbo-chart-row", active && "is-active")}>
            <rect x={-12} y={y - ROW_H / 2 + 2} width={width + 10} height={ROW_H - 4} rx={10} className="rumbo-chart-band" onClick={() => onSelect(route.subjectId)} />
            <g pointerEvents="none">
              <line x1={trackStart} x2={trackEnd} y1={y} y2={y} stroke={color} strokeOpacity={0.2} strokeWidth={2} />
              {litEnd > trackStart && <line x1={trackStart} x2={litEnd} y1={y} y2={y} stroke={color} strokeOpacity={0.85} strokeWidth={2.6} />}
            </g>
            {route.steps.map((s) => {
              const mx = x(s.due);
              const size = s.kind === "exam" ? 24 : 18;
              const hover = { step: s, route, x: mx, y };
              return (
                <g
                  key={s.key}
                  transform={`translate(${mx - size / 2} ${y - size / 2})`}
                  onMouseEnter={() => onHover(hover)}
                  onMouseLeave={() => onHover((h) => (h?.step.key === s.key ? null : h))}
                  onClick={() => onSelect(route.subjectId)}
                  className="rumbo-chart-mark"
                >
                  <rect width={size} height={size} fill="transparent" />
                  <RouteMark step={s} size={size} />
                </g>
              );
            })}
            {route.boss && (
              <g className="rumbo-chart-cd" pointerEvents="none">
                <text x={width - rightGutter + 14} y={y - 3} className="num">
                  {bossDone ? "hecho" : days === 0 ? "hoy" : days}
                  {!bossDone && days !== 0 && <tspan className="rumbo-chart-cd-u"> d</tspan>}
                </text>
                <text x={width - rightGutter + 14} y={y + 12} className="rumbo-chart-cd-d">
                  {dateShort(route.boss.due)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      <g pointerEvents="none">
        <line x1={todayX} x2={todayX} y1={PILL_Y + 9} y2={height - 2} className="rumbo-chart-today" />
        <g transform={`translate(${clamp(todayX, 44, width - 44)} ${PILL_Y})`}>
          <rect x={-42} y={-9} width={84} height={18} rx={9} className="rumbo-chart-today-pill" />
          <text y={3.5} textAnchor="middle" className="rumbo-chart-today-label">
            HOY · {dayMonthUpper(today)}
          </text>
        </g>
      </g>
    </svg>
  );
});

/**
 * Columna de nombres (botones reales): elige la asignatura cuyo rumbo se lista debajo.
 * En móvil queda fija a la izquierda mientras la carta se desplaza. Flechas arriba/abajo recorren las filas.
 */
function ChartLabels({ routes, activeId, width, onSelect }: { routes: readonly SubjectRoute[]; activeId: string | null; width: number; onSelect: (id: string | null) => void }) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[clamp(i + (e.key === "ArrowDown" ? 1 : -1), 0, routes.length - 1)]?.focus();
  };
  return (
    <div className="rumbo-chart-labels" style={{ width, paddingTop: AXIS_H }} role="group" aria-label="Asignaturas de la carta">
      {routes.map((route, i) => {
        const active = route.subjectId === activeId;
        const late = route.steps.filter((s) => s.status === "late").length;
        return (
          <button
            key={route.subjectId}
            type="button"
            className={cx("rumbo-chart-label", active && "is-active")}
            style={{ height: ROW_H - 4 }}
            aria-pressed={active}
            aria-label={`${subjectShort(route.subjectId, catalog)}: ${route.done} de ${route.total} pasos, ${late > 0 ? plural(late, "atrasado", "atrasados") : "al día"}. Ver su rumbo`}
            onClick={() => onSelect(route.subjectId)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="rumbo-chart-name" style={{ color: subjectFg(route.subjectId) }}>
              {subjectShort(route.subjectId, catalog)}
            </span>
            <span className="rumbo-chart-sub">
              {route.done} de {route.total} · {late > 0 ? <span className="rumbo-late-word">{plural(late, "atrasado", "atrasados")}</span> : "al día"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Ceja abreviada del panel de asignatura: "Tema 3" → "T3", "Control · Tema 3" → "Control · T3". */
const shortUnitEyebrow = (step: RouteStep): string => stepEyebrow(step, catalog).replace(/Tema (\d+)/, "T$1");

function RoutePanelRow({ step }: { step: RouteStep }) {
  const derived = useDerived();
  const link = href(step.kind === "exam" ? `/asignatura/${step.subjectId}` : stepHref(step, catalog, derived.progress));
  const action = step.kind === "exam" ? "ver la asignatura" : step.trialId ? "abrir la prueba" : "repasar el tema";
  return (
    <li className={`rumbo-panel-row is-${step.status}`}>
      <a className="rumbo-step-link" href={link} aria-label={`${stepHeading(step)}, ${stepStateLabel(step)}: ${action}`} />
      <RouteMark step={step} size={26} />
      <div className="rumbo-panel-main">
        <p className="mono-label tone-3">{shortUnitEyebrow(step)}</p>
        <b>{stepHeading(step)}</b>
      </div>
      <span className="tone-3 mono-label rumbo-panel-date">{dateShort(step.due)}</span>
      <div className="rumbo-panel-res">
        {step.best != null ? (
          <>
            <span className="rumbo-score num">{gradeNum(step.best)}</span>
            <span className="rumbo-stars" aria-label={`${step.stars} de 3 estrellas`}>
              {[0, 1, 2].map((i) => (
                <Star key={i} state={i < step.stars ? "mastered" : "unseen"} size={10} />
              ))}
            </span>
          </>
        ) : step.status === "done" ? (
          <span className="tone-3">hecho</span>
        ) : step.status === "skipped" ? (
          <span className="tone-3">ya no aplica</span>
        ) : step.status === "late" ? (
          <span className="rumbo-late-word">atrasado · {-step.daysLeft} d</span>
        ) : step.assumed ? (
          <span className="rumbo-tag rumbo-tag--muted">provisional</span>
        ) : step.readiness > 0 ? (
          <span className="tone-3">{pct(step.readiness)} listo</span>
        ) : null}
      </div>
    </li>
  );
}

export function CartaView({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const courseStart = useUserState((s) => courseStartOf(s.settings));
  const routes = useRoutes();
  const derived = useDerived();
  const [wrapRef, containerWidth, wrapEl] = useElementWidth();
  const [hover, setHover] = useState<Hover | null>(null);

  const end = useMemo(() => routes.reduce((max, r) => ((r.boss?.due ?? DEFAULT_FINAL_DAY) > max ? r.boss?.due ?? DEFAULT_FINAL_DAY : max), courseStart), [routes, courseStart]);
  const today = dayKey(derived.now);
  // Si hoy es antes del inicio de curso, el eje empieza hoy (no en C): así la línea "hoy" no
  // queda pegada al principio de las pistas, que siguen naciendo en C con un hito propio.
  const axisStart = today < courseStart ? today : courseStart;

  const width = Math.max(MIN_CHART_WIDTH, containerWidth || 1100);
  const compact = containerWidth > 0 && containerWidth < 720;
  const scrolls = containerWidth > 0 && width > containerWidth;
  const labelW = compact ? 112 : 148;
  const rightGutter = compact ? 70 : 96;
  const svgW = width - labelW;

  // En móvil la carta se desplaza en horizontal: al abrirla, deja "hoy" a la vista
  // (la columna de nombres queda fija a la izquierda).
  useEffect(() => {
    if (!wrapEl || !scrolls) return;
    const todayX = labelW + xScale(axisStart, end, Math.max(MIN_PLOT_W, svgW - PLOT_PAD - rightGutter))(today);
    const visible = wrapEl.clientWidth - labelW;
    wrapEl.scrollLeft = Math.max(0, todayX - labelW - visible * 0.4);
  }, [wrapEl, scrolls, labelW, svgW, rightGutter, axisStart, today, end]);

  const onHover = useCallback((h: Hover | null | ((prev: Hover | null) => Hover | null)) => setHover(h), []);

  const defaultId = nearestBoss(routes)?.route.subjectId ?? routes[0]?.subjectId ?? null;
  const activeRoute = routes.find((r) => r.subjectId === selected) ?? routes.find((r) => r.subjectId === defaultId);
  const activeId = activeRoute?.subjectId ?? null;
  const legendSubject = activeId ?? routes[0]?.subjectId ?? "";

  if (routes.length === 0) {
    return <EmptyState title="Sin asignaturas en curso" description="La carta necesita al menos una asignatura para trazar su trayectoria." />;
  }

  const activeLate = activeRoute ? activeRoute.steps.filter((s) => s.status === "late").length : 0;

  return (
    <Section
      card
      eyebrow={`${dateShort(axisStart)} → ${dateShort(end)} · una pista por asignatura`}
      title="Trayectorias"
      action={
        <Tooltip
          content={
            <span className="rumbo-legend-tip">
              <span>Línea encendida = hecho. Si llega a HOY, vas al día.</span>
              <span className="rumbo-legend-tip-list">
                <span>
                  <RouteMark step={{ kind: "control", status: "done", stars: 3, subjectId: legendSubject }} size={14} /> Hecho
                </span>
                <span>
                  <RouteMark step={{ kind: "control", status: "next", stars: 0, subjectId: legendSubject }} size={14} /> Siguiente
                </span>
                <span>
                  <RouteMark step={{ kind: "control", status: "late", stars: 0, subjectId: legendSubject }} size={14} /> Atrasado
                </span>
                <span>
                  <RouteMark step={{ kind: "control", status: "upcoming", stars: 0, subjectId: legendSubject }} size={14} /> Próximo
                </span>
                <span>
                  <RouteMark step={{ kind: "sim-parcial", status: "upcoming", stars: 0, subjectId: legendSubject }} size={14} /> Simulacro
                </span>
                <span>
                  <Planet subjectId={legendSubject} size={16} /> Examen real
                </span>
              </span>
            </span>
          }
        >
          <IconButton aria-label="Ayuda de la carta" icon={<Icons.help aria-hidden="true" />} variant="quiet" size="sm" tooltip={false} />
        </Tooltip>
      }
    >
      <div className={cx("rumbo-chart-wrap", scrolls && "is-scroll")} ref={wrapRef} onMouseLeave={() => setHover(null)}>
        <div className="rumbo-chart-inner" style={{ width }}>
          <ChartLabels routes={routes} activeId={activeId} width={labelW} onSelect={onSelect} />
          <ChartSvg
            routes={routes}
            activeId={activeId}
            width={svgW}
            rightGutter={rightGutter}
            axisStart={axisStart}
            courseStart={courseStart}
            end={end}
            today={today}
            onHover={onHover}
            onSelect={onSelect}
          />
          {hover && <ChartTooltip hover={{ ...hover, x: hover.x + labelW }} chartWidth={width} />}
        </div>
      </div>
      {scrolls && <p className="tone-3 rumbo-chart-hint">Desliza la carta para ver hasta {month(end, "long")} →</p>}

      {activeRoute && (
        <div className="rumbo-panel">
          <div className="rumbo-panel-head">
            <SubjectDot subjectId={activeRoute.subjectId} size={9} />
            <h3>{subjectName(activeRoute.subjectId)}</h3>
            <span className="tone-3">
              {activeRoute.done} de {activeRoute.total} pasos ·{" "}
              {activeLate > 0 ? <span className="rumbo-late-word">{plural(activeLate, "atrasado", "atrasados")}</span> : "al día"}
              {activeRoute.boss && (
                <>
                  {" "}
                  · {activeRoute.boss.title} el {dateShort(activeRoute.boss.due)}
                  {activeRoute.boss.assumed ? " (provisional)" : ""}
                </>
              )}
            </span>
          </div>
          <ul className="rumbo-panel-list">
            {activeRoute.steps.map((s) => (
              <RoutePanelRow key={s.key} step={s} />
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
