import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { splitRow, splitTables } from "../src/features/trial/mdTables";
import type { Trial } from "../src/domain/types";

test("splitRow parte celdas y respeta código, $…$ y \\|", () => {
  assert.deepEqual(splitRow("| a | b |"), ["a", "b"]);
  assert.deepEqual(splitRow("| `x | y` | $|x|$ | c \\| d |"), ["`x | y`", "$|x|$", "c | d"]);
  assert.deepEqual(splitRow("|  | **fallo** |"), ["", "**fallo**"]);
});

test("splitTables separa texto y tablas, con alineación", () => {
  const blocks = splitTables("Traza:\n\n| i | pila |\n|:--|--:|\n| 1 | `[a]` |\n| 2 | `[]` |\n\nFin.");
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0], { kind: "md", src: "Traza:\n" });
  assert.deepEqual(blocks[1], { kind: "table", head: ["i", "pila"], align: ["left", "right"], rows: [["1", "`[a]`"], ["2", "`[]`"]] });
  assert.equal(blocks[2].kind, "md");
});

test("splitTables ignora barras dentro de bloques ``` y líneas sin separador", () => {
  const src = "```\n| a | b |\n|---|---|\n```\n\n|x| es el valor absoluto";
  assert.deepEqual(splitTables(src), [{ kind: "md", src }]);
});

test("todas las tablas de las pruebas de content/trials tienen filas con las columnas de la cabecera", () => {
  for (const file of readdirSync("content/trials").filter((f) => f.endsWith(".json"))) {
    const { trials } = JSON.parse(readFileSync(`content/trials/${file}`, "utf8")) as { trials: Trial[] };
    for (const trial of trials) {
      for (const p of trial.problems) {
        for (const src of [p.statement, p.solution]) {
          for (const b of splitTables(src)) {
            if (b.kind !== "table") {
              assert.ok(!/^\s*\|\s*:?-{3,}/m.test(b.src), `${trial.id} ${p.n}: separador de tabla sin tabla`);
              continue;
            }
            assert.equal(b.align.length, b.head.length, `${trial.id} ${p.n}: separador`);
            for (const row of b.rows) assert.equal(row.length, b.head.length, `${trial.id} ${p.n}: ${row.join(" | ")}`);
          }
        }
      }
    }
  }
});
