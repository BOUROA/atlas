import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

type Message = { level: "error" | "aviso"; msg: string };
type CheckNote = (md: string, opts: { unit: { number: number }; concepts?: unknown[] }) => { messages: Message[]; sections: string[]; words: number };

const require = createRequire(import.meta.url);
const { checkNote } = require("../scripts/validate-notes.cjs") as { checkNote: CheckNote };

const caso = (n: number) => `### Caso ${n} · Situación ${n}\nPlanteamiento y solución razonada.\n`;
const se = (n: number) => `- Sé la comprobación número ${n}.`;

/** Apuntes mínimos que cumplen la guía; `over` sustituye trozos para provocar avisos. */
function note(over: { body?: string; cases?: number; checks?: number } = {}): string {
  const { body = "Texto de la sección.", cases = 4, checks = 6 } = over;
  return [
    "# Tema 1 · Observar",
    "Entradilla.",
    "",
    "## Trazas",
    body,
    "",
    "## Chuleta",
    "- Regla corta.",
    "",
    "## Casos prácticos",
    Array.from({ length: cases }, (_, i) => caso(i + 1)).join("\n"),
    "## Antes de seguir",
    Array.from({ length: checks }, (_, i) => se(i + 1)).join("\n"),
    "",
  ].join("\n");
}

const avisos = (md: string) => checkNote(md, { unit: { number: 1 } }).messages.filter((m) => m.level === "aviso").map((m) => m.msg);

test("validate-notes: unos apuntes que cumplen la guía no dan avisos", () => {
  assert.deepEqual(checkNote(note(), { unit: { number: 1 } }).messages, []);
});

test("validate-notes: palabras acentuadas no son «sin tilde» (\\b no entiende la ó)", () => {
  assert.deepEqual(avisos(note({ body: "La prueba funcionó y el equipo solucionó el fallo; también añadió condición." })), []);
});

test("validate-notes: sigue avisando de las palabras sin tilde sueltas", () => {
  const w = avisos(note({ body: "La funcion devuelve un numero, y tambien la solucion." }));
  assert.equal(w.length, 1);
  assert.match(w[0], /^sin tilde: funcion, numero, tambien, solucion$/);
});

test("validate-notes: no avisa dentro de palabras más largas ni pegadas a cifras", () => {
  assert.deepEqual(avisos(note({ body: "Funcionamiento, disfuncional, asimismo, funcion2 y 2asi." })), []);
});

test("validate-notes: avisa de los bloques de código", () => {
  const w = avisos(note({ body: "Antes.\n```\nprint('hola')\n```\nDespués." }));
  assert.equal(w.length, 1);
  assert.match(w[0], /^línea 6: bloque de código/);
});

test("validate-notes: avisa de rótulos de llamada desconocidos y acepta los de la guía", () => {
  const ok = ["Idea clave.", "Error típico.", "Ojo.", "Truco:"].map((r) => `> **${r}** Texto.`).join("\n\n");
  assert.deepEqual(avisos(note({ body: ok })), []);
  const w = avisos(note({ body: "> **Nota.** Texto.\n\n> Cita normal con **negrita**." }));
  assert.equal(w.length, 1);
  assert.match(w[0], /rótulo de llamada «Nota» desconocido/);
});

test("validate-notes: avisa si los casos prácticos no son 4–6", () => {
  for (const n of [4, 6]) assert.deepEqual(avisos(note({ cases: n })), []);
  for (const n of [3, 7]) {
    const w = avisos(note({ cases: n }));
    assert.equal(w.length, 1);
    assert.match(w[0], new RegExp(`Casos prácticos» tiene ${n} casos`));
  }
});

test("validate-notes: avisa si las comprobaciones «Sé …» no son 6–10", () => {
  for (const n of [6, 10]) assert.deepEqual(avisos(note({ checks: n })), []);
  for (const n of [5, 11]) {
    const w = avisos(note({ checks: n }));
    assert.equal(w.length, 1);
    assert.match(w[0], new RegExp(`Antes de seguir» tiene ${n} comprobaciones`));
  }
});

test("validate-notes: los casos y los «Sé …» solo cuentan dentro de su sección", () => {
  const w = avisos(note({ body: caso(9) + "\n" + se(99), cases: 3, checks: 5 }));
  assert.equal(w.length, 2);
});
