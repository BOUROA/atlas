/**
 * Ajustes (#/ajustes) · Task 9. Minutos diarios, retención, tema, nota
 * objetivo, exportar/importar copia y ubicación de los ficheros de datos.
 */
import { useEffect, useRef, useState, type Ref } from "react";
import { Download, Upload } from "lucide-react";
import pkg from "../../../package.json";
import { onlineTemplate } from "../../domain/calendar-template";
import { courseStartOf } from "../../domain/route";
import { subjectStateOf } from "../../domain/types";
import { applyOnlineTemplate, exportState, importState, setSettings, upsertAssessment } from "../../state/actions";
import { catalog, currentSubjects } from "../../state/catalog";
import { href, useRoute } from "../../state/router";
import { useUserState } from "../../state/store";
import { Button, Icons, Page, Section, Segmented, SubjectDot, minutes, num, pct, plural, toast } from "../../ui";
import { FieldHelp } from "./FieldHelp";
import { Slider } from "./Slider";
import "./settings.css";

const THEME_OPTIONS = [
  { value: "system" as const, label: "Sistema" },
  { value: "dark" as const, label: "Observatorio" },
  { value: "light" as const, label: "Carta impresa" },
];

function ExportImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const onExport = () => {
    const json = exportState();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-copia-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Copia exportada", { tone: "gold", description: a.download });
  };

  const onPick = () => inputRef.current?.click();
  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      importState(text);
      setResult({ ok: true, message: `Copia «${file.name}» importada y fusionada con tu progreso actual.` });
      toast("Copia importada", { tone: "gold", description: "Se ha fusionado con tu progreso actual." });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "No se pudo importar la copia." });
    }
  };

  return (
    <div>
      <div className="settings-backup-actions">
        <Button variant="ink" icon={<Download size={15} />} onClick={onExport}>
          Exportar copia
        </Button>
        <Button variant="ghost" icon={<Upload size={15} />} onClick={onPick}>
          Importar copia
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
          aria-label="Elegir fichero de copia (.json)"
        />
      </div>
      {result && <p className={`settings-result ${result.ok ? "settings-result--ok" : "settings-result--err"}`}>{result.message}</p>}
      <div className="settings-paths">
        <p className="settings-path-row">
          Fichero de datos: <code>userdata/state.json</code>
        </p>
        <p className="settings-path-row">
          Copias automáticas: <code>userdata/backups/</code> (diaria, últimos 30 días, y las últimas 10 escrituras)
        </p>
      </div>
    </div>
  );
}

