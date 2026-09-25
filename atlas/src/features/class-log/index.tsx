/**
 * «Hoy en clase he visto…» (atajo N) · Task 9. Filtro por asignatura, temas
 * de la asignatura elegida con sus conceptos, buscador para añadir cualquier
 * concepto y registro en lote con recordSeen(ids, "class").
 */
import { useEffect, useMemo, useState } from "react";
import { searchConcepts } from "../../domain/search";
import { catalog, currentSubjects } from "../../state/catalog";
import { recordSeen, setCurrentUnit, undoLast } from "../../state/actions";
import { useUserState } from "../../state/store";
import { Button, Dialog, Icons, Segmented, plural, pluralWord, toast } from "../../ui";
import "./classlog.css";

export function ClassLogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const subjectsState = useUserState((s) => s.subjects);
  const [subjectId, setSubjectId] = useState<string>(currentSubjects[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [advance, setAdvance] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSubjectId(currentSubjects[0]?.id ?? "");
      setSelected(new Set());
      setAdvance(new Set());
      setQuery("");
    }
  }, [open]);

  const currentUnitOf = (sid: string) => subjectsState[sid]?.currentUnit ?? 1;

  const units = useMemo(() => catalog.unitsBySubject.get(subjectId) ?? [], [subjectId]);
  const maxCheckedUnit = useMemo(() => {
    let max: number | null = null;
    for (const u of units) {
      if (u.number <= currentUnitOf(subjectId)) continue;
      const some = (catalog.conceptsByUnit.get(u.id) ?? []).some((c) => selected.has(c.id));
      if (some && (max === null || u.number > max)) max = u.number;
    }
    return max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, selected, subjectId]);

  const searchResults = useMemo(() => (query.trim() ? searchConcepts(catalog, query, 8) : []), [query]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const subjectOptions = currentSubjects.map((s) => {
    const count = catalog.conceptsOfSubject(s.id).filter((c) => selected.has(c.id)).length;
    return { value: s.id, label: s.shortName, count: count > 0 ? count : undefined };
  });

  const submit = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    recordSeen(ids, "class");
    for (const sid of advance) {
      const unitsOfSubject = catalog.unitsBySubject.get(sid) ?? [];
      let target: number | null = null;
      for (const u of unitsOfSubject) {
        if (u.number <= currentUnitOf(sid)) continue;
        const some = (catalog.conceptsByUnit.get(u.id) ?? []).some((c) => selected.has(c.id));
        if (some && (target === null || u.number > target)) target = u.number;
      }
      if (target !== null) setCurrentUnit(sid, target);
    }
    toast(`${plural(ids.length, "concepto entra", "conceptos entran")} en tu plan de mañana`, {
      tone: "gold",
      action: { label: "Deshacer", onClick: undoLast },
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow="Registro rápido"
      title="Hoy en clase he visto…"
      description="Marca lo que habéis dado en clase para que entre en tu cola con el motivo «lo viste en clase»."
      footer={
        <div className="classlog-foot">
          <span className="classlog-count">
            <b className="num">{selected.size}</b> {pluralWord(selected.size, "seleccionado", "seleccionados")}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={submit} disabled={selected.size === 0} data-autofocus>
              Registrar {plural(selected.size, "concepto", "conceptos")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="classlog-body">
        <label className="classlog-search">
          <Icons.search aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar cualquier concepto para añadirlo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar concepto"
          />
        </label>
        {query.trim() && (
          <div className="classlog-search-results">
            {searchResults.length === 0 ? (
              <p className="classlog-search-empty">Sin resultados para «{query}».</p>
            ) : (
              searchResults.map((id) => {
                const c = catalog.conceptById.get(id);
                if (!c) return null;
                return (
                  <label key={id} className="classlog-check">
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                    <b>{c.name}</b>
                    <span className="classlog-check-note">{catalog.subjectById.get(c.subjectId)?.shortName}</span>
                  </label>
                );
              })
            )}
          </div>
        )}

        <div className="classlog-subjects">
          <Segmented aria-label="Asignatura" variant="chips" size="sm" options={subjectOptions} value={subjectId} onChange={setSubjectId} />
        </div>

        <div className="classlog-units">
          {units.map((u) => {
            const concepts = catalog.conceptsByUnit.get(u.id) ?? [];
            const isCurrent = u.number === currentUnitOf(subjectId);
            const checkedHere = concepts.filter((c) => selected.has(c.id)).length;
            return (
              <details key={u.id} className="classlog-unit" open={isCurrent}>
                <summary className="classlog-unit-summary">
                  <span className="classlog-unit-title">
                    <Icons.open size={14} aria-hidden="true" />
                    Tema {u.number} · {u.title}
                  </span>
                  <span className="classlog-unit-badge">
                    {isCurrent && <span className="classlog-unit-current">VOY POR AQUÍ · </span>}
                    {checkedHere > 0 ? `${checkedHere} marcados` : `${concepts.length} conceptos`}
                  </span>
                </summary>
                <div className="classlog-concepts">
                  {concepts.map((c) => (
                    <label key={c.id} className="classlog-check">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                      <b>{c.name}</b>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>

        {maxCheckedUnit !== null && (
          <label className="classlog-advance">
            <input
              type="checkbox"
              checked={advance.has(subjectId)}
              onChange={() =>
                setAdvance((a) => {
                  const next = new Set(a);
                  if (next.has(subjectId)) next.delete(subjectId);
                  else next.add(subjectId);
                  return next;
                })
              }
            />
            Avanzar «voy por» a Tema {maxCheckedUnit} en {catalog.subjectById.get(subjectId)?.shortName}
          </label>
        )}
      </div>
    </Dialog>
  );
}
