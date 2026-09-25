// Pestaña "Principales": cabecera del Rumbo, aviso de plantilla y el
// interruptor Agenda · Carta (Bitácora / Trayectorias).
import { useState } from "react";
import { Pencil } from "lucide-react";
import { DEFAULT_FINAL_DAY, courseStartOf, nextObjectives, thisWeek } from "../../../domain/route";
import { dayKey, daysBetween } from "../../../domain/time";
import { catalog } from "../../../state/catalog";
import { useUserState } from "../../../state/store";
import { useDerived, useRoutes } from "../../../state/derived";
import { applyOnlineTemplate } from "../../../state/actions";
import { href, setQuery, useRoute } from "../../../state/router";
import { Button, ICON_SIZE, Icons, Segmented, Tooltip, dateShort, month, plural, pluralWord, toast, weekday } from "../../../ui";
import { courseWeekOf, globalStats, seasonEnd, someSubjectWithoutAssessments } from "./helpers";
import { AgendaView } from "./AgendaView";
import { CartaView } from "./CartaView";

/** "8 de febrero" a partir de un día "YYYY-MM-DD". */
const dayMonth = (day: string): string => `${Number(day.slice(8, 10))} de ${month(day, "long")}`;
/** "8 feb" a partir de un día "YYYY-MM-DD". */
const dayMonthShort = (day: string): string => `${Number(day.slice(8, 10))} ${month(day, "short")}`;

/**
 * Aviso de fechas: en el primer arranque (asignaturas sin evaluaciones) explica que el rumbo
 * supone un final y ofrece la plantilla; con la plantilla puesta, un chip con la explicación en ⓘ.
 */