/** "Calendario": inicio de curso, plantilla online y la tabla de misiones principales por asignatura. */
function CalendarSection({ ref }: { ref: Ref<HTMLElement> }) {
  const state = useUserState((s) => s);
  const settings = state.settings;
  const courseStart = courseStartOf(settings);
  // Las mismas asignaturas que rellenaría la plantilla (sin ninguna evaluación en el curso actual).
  const missing = Object.keys(onlineTemplate(catalog, state))
    .map((id) => catalog.subjectById.get(id))
    .filter((s) => s !== undefined);

  const onApplyTemplate = () => {
    const count = applyOnlineTemplate();
    if (count > 0) toast(`Plantilla aplicada a ${plural(count, "asignatura", "asignaturas")}`, { tone: "gold" });
  };

  return (
    <Section id="ajustes-calendario" ref={ref} card number="02" eyebrow="Rumbo" title="Calendario">
      <div className="settings-fields">
        <div className="settings-field">
          <div className="settings-field-head">
            <span className="settings-field-label">
              <label htmlFor="settings-course-start">Inicio de curso</label>
              <FieldHelp label="Inicio de curso" content="Día en que empieza el curso online (por defecto 21-10-2026): el rumbo reparte los controles y simulacros desde aquí." />
            </span>
          </div>
          <input
            id="settings-course-start"
            className="settings-number num settings-number--sm"
            type="date"
            value={courseStart}
            onChange={(e) => setSettings({ courseStart: e.target.value || undefined })}
          />
        </div>

        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-field-label">
              <b>Plantilla online</b>
              <FieldHelp
                label="Plantilla online"
                content={`Evaluación continua (40 %) y examen final (60 %) para las asignaturas sin ninguna evaluación.${
                  missing.length > 0
                    ? ` Se aplicaría a ${missing.map((s) => s.shortName).join(", ").replace(/, ([^,]*)$/, " y $1")}.`
                    : " Ahora mismo todas tienen alguna."
                }`}
              />
            </span>
          </div>
          {missing.length > 0 && (
            <Button variant="ink" icon={<Icons.useTemplate size={15} />} onClick={onApplyTemplate}>
              Usar plantilla online
            </Button>
          )}
        </div>
      </div>

      <div className="settings-cal-table" role="table" aria-label="Parciales y finales por asignatura">
        <div className="settings-cal-row settings-cal-row--head" role="row">
          <span role="columnheader">Asignatura</span>
          <span role="columnheader">Parcial y final</span>
          <span role="columnheader" className="sr-only-focusable">Evaluación</span>
        </div>
        {currentSubjects.map((subject) => {
          const dated = subjectStateOf(state, subject.id).assessments.filter(
            (a) => a.date && (a.kind === "parcial" || a.kind === "final"),
          );
          return (
            <div className="settings-cal-row" role="row" key={subject.id}>
              <div className="settings-cal-subject">
                <SubjectDot subjectId={subject.id} />
                <span>{subject.shortName}</span>
              </div>
              {dated.length === 0 ? (
                <p className="tone-3 settings-cal-empty">Sin fecha todavía</p>
              ) : (
                <div className="settings-cal-assessments">
                  {dated.map((a) => (
                    <div className="settings-cal-assessment" key={a.id}>
                      <span className="mono-label">{a.kind === "final" ? "Final" : "Parcial"}</span>
                      <input
                        type="date"
                        className="settings-number num settings-number--sm"
                        aria-label={`Fecha de ${a.kind === "final" ? "examen final" : "parcial"} de ${subject.shortName}`}
                        value={a.date ?? ""}
                        onChange={(e) => upsertAssessment(subject.id, { ...a, date: e.target.value || undefined })}
                      />
                      <span className="tone-3 num">{num(a.weight)} %</span>
                      {a.template && (
                        <span className="settings-cal-badge mono-label is-gold" title="Fecha y peso de plantilla: al cambiarlos por los de la guía docente, deja de serlo">
                          plantilla
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <a className="settings-eval-link" href={href(`/asignatura/${subject.id}?tab=evaluacion`)}>
                Ver evaluación <Icons.open aria-hidden="true" />
              </a>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function SettingsScreen() {
  const settings = useUserState((s) => s.settings);
  const route = useRoute();
  const calendarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (route.query.get("sec") === "calendario") calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.get("sec")]);

  return (
    <Page as="main">
      <Section card number="01" eyebrow="Ajustes" title="Tu ritmo de estudio">
        <div className="settings-fields">
          <Slider
            label="Minutos diarios"
            hint="Presupuesto que reparte la cola de hoy entre repasos y conceptos nuevos."
            value={settings.dailyMinutes}
            min={30}
            max={360}
            step={15}
            format={minutes}
            onChange={(v) => setSettings({ dailyMinutes: v })}
          />
          <Slider
            label="Retención deseada"
            hint="Cuánto quieres recordar en el momento del repaso: más alto pide repasar antes."
            value={settings.desiredRetention}
            min={0.85}
            max={0.95}
            step={0.01}
            format={(v) => pct(v)}
            onChange={(v) => setSettings({ desiredRetention: Math.round(v * 100) / 100 })}
          />
          <div className="settings-field">
            <div className="settings-field-head">
              <span className="settings-field-label">
                <label htmlFor="settings-target">Nota objetivo</label>
                <FieldHelp label="Nota objetivo" content="La calculadora de evaluación te dice qué necesitas para llegar a esta nota." />
              </span>
            </div>
            <input
              id="settings-target"
              className="settings-number num"
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={settings.targetGrade}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setSettings({ targetGrade: Math.min(10, Math.max(0, v)) });
              }}
            />
          </div>
        </div>
      </Section>

      <CalendarSection ref={calendarRef} />

      <Section card number="03" eyebrow="Apariencia" title="Tema">
        <Segmented
          aria-label="Tema visual"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={(v) => setSettings({ theme: v })}
        />
      </Section>

      <Section card number="04" eyebrow="Tus datos" title="Copia de seguridad">
        <ExportImport />
      </Section>

      <Section card number="05" eyebrow="Sobre Atlas" title="Acerca de">
        <div className="settings-about">
          <span className="settings-about-item">
            Versión <b className="num">{pkg.version}</b>
          </span>
          <span className="settings-about-item">Atlas v2 · sistema visual «Observatorio»</span>
        </div>
      </Section>
    </Page>
  );
}
