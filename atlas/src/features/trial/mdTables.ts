// Tablas Markdown con barras (| a | b |, fila separadora |---|:---:|) para las
// pruebas: `Md` (src/ui) no las entiende. Puro, sin React: lo usa TrialMd.
export type Align = "left" | "center" | "right" | undefined;
export type Block = { kind: "md"; src: string } | { kind: "table"; head: string[]; align: Align[]; rows: string[][] };

const SEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const FENCE = /^```/;

/** Parte una fila `| a | b |` en celdas, respetando `código`, $…$ y \|. */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  let code = false;
  let math = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (ch === "`" && !math) code = !code;
    else if (ch === "$" && !code && s[i - 1] !== "\\") math = !math;
    if (ch === "|" && !code && !math) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function alignOf(cell: string): Align {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return undefined;
}

/** Separa el Markdown en trozos de texto y tablas (las tablas dentro de ``` no cuentan). */
export function splitTables(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let md: string[] = [];
  let inFence = false;
  const flush = () => {
    if (md.some((l) => l.trim() !== "")) blocks.push({ kind: "md", src: md.join("\n") });
    md = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (FENCE.test(t)) inFence = !inFence;
    if (!inFence && t.startsWith("|") && i + 1 < lines.length && lines[i + 1].includes("|") && SEPARATOR.test(lines[i + 1].trim())) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map(alignOf);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      i--;
      flush();
      blocks.push({ kind: "table", head, align, rows });
      continue;
    }
    md.push(line);
  }
  flush();
  return blocks;
}
