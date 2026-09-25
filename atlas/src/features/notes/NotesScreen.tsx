/**
 * Lector de apuntes (#/apuntes/:id) · docs/apuntes-guia.md.
 *
 * export function NotesScreen(props: { unitId: string }): JSX.Element
 *
 * Consultas opcionales: ?s=<slug> hace scroll a esa sección al cargar;
 * ?concepto=<conceptId> hace scroll a la sección de ese concepto
 * (findConceptSection). No confundir con ?c=, que abre la ficha de concepto
 * sobre cualquier ruta.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Printer } from "lucide-react";
import type { CatalogUnit } from "../../domain/types";
import { catalog, trials } from "../../state/catalog";
import { hasNotes, loadNotes } from "../../state/notes";
import { href, setQuery, useRoute } from "../../state/router";
import { Button, cx, EmptyState, ICON_SIZE, Icons, Md, Page, plural, SubjectDot } from "../../ui";
import { TrialMd } from "../trial/TrialMd";
import { findConceptSection, readingMinutes, splitNotes, wordCount, type NoteSection } from "./sections";

const CALLOUT_CLASS: Record<string, string> = {
  "idea clave": "is-idea",
  "error típico": "is-error",
  "truco de examen": "is-truco",
  ojo: "is-ojo",
};

/** Añade una clase a las citas-llamada («> **Idea clave.** …») según su rótulo, sin tocar Md.tsx. */
function markCallouts(root: HTMLElement | null): void {
  if (!root) return;
  for (const bq of root.querySelectorAll("blockquote")) {
    const label = bq.querySelector("strong")?.textContent?.trim().toLowerCase().replace(/[.:]+$/, "") ?? "";
    const cls = CALLOUT_CLASS[label];
    if (cls) bq.classList.add("notes-callout", cls);
  }
}

const sectionElId = (slug: string) => `apuntes-${slug}`;

/** Prueba de tipo "control" cuyos temas incluyen `unitId`. */
const controlOf = (unitId: string) => trials.find((t) => t.kind === "control" && t.unitIds.includes(unitId));
/** Primer simulacro (parcial o final) que cubre `unitId`, si hay. */
const coveringSimOf = (unitId: string) => trials.find((t) => t.kind !== "control" && t.unitIds.includes(unitId));

/** Tema más cercano (delante o detrás) de la misma asignatura que también tenga apuntes. */
function adjacentNotesUnit(subjectId: string, unitNumber: number, dir: 1 | -1): CatalogUnit | undefined {
  const units = catalog.unitsBySubject.get(subjectId) ?? [];
  const candidates = dir === 1 ? units.filter((u) => u.number > unitNumber) : [...units].filter((u) => u.number < unitNumber).reverse();
  return candidates.find((u) => hasNotes(u.id));
}

