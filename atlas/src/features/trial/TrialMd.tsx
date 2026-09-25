// Markdown de las pruebas: el `Md` de la app más tablas con barras
// (| a | b |, fila separadora |---|:---:|), que `Md` no entiende y que las
// pruebas usan para trazas. Las tablas se separan del resto y se pintan aquí,
// cada una en su propio contenedor con scroll horizontal; el resto del texto va
// tal cual a `Md`. Las barras dentro de `código`, de $…$ o escapadas (\|) no
// parten celdas.
import { useMemo } from "react";
import { Md, cx } from "../../ui";
import { splitTables, type Align } from "./mdTables";

function MdTable({ head, align, rows }: { head: string[]; align: Align[]; rows: string[][] }) {
  const cols = Math.max(head.length, ...rows.map((r) => r.length));
  const cell = (row: string[], c: number) => row[c] ?? "";
  return (
    <div className="trial-md-table" role="region" aria-label="Tabla" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} scope="col" style={{ textAlign: align[c] }}>
                <Md inline>{cell(head, c)}</Md>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c} style={{ textAlign: align[c] }}>
                  <Md inline>{cell(row, c)}</Md>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Markdown de una prueba (enunciado, solución, reglas) con tablas. */
export function TrialMd({ children, size = "md", className }: { children: string; size?: "sm" | "md"; className?: string }) {
  const blocks = useMemo(() => splitTables(children), [children]);
  if (blocks.length === 1 && blocks[0].kind === "md") return <Md size={size} className={cx("trial-md", className)}>{children}</Md>;
  return (
    <div className={cx("trial-md", "trial-md--split", `ui-md--${size}`, className)}>
      {blocks.map((b, i) =>
        b.kind === "md" ? <Md key={i} size={size}>{b.src}</Md> : <MdTable key={i} head={b.head} align={b.align} rows={b.rows} />,
      )}
    </div>
  );
}
