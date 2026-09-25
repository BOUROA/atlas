import { useMemo } from "react";
import katex from "katex";
import { cx } from "./cx";

// Markdown ligero para las fichas: párrafos, **negrita**, *cursiva*, listas,
// `código`, bloques ``` con lenguaje, enlaces, títulos ### y matemáticas
// $…$ / $$…$$ (KaTeX). Todo el texto se escapa ANTES de sustituir marcas; el
// único HTML que se inserta sin escapar es el que genera KaTeX (que escapa su
// propia entrada) y las etiquetas fijas de este módulo.

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function tex(src: string, displayMode: boolean): string {
  return katex.renderToString(src, { throwOnError: false, displayMode, output: "htmlAndMathml", strict: "ignore" });
}

const SAFE_URL = /^(https?:|mailto:|obsidian:|vscode:|file:|#|\/)/i;

/** Marcas en línea sobre una línea de texto plano. */
function inline(src: string): string {
  const slots: string[] = [];
  const hold = (html: string) => `${slots.push(html) - 1}`;

  let s = src
    // código en línea (su contenido es literal: sin escapes ni fórmulas)
    .replace(/`([^`\n]+)`/g, (_, code: string) => hold(`<code>${escapeHtml(code)}</code>`))
    // dólar literal
    .replace(/\\\$/g, () => hold("$"))
    // matemáticas en línea: \( … \) y $…$ (sin espacio junto a los dólares ni cifra detrás: no confunde "5 $ y 10 $")
    .replace(/\\\((.+?)\\\)/g, (_, m: string) => hold(tex(m, false)))
    .replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, m: string) => hold(tex(m, false)))
    // resto de escapes de Markdown
    .replace(/\\([\\`*_[\]#+\-.!])/g, (_, ch: string) => hold(escapeHtml(ch)));

  s = escapeHtml(s)
    // enlaces [texto](url) con esquemas permitidos
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, text: string, url: string) => {
      const raw = url.replace(/&amp;/g, "&");
      if (!SAFE_URL.test(raw)) return whole;
      const external = /^https?:/i.test(raw);
      return `<a href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
    })
    .replace(/\*\*(?=\S)([^*]+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)([^_]+?)(?<=\S)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w_])/g, "$1<em>$2</em>");

  // los huecos pueden contener otros huecos (p. ej. \$ dentro de `código`)
  for (let guard = 0; guard < 4 && s.includes(""); guard++) {
    s = s.replace(/(\d+)/g, (_, i: string) => slots[Number(i)] ?? "");
  }
  return s;
}

type ListBlock = { ordered: boolean; items: string[] };

/** Convierte Markdown ligero en HTML seguro. */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: ListBlock | null = null;
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul";
      out.push(`<${tag}>${list.items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // bloque de código
    const fence = /^```\s*([\w+#.-]*)\s*$/.exec(trimmed);
    if (fence) {
      flushAll();
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "```") body.push(lines[i++]);
      out.push(
        `<pre class="md-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ""}>${lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : ""}<code>${escapeHtml(body.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // matemáticas en bloque: $$ … $$ (en una o varias líneas)
    if (trimmed.startsWith("$$")) {
      flushAll();
      let body = trimmed.slice(2);
      if (body.trimEnd().endsWith("$$") && body.trim().length > 0) {
        body = body.trimEnd().slice(0, -2);
      } else {
        const acc = [body];
        i++;
        while (i < lines.length && !lines[i].includes("$$")) acc.push(lines[i++]);
        if (i < lines.length) acc.push(lines[i].slice(0, lines[i].indexOf("$$")));
        body = acc.join("\n");
      }
      out.push(`<div class="md-math">${tex(body.trim(), true)}</div>`);
      continue;
    }

    if (trimmed === "") {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = Math.min(4, heading[1].length + 2); // # → h3, ## → h4 (dentro de una ficha)
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushPara();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    flushQuote();

    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const ordered = /\d/.test(item[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item[2]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    flushList();

    if (trimmed === "---" || trimmed === "***") {
      flushPara();
      out.push("<hr/>");
      continue;
    }
    para.push(trimmed);
  }
  flushAll();
  return out.join("");
}

export type MdProps = {
  /** Texto en Markdown ligero. */
  children: string;
  /** Una sola línea sin párrafo envolvente (resúmenes). */
  inline?: boolean;
  /** Tamaño de lectura: md (16 px) o sm (14 px). */
  size?: "sm" | "md";
  className?: string;
};

/** Markdown ligero de las fichas con matemáticas KaTeX. */
export function Md({ children, inline: isInline, size = "md", className }: MdProps) {
  const html = useMemo(() => (isInline ? inline(children) : renderMarkdown(children)), [children, isInline]);
  if (isInline) return <span className={cx("ui-md-inline", className)} dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className={cx("ui-md", `ui-md--${size}`, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export type TeXProps = {
  /** Fórmula LaTeX (sin delimitadores $). */
  math: string;
  /** Bloque centrado (por defecto) o en línea. */
  block?: boolean;
  className?: string;
};

/** Fórmula suelta con KaTeX. */
export function TeX({ math, block = true, className }: TeXProps) {
  const html = useMemo(() => tex(math, block), [math, block]);
  const Tag = block ? "div" : "span";
  return <Tag className={cx(block ? "ui-tex" : "ui-tex-inline", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