export function NotesScreen({ unitId }: { unitId: string }) {
  const route = useRoute();
  const unit = catalog.unitById.get(unitId);
  const subject = unit ? catalog.subjectById.get(unit.subjectId) : undefined;
  const available = hasNotes(unitId);

  const [md, setMd] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  useEffect(() => {
    setMd(null);
    setFailed(false);
    scrolledFor.current = null;
    if (!available) return undefined;
    let alive = true;
    loadNotes(unitId)
      .then((text) => alive && setMd(text))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [unitId, available]);

  const doc = useMemo(() => (md != null ? splitNotes(md) : null), [md]);
  const words = useMemo(() => (md != null ? wordCount(md) : 0), [md]);

  useEffect(() => markCallouts(bodyRef.current), [doc]);

  // Salta a ?s= o, si no, a la sección del ?concepto=: al cargar el tema y cada
  // vez que llega un enlace nuevo con otro valor (p. ej. desde otra ficha de
  // concepto sin cambiar de tema). Una combinación (tema, s, concepto) solo
  // dispara el salto una vez: goToSection ya marca la suya como hecha.
  const s = route.query.get("s");
  const conceptoId = route.query.get("concepto");
  useEffect(() => {
    const key = `${unitId}|${s ?? ""}|${conceptoId ?? ""}`;
    if (!doc || scrolledFor.current === key) return;
    scrolledFor.current = key;
    const target: NoteSection | null =
      (s && doc.sections.find((sec) => sec.id === s)) ||
      (conceptoId ? findConceptSection(doc.sections, catalog.conceptById.get(conceptoId) ?? { name: "" }) : null);
    if (target) {
      document.getElementById(sectionElId(target.id))?.scrollIntoView({ block: "start" });
      setActiveId(target.id);
    }
  }, [doc, unitId, s, conceptoId]);

  // Sección visible: resalta la más arriba entre las que se ven.
  useEffect(() => {
    if (!doc || doc.sections.length === 0) return undefined;
    const els = doc.sections.map((s) => document.getElementById(sectionElId(s.id))).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id.slice(sectionElId("").length));
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0, 1] },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [doc]);

  const goToSection = (id: string) => {
    document.getElementById(sectionElId(id))?.scrollIntoView({ block: "start", behavior: "smooth" });
    setActiveId(id);
    scrolledFor.current = `${unitId}|${id}|`; // ya hecho: que el efecto de arriba no repita el salto sin animación
    setQuery({ s: id });
  };

  if (!unit || !subject) {
    return (
      <Page as="main">
        <EmptyState title="Tema desconocido" description={`No hay ningún tema con el identificador «${unitId}».`} />
      </Page>
    );
  }

  if (!available) {
    return (
      <Page as="main" className="notes-page">
        <EmptyState
          title="Aún no hay apuntes de este tema"
          description="Se van añadiendo por temas: vuelve más adelante."
          action={
            <Button variant="ghost" href={href(`/asignatura/${subject.id}`)}>
              Volver a {subject.shortName}
            </Button>
          }
        />
      </Page>
    );
  }

  if (failed) {
    return (
      <Page as="main" className="notes-page">
        <EmptyState title="No se han podido cargar los apuntes" description="Prueba a recargar la página." />
      </Page>
    );
  }

  if (!doc) {
    return (
      <Page as="main" className="notes-page">
        <div className="notes-loading" role="status" aria-busy="true" aria-label="Cargando apuntes" />
      </Page>
    );
  }

  const h1 = doc.title.replace(/^Tema\s+\d+\s*·\s*/, "").trim() || unit.title;
  const control = controlOf(unitId);
  const sim = coveringSimOf(unitId);
  const prev = adjacentNotesUnit(subject.id, unit.number, -1);
  const next = adjacentNotesUnit(subject.id, unit.number, 1);
  const hasIndex = doc.sections.length > 1;

  return (
    <Page as="main" className="notes-page">
      <p className="mono-label notes-crumb">
        <a className="notes-crumb-link" href={href(`/asignatura/${subject.id}`)}>
          <SubjectDot subjectId={subject.id} size={8} /> {subject.shortName}
        </a>
        <span className="notes-crumb-sep">·</span>
        <span>Tema {unit.number}</span>
      </p>

      <header className="notes-head">
        <div className="notes-head-top">
          <h1>{h1}</h1>
          <Button variant="ghost" size="sm" icon={<Printer aria-hidden="true" size={15} />} className="notes-head-actions" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
        <div className="notes-head-meta">
          <span className="notes-chip">
            <Icons.duration aria-hidden="true" {...ICON_SIZE.row} /> {readingMinutes(words)} min de lectura
          </span>
          <span className="notes-chip">
            <Icons.notes aria-hidden="true" {...ICON_SIZE.row} /> {plural(doc.sections.length, "sección", "secciones")}
          </span>
        </div>
      </header>

      {hasIndex && (
        <details className="notes-index-mobile">
          <summary>
            <Icons.open aria-hidden="true" {...ICON_SIZE.row} /> Índice
          </summary>
          <ul>
            {doc.sections.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => goToSection(s.id)}>
                  <Md inline>{s.title}</Md>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="notes-layout">
        <div className="notes-main" ref={bodyRef}>
          {doc.intro && <TrialMd className="notes-intro">{doc.intro}</TrialMd>}
          {doc.sections.map((s) => {
            const isCheat = s.title.trim().toLowerCase() === "chuleta";
            return (
              <section key={s.id} id={sectionElId(s.id)} className={cx("notes-section", isCheat && "notes-section--cheat")}>
                <h2><Md inline>{s.title}</Md></h2>
                <TrialMd>{s.body}</TrialMd>
              </section>
            );
          })}
        </div>

        {hasIndex && (
          <nav className="notes-index" aria-label="Índice del tema">
            <p className="mono-label notes-index-title">Índice</p>
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <button type="button" className={cx("notes-index-link", activeId === s.id && "is-active")} onClick={() => goToSection(s.id)}>
                    <Md inline>{s.title}</Md>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>

      <footer className="notes-footer">
        <div className="notes-footer-cta">
          {control && (
            <Button variant="primary" icon={<Icons.control aria-hidden="true" />} href={href(`/prueba/${control.id}`)}>
              Ponte a prueba
            </Button>
          )}
          {sim && (
            <a className="notes-footer-sim" href={href(`/prueba/${sim.id}`)}>
              <Icons.simulacro aria-hidden="true" {...ICON_SIZE.row} /> {sim.title}
            </a>
          )}
        </div>
        {(prev || next) && (
          <div className="notes-footer-nav">
            {prev && (
              <a className="notes-footer-navlink notes-footer-navlink--prev" href={href(`/apuntes/${prev.id}`)}>
                <Icons.open aria-hidden="true" {...ICON_SIZE.row} /> Tema {prev.number} · {prev.title}
              </a>
            )}
            {next && (
              <a className="notes-footer-navlink notes-footer-navlink--next" href={href(`/apuntes/${next.id}`)}>
                Tema {next.number} · {next.title} <Icons.open aria-hidden="true" {...ICON_SIZE.row} />
              </a>
            )}
          </div>
        )}
      </footer>
    </Page>
  );
}