function TemplateBanner({ offerTemplate, courseStart }: { offerTemplate: boolean; courseStart: string }) {
  const state = useUserState((s) => s);
  const missing = catalog.subjects.filter((s) => (state.subjects[s.id]?.assessments.length ?? 0) === 0).length;
  const handleApply = () => {
    const count = applyOnlineTemplate();
    toast(
      count > 0
        ? `Plantilla online aplicada a ${plural(count, "asignatura", "asignaturas")}.`
        : "No hay asignaturas sin evaluaciones: nada que rellenar.",
      { tone: count > 0 ? "gold" : "default" },
    );
  };
  if (offerTemplate) {
    return (
      <div className="rumbo-tpl" role="note">
        <Icons.provisional aria-hidden="true" className="rumbo-tpl-icon" />
        <p>
          <b>{plural(missing, "asignatura", "asignaturas")} sin fechas de examen</b>: el rumbo supone un final el {dayMonthShort(DEFAULT_FINAL_DAY)}.
        </p>
        <div className="rumbo-tpl-actions">
          <Button variant="ink" size="sm" icon={<Icons.useTemplate />} onClick={handleApply}>
            Usar plantilla
          </Button>
          <Button variant="ghost" size="sm" icon={<Pencil />} href={href("/ajustes?sec=calendario")}>
            Editar calendario
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="rumbo-tpl-slim">
      <Tooltip content={`Plantilla del grado online, inicio ${dayMonthShort(courseStart)}. Cámbialas en Ajustes cuando tengas la guía.`}>
        <button type="button" className="rumbo-tag rumbo-tag--muted">
          <Icons.provisional aria-hidden="true" width={ICON_SIZE.label.size} height={ICON_SIZE.label.size} strokeWidth={ICON_SIZE.label.strokeWidth} />
          Fechas provisionales
        </button>
      </Tooltip>
      <Button variant="ghost" size="sm" icon={<Pencil />} href={href("/ajustes?sec=calendario")}>
        Editar calendario
      </Button>
    </div>
  );
}

function Hello() {
  const state = useUserState((s) => s);
  const derived = useDerived();
  const routes = useRoutes();
  const now = derived.now;
  const today = dayKey(now);
  const week = thisWeek(routes);
  const late = week.filter((s) => s.status === "late").length;
  const due = week.length - late;
  const stats = globalStats(routes);
  const end = seasonEnd(routes);

  const courseStart = courseStartOf(state.settings);
  const beforeCourse = today < courseStart;
  const daysToCourse = beforeCourse ? daysBetween(today, courseStart) : 0;
  const courseWeek = courseWeekOf(today, courseStart);
  const courseWeeks = courseWeekOf(end, courseStart);

  return (
    <section className="rumbo-hello" aria-labelledby="rumbo-hello-title">
      {courseWeek >= 1 && courseWeek <= courseWeeks && (
        <p className="mono-label rumbo-eyebrow">
          Semana {courseWeek} de {courseWeeks}
        </p>
      )}
      <h2 className="rumbo-h1" id="rumbo-hello-title">
        Rumbo a {month(end, "long")}.
      </h2>
      <div className="rumbo-hello-stats">
        {due > 0 && (
          <span className="rumbo-stat">
            <Icons.calendar aria-hidden="true" size={ICON_SIZE.row.size} strokeWidth={ICON_SIZE.row.strokeWidth} />
            <b className="num">{due}</b> esta semana
          </span>
        )}
        {late > 0 && (
          <span className="rumbo-stat is-ember">
            <Icons.late aria-hidden="true" size={ICON_SIZE.row.size} strokeWidth={ICON_SIZE.row.strokeWidth} />
            <b className="num">{late}</b> {pluralWord(late, "atrasado", "atrasados")}
          </span>
        )}
        {stats.subjects > 0 && (
          <span className="rumbo-stat">
            <Icons.rumbo aria-hidden="true" size={ICON_SIZE.row.size} strokeWidth={ICON_SIZE.row.strokeWidth} />
            <b className="num">
              {stats.onTrack}/{stats.subjects}
            </b>{" "}
            al día
          </span>
        )}
      </div>
      {beforeCourse && (
        <p className="rumbo-summary rumbo-summary--frost">
          El curso empieza el{" "}
          <b>
            {weekday(courseStart)} {dayMonth(courseStart)}
          </b>
          : {daysToCourse === 1 ? "falta" : "faltan"} <b className="num">{daysToCourse}</b> {pluralWord(daysToCourse, "día", "días")}. Todo lo que hagas ahora es ventaja.
        </p>
      )}
    </section>
  );
}

/** "10 misiones principales · 12 ene – 19 feb" (las pendientes, por fecha). */
function MissionsRange() {
  const routes = useRoutes();
  const exams = nextObjectives(routes, Number.POSITIVE_INFINITY)
    .filter((s) => s.kind === "exam")
    .sort((a, b) => a.due.localeCompare(b.due));
  if (exams.length === 0) return null;
  const first = exams[0].due;
  const last = exams[exams.length - 1].due;
  const range = first === last ? dateShort(first) : `${dayMonthShort(first)} – ${dayMonthShort(last)}`;
  return (
    <p className="tone-3 rumbo-toggle-hint">
      {plural(exams.length, "misión principal", "misiones principales")} · <b>{range}</b>
    </p>
  );
}

export function PrincipalesTab() {
  const state = useUserState((s) => s);
  const routes = useRoutes();
  const { query } = useRoute();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const vista: "agenda" | "carta" = query.get("vista") === "carta" ? "carta" : "agenda";

  const offerTemplate = someSubjectWithoutAssessments(state, catalog);
  const showBanner = offerTemplate || routes.some((r) => r.boss?.assumed);

  return (
    <div className="rumbo-principales">
      <Hello />
      {showBanner && <TemplateBanner offerTemplate={offerTemplate} courseStart={courseStartOf(state.settings)} />}
      <div className="rumbo-toggle-row">
        <Segmented
          aria-label="Vista del rumbo"
          value={vista}
          onChange={(v) => setQuery({ vista: v === "agenda" ? null : v })}
          options={[
            { value: "agenda", label: "Agenda" },
            { value: "carta", label: "Carta" },
          ]}
        />
        <MissionsRange />
      </div>
      {vista === "agenda" ? <AgendaView /> : <CartaView selected={selectedSubject} onSelect={setSelectedSubject} />}
    </div>
  );
}
