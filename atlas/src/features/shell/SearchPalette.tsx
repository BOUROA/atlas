// Buscador Ctrl K / «/»: conceptos del catálogo (searchConcepts) y acciones rápidas.
// Intro abre la ficha; Ctrl+Intro practica el concepto en una sesión.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Command } from "cmdk";
import { normalize, searchConcepts } from "../../domain/search";
import { catalog, currentSubjects } from "../../state/catalog";
import { progressOf, useDerived } from "../../state/derived";
import { navigate, openConcept } from "../../state/router";
import { useUserState } from "../../state/store";
import { closeSearch, openClassLog, useUi } from "../../state/ui";
import { Freshness, Icons, Kbd, LevelBars, SubjectTag } from "../../ui";
import { cycleTheme, THEME_NAMES } from "./ThemeToggle";

type Action = { id: string; label: string; hint?: string; icon: ReactNode; keywords?: string; run: () => void };

export function SearchPalette() {
  const { searchOpen } = useUi();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const theme = useUserState((s) => s.settings.theme);
  const { progress } = useDerived();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (searchOpen && !el.open) {
      el.showModal();
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!searchOpen && el.open) el.close();
  }, [searchOpen]);

  const actions: Action[] = useMemo(
    () => [
      { id: "sesion", label: "Empezar sesión", hint: "S", icon: <Icons.session />, keywords: "estudiar repasar cola", run: () => navigate("/sesion") },
      { id: "clase", label: "Registrar lo visto en clase", hint: "N", icon: <Icons.logClass />, keywords: "hoy en clase he visto registrar", run: openClassLog },
      { id: "mapa", label: "Abrir la carta celeste", icon: <Icons.map />, keywords: "mapa estrellas", run: () => navigate("/mapa") },
      { id: "asignaturas", label: "Ver asignaturas", icon: <Icons.subject />, keywords: "constelaciones", run: () => navigate("/asignaturas") },
      { id: "misiones", label: "Ver misiones y estrellas guía", icon: <Icons.mission />, keywords: "examenes leyendas perfiles", run: () => navigate("/misiones") },
      { id: "progreso", label: "Ver progreso e insignias", icon: <Icons.progress />, keywords: "nivel logros racha", run: () => navigate("/progreso") },
      { id: "tema", label: `Cambiar tema (ahora: ${THEME_NAMES[theme]})`, icon: <Icons.theme />, keywords: "oscuro claro observatorio carta impresa", run: () => cycleTheme(theme) },
      { id: "ajustes", label: "Ajustes", icon: <Icons.settings />, keywords: "exportar importar copia minutos retencion", run: () => navigate("/ajustes") },
      ...currentSubjects.map((s) => ({
        id: `asig-${s.id}`,
        label: `Ir a ${s.shortName}`,
        icon: <SubjectTag subjectId={s.id} size="sm" />,
        keywords: s.name,
        run: () => navigate(`/asignatura/${s.id}`),
      })),
    ],
    [theme],
  );

  const q = normalize(query);
  const conceptIds = useMemo(() => (q ? searchConcepts(catalog, query, 20) : []), [q, query]);
  const shownActions = q ? actions.filter((a) => normalize(`${a.label} ${a.keywords ?? ""}`).includes(q)) : actions;

  const run = (fn: () => void) => {
    closeSearch();
    fn();
  };
  const practice = (id: string) => run(() => navigate(`/sesion?ids=${encodeURIComponent(id)}`));

  return (
    <dialog
      ref={ref}
      className="shell-palette"
      aria-label="Buscar"
      onCancel={(e) => {
        e.preventDefault();
        closeSearch();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSearch();
      }}
    >
      {searchOpen && (
        <Command
          label="Buscar conceptos y acciones"
          shouldFilter={false}
          loop
          value={value}
          onValueChange={setValue}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && value.startsWith("c:")) {
              e.preventDefault();
              practice(value.slice(2));
            }
          }}
        >
          <div className="shell-palette-input">
            <Icons.search aria-hidden="true" />
            <Command.Input ref={inputRef} value={query} onValueChange={setQuery} placeholder="Busca un concepto, una asignatura o una acción…" />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="shell-palette-list">
            <Command.Empty className="shell-palette-empty">Ningún concepto ni acción coincide con «{query}».</Command.Empty>
            {conceptIds.length > 0 && (
              <Command.Group heading="Conceptos">
                {conceptIds.map((id) => {
                  const c = catalog.conceptById.get(id)!;
                  const unit = catalog.unitById.get(c.unitId);
                  const p = progressOf(progress, id);
                  return (
                    <Command.Item key={id} value={`c:${id}`} onSelect={() => run(() => openConcept(id))} className="shell-palette-item">
                      <SubjectTag subjectId={c.subjectId} size="sm" />
                      <span className="shell-palette-main">
                        <b>{c.name}</b>
                        <small>{unit ? `Tema ${unit.number} · ${unit.title}` : ""}</small>
                      </span>
                      <span className="shell-palette-state">
                        <LevelBars level={p.level} size="sm" />
                        <Freshness r={p.retrievability} size="sm" />
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
            {shownActions.length > 0 && (
              <Command.Group heading={q ? "Acciones" : "Acciones rápidas"}>
                {shownActions.map((a) => (
                  <Command.Item key={a.id} value={`a:${a.id}`} onSelect={() => run(a.run)} className="shell-palette-item">
                    <span className="shell-palette-icon" aria-hidden="true">
                      {a.icon}
                    </span>
                    <span className="shell-palette-main">
                      <b>{a.label}</b>
                    </span>
                    {a.hint && <Kbd>{a.hint}</Kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <div className="shell-palette-foot" aria-hidden="true">
            <span>
              <Kbd>↵</Kbd> abrir ficha
            </span>
            <span>
              <Kbd keys={["Ctrl", "↵"]} /> practicar
            </span>
            <span className="num">{catalog.catalog.concepts.length} conceptos</span>
          </div>
        </Command>
      )}
    </dialog>
  );
}
