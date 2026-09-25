// Pestaña "Evaluación": calculadora de notas (gradeSummary) sobre una tabla
// editable de evaluaciones.
import { Plus, Trash2 } from "lucide-react";
import { catalog } from "../../state/catalog";
import { useUserState } from "../../state/store";
import { removeAssessment, setSettings, upsertAssessment } from "../../state/actions";
import { subjectStateOf, type Assessment, type AssessmentKind } from "../../domain/types";
import { gradeSummary } from "../../domain/grades";
import { Button, EmptyState, IconButton, num, pct } from "../../ui";
import { assessmentKindLabel, gradeNum, targetNum } from "./helpers";

const KINDS: AssessmentKind[] = ["parcial", "final", "entrega", "practica", "otro"];

export function Evaluation({ subjectId }: { subjectId: string }) {
  const state = useUserState((s) => s);
  const sub = subjectStateOf(state, subjectId);
  const units = catalog.unitsBySubject.get(subjectId) ?? [];
  const target = state.settings.targetGrade;
  const summary = gradeSummary(sub.assessments, target);
  const totalWeight = summary.gradedWeight + summary.remainingWeight;

  const patch = (a: Assessment, next: Partial<Assessment>) => upsertAssessment(subjectId, { ...a, ...next });

  return (
    <div className="subjects-eval">
      <div className="subjects-eval-target">
        <label htmlFor="eval-target">Objetivo</label>
        <input
          id="eval-target"
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={target}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) setSettings({ targetGrade: Math.min(10, Math.max(0, v)) });
          }}
          className="subjects-input subjects-input--sm num"
          aria-describedby="eval-target-hint"
        />
        <span id="eval-target-hint" className="tone-3">
          nota objetivo, la misma para todas las asignaturas (ajustes)
        </span>
      </div>

      {sub.assessments.length === 0 ? (
        <EmptyState
          size="sm"
          tone="dashed"
          title="Aún no has añadido evaluaciones"
          description="Añade parciales, entregas o el examen final para calcular tu nota."
          action={
            <Button variant="ghost" icon={<Plus />} onClick={() => upsertAssessment(subjectId, { title: "", kind: "otro", weight: 0, unitIds: [] })}>
              Añadir evaluación
            </Button>
          }
        />
      ) : (
        <>
          <div className="subjects-eval-table" role="table" aria-label="Evaluaciones">
            <div className="subjects-eval-row subjects-eval-row--head" role="row">
              <span role="columnheader">Título</span>
              <span role="columnheader">Tipo</span>
              <span role="columnheader">Fecha</span>
              <span role="columnheader">Peso %</span>
              <span role="columnheader">Nota</span>
              <span role="columnheader">Temas incluidos</span>
              <span role="columnheader" className="sr-only-focusable">Borrar</span>
            </div>
            {sub.assessments.map((a) => (
              <div className="subjects-eval-row" role="row" key={a.id}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <input
                    className="subjects-input"
                    aria-label="Título de la evaluación"
                    value={a.title}
                    placeholder="Sin título"
                    onChange={(e) => patch(a, { title: e.target.value })}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {a.template && (
                    <span className="mono-label is-gold subjects-eval-badge" title="Fecha y peso de plantilla: al cambiarlos por los de la guía docente, deja de serlo">
                      plantilla
                    </span>
                  )}
                </span>
                <select className="subjects-input" aria-label="Tipo" value={a.kind} onChange={(e) => patch(a, { kind: e.target.value as AssessmentKind })}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {assessmentKindLabel(k)}
                    </option>
                  ))}
                </select>
                <input
                  className="subjects-input num"
                  type="date"
                  aria-label="Fecha"
                  value={a.date ?? ""}
                  onChange={(e) => patch(a, { date: e.target.value || undefined })}
                />
                <input
                  className="subjects-input subjects-input--sm num"
                  type="number"
                  aria-label="Peso, en porcentaje"
                  min={0}
                  max={100}
                  value={a.weight}
                  onChange={(e) => patch(a, { weight: Number(e.target.value) || 0 })}
                />
                <input
                  className="subjects-input subjects-input--sm num"
                  type="number"
                  aria-label="Nota, sobre 10"
                  min={0}
                  max={10}
                  step={0.1}
                  value={a.grade ?? ""}
                  placeholder="—"
                  onChange={(e) => patch(a, { grade: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
                <select
                  className="subjects-input subjects-input--units"
                  aria-label="Temas incluidos (vacío: todo el temario)"
                  multiple
                  size={Math.min(4, Math.max(2, units.length))}
                  value={a.unitIds}
                  onChange={(e) => patch(a, { unitIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.number === 0 ? "Intro" : `Tema ${u.number}`} · {u.title}
                    </option>
                  ))}
                </select>
                <IconButton aria-label={`Borrar «${a.title || "evaluación sin título"}»`} icon={<Trash2 />} onClick={() => removeAssessment(subjectId, a.id)} />
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => upsertAssessment(subjectId, { title: "", kind: "otro", weight: 0, unitIds: [] })}>
            Añadir evaluación
          </Button>

          <div className="subjects-eval-summary">
            {summary.weightWarning && (
              <p className="subjects-eval-line subjects-eval-line--warn">
                Los pesos suman {num(totalWeight)} % (no 100 %): la calculadora usa lo que hay, revisa los pesos.
              </p>
            )}
            {summary.currentAverage != null && (
              <p className="subjects-eval-line">
                Nota actual: <b className="num">{gradeNum(summary.currentAverage)}</b> sobre el {pct(summary.gradedWeight / 100)} evaluado.
              </p>
            )}
            {summary.status === "done" ? (
              <p className="subjects-eval-line subjects-eval-line--final">
                Nota final: <b className="num">{gradeNum(summary.final!)}</b>.
              </p>
            ) : (
              <>
                <p className="subjects-eval-line">
                  Máximo alcanzable: <b className="num">{gradeNum(summary.maxPossible)}</b>.
                </p>
                {summary.status === "secured" && (
                  <p className="subjects-eval-line subjects-eval-line--secured">Objetivo asegurado: el {targetNum(target)} ya no depende de lo que queda.</p>
                )}
                {summary.status === "possible" && (
                  <p className="subjects-eval-line">
                    Para un {targetNum(target)} necesitas <b className="num">{gradeNum(summary.needed!)}</b> de media en lo que queda.
                  </p>
                )}
                {summary.status === "impossible" && (
                  <p className="subjects-eval-line subjects-eval-line--impossible">
                    {target === 10 ? "El 10 ya no es posible." : `El ${targetNum(target)} ya no es posible.`}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
