/**
 * Mis apuntes: texto libre (guardado automático, debounce 600 ms) y enlaces
 * (obsidian://, vscode://, file:///, https://). Se usa en la ficha completa
 * (variant="full") y, en modo solo lectura + añadir, dentro de la sesión
 * (variant="links").
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookMarked, Code2, FileText, Link2, Plus, X } from "lucide-react";
import type { NoteLink } from "../../domain/types";
import { setNote } from "../../state/actions";
import { useUserState } from "../../state/store";
import { Button, EmptyState, Icons, IconButton, plural } from "../../ui";

const SAVE_DEBOUNCE_MS = 600;

const SCHEME_ICON: { test: RegExp; icon: typeof Link2; label: string }[] = [
  { test: /^obsidian:/i, icon: BookMarked, label: "Obsidian" },
  { test: /^vscode:/i, icon: Code2, label: "VS Code" },
  { test: /^file:/i, icon: FileText, label: "Fichero local" },
  { test: /^https?:/i, icon: Icons.external, label: "Web" },
];
const ALLOWED = /^(obsidian:|vscode:|file:\/\/\/|https?:\/\/)/i;

function schemeOf(url: string) {
  return SCHEME_ICON.find((s) => s.test.test(url)) ?? { icon: Link2, label: "Enlace" };
}

function LinkRow({ link, onRemove }: { link: NoteLink; onRemove: () => void }) {
  const { icon: Icon, label } = schemeOf(link.url);
  return (
    <li className="concept-note-link">
      <a href={link.url} target={/^https?:/i.test(link.url) ? "_blank" : undefined} rel="noopener noreferrer" title={link.url}>
        <Icon aria-hidden="true" />
        <span>{link.label || label}</span>
      </a>
      <IconButton aria-label={`Quitar el enlace ${link.label || label}`} icon={<X size={13} />} size="sm" onClick={onRemove} />
    </li>
  );
}

function AddLinkForm({ onAdd }: { onAdd: (link: NoteLink) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="quiet" size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
        Añadir enlace
      </Button>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!ALLOWED.test(trimmed)) {
      setError("Solo obsidian://, vscode://, file:/// o https://");
      return;
    }
    onAdd({ label: label.trim() || trimmed, url: trimmed });
    setLabel("");
    setUrl("");
    setError(null);
    setOpen(false);
  };

  return (
    <form className="concept-note-addlink" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setOpen(false))}>
      <input
        className="concept-note-input"
        placeholder="Etiqueta (opcional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="Etiqueta del enlace"
      />
      <input
        className="concept-note-input"
        placeholder="obsidian://… · vscode://… · https://…"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
        }}
        aria-label="Dirección del enlace"
        data-autofocus
      />
      {error && <p className="concept-note-error">{error}</p>}
      <div className="concept-note-addlink-actions">
        <Button type="submit" variant="ink" size="sm">
          Guardar enlace
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function Notes({ conceptId, variant = "full" }: { conceptId: string; variant?: "full" | "links" }) {
  const note = useUserState((s) => s.notes[conceptId]);
  const [text, setText] = useState(note?.text ?? "");
  const linksRef = useRef<NoteLink[]>(note?.links ?? []);
  const [links, setLinks] = useState<NoteLink[]>(note?.links ?? []);
  linksRef.current = links;

  // Al cambiar de concepto, recarga el texto y los enlaces locales.
  useEffect(() => {
    setText(note?.text ?? "");
    setLinks(note?.links ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  // Guardado automático del texto (debounce 600 ms).
  useEffect(() => {
    if (variant !== "full") return;
    const t = setTimeout(() => {
      if (text !== (note?.text ?? "")) setNote(conceptId, { text, links: linksRef.current });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, conceptId]);

  const addLink = (link: NoteLink) => {
    const next = [...links, link];
    setLinks(next);
    setNote(conceptId, { text, links: next });
  };
  const removeLink = (i: number) => {
    const next = links.filter((_, idx) => idx !== i);
    setLinks(next);
    setNote(conceptId, { text, links: next });
  };

  return (
    <div className="concept-notes">
      {variant === "full" && (
        <textarea
          className="concept-note-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Referencia a tus apuntes de papel, ideas propias, dudas…"
          aria-label="Mis apuntes"
          rows={4}
        />
      )}
      {links.length > 0 ? (
        <ul className="concept-note-links">
          {links.map((l, i) => (
            <LinkRow key={`${l.url}~${i}`} link={l} onRemove={() => removeLink(i)} />
          ))}
        </ul>
      ) : (
        variant === "full" && <p className="concept-note-empty">{plural(0, "enlace", "enlaces")} todavía.</p>
      )}
      <AddLinkForm onAdd={addLink} />
    </div>
  );
}

export function NotesEmpty() {
  return <EmptyState size="sm" tone="dashed" title="Sin apuntes todavía" description="Enlaza tu material: Obsidian, VS Code, un PDF o una página." />;
}
