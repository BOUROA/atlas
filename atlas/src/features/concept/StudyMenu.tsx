/** "Registrar estudio": Visto · Repasado (nota 1–4) · Ejercicios (nota 1–4). */
import { useEffect, useRef, useState } from "react";
import type { Grade } from "../../domain/types";
import { recordReview, recordSeen, undoLast } from "../../state/actions";
import { Button, cx, Icons, toast } from "../../ui";

const GRADE_LABEL: Record<Grade, string> = { 1: "Otra vez", 2: "Difícil", 3: "Bien", 4: "Fácil" };

export function StudyMenu({ conceptId, conceptName }: { conceptId: string; conceptName: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const undoToast = (message: string) => toast(message, { action: { label: "Deshacer", onClick: undoLast } });

  const seen = () => {
    recordSeen([conceptId], "concept");
    setOpen(false);
    undoToast(`Visto: ${conceptName}`);
  };
  const review = (grade: Grade, exercise: boolean) => {
    recordReview({ conceptId, grade, attempted: true, questionKind: exercise ? "exercise" : "recall", source: "concept" });
    setOpen(false);
    undoToast(`Registrado (${exercise ? "ejercicio" : "repaso"}): ${GRADE_LABEL[grade]}`);
  };

  return (
    <div className="concept-studymenu" ref={rootRef}>
      <Button variant="ink" icon={<Icons.logStudy size={15} />} iconEnd={<Icons.more size={14} className={cx("concept-studymenu-chevron", open && "is-open")} />} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        Registrar estudio
      </Button>
      {open && (
        <div className="concept-studymenu-pop" role="menu" aria-label="Registrar estudio">
          <button type="button" role="menuitem" className="concept-studymenu-row concept-studymenu-row--main" onClick={seen}>
            <Icons.seen size={15} aria-hidden="true" /> Visto
          </button>
          <div className="concept-studymenu-group">
            <p className="concept-studymenu-group-title">
              <Icons.logStudy size={13} aria-hidden="true" /> Repasado
            </p>
            <div className="concept-studymenu-grades">
              {([1, 2, 3, 4] as const).map((g) => (
                <button key={g} type="button" role="menuitem" className="concept-studymenu-grade" onClick={() => review(g, false)}>
                  {GRADE_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
          <div className="concept-studymenu-group">
            <p className="concept-studymenu-group-title">
              <Icons.exercises size={13} aria-hidden="true" /> Ejercicios
            </p>
            <div className="concept-studymenu-grades">
              {([1, 2, 3, 4] as const).map((g) => (
                <button key={g} type="button" role="menuitem" className="concept-studymenu-grade" onClick={() => review(g, true)}>
                  {GRADE_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
