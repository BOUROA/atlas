import { test } from "node:test";
import assert from "node:assert/strict";
import { findConceptSection, readingMinutes, splitNotes, wordCount } from "../src/features/notes/sections";

const SAMPLE = `# Tema 1 · Lenguaje de la lógica proposicional
Entradilla de dos líneas: de qué va el tema
y por qué importa.

## Proposiciones y conectivas
La **proposición** es un enunciado con valor de verdad.

\`\`\`
## esto no es una sección: está en un bloque de código
\`\`\`

## Fórmulas bien formadas
Una fórmula bien formada (fbf) se construye por reglas.

> **Idea clave.** Toda fbf tiene un único árbol de formación.

## Chuleta
| Conectiva | Símbolo |
|---|---|
| Negación | ¬ |
`;

test("splitNotes separa título, entradilla y secciones, ignorando ## dentro de bloques de código", () => {
  const doc = splitNotes(SAMPLE);
  assert.equal(doc.title, "Tema 1 · Lenguaje de la lógica proposicional");
  assert.match(doc.intro, /Entradilla de dos líneas/);
  assert.equal(doc.sections.length, 3);
  assert.deepEqual(doc.sections.map((s) => s.title), ["Proposiciones y conectivas", "Fórmulas bien formadas", "Chuleta"]);
  assert.match(doc.sections[0].body, /proposición/);
  // el "## " dentro del bloque de código no corta la sección: el bloque queda en el cuerpo, tal cual
  assert.match(doc.sections[0].body, /```\n## esto no es una sección: está en un bloque de código\n```/);
});

test("splitNotes funciona sin secciones ni título (documento vacío o mínimo)", () => {
  const doc = splitNotes("");
  assert.equal(doc.title, "");
  assert.equal(doc.intro, "");
  assert.deepEqual(doc.sections, []);

  const noTitle = splitNotes("Solo un párrafo suelto.\n\n## Una sección\nCuerpo.");
  assert.equal(noTitle.title, "");
  assert.match(noTitle.intro, /Solo un párrafo suelto/);
  assert.equal(noTitle.sections.length, 1);
});

test("splitNotes genera slugs estables, sin tildes y únicos", () => {
  const doc = splitNotes("# T\n\n## Formalización\n\nx\n\n## Formalización\n\ny\n\n## Ñoño & raro!\n\nz\n");
  assert.deepEqual(
    doc.sections.map((s) => s.id),
    ["formalizacion", "formalizacion-2", "nono-raro"],
  );
});

test("findConceptSection prioriza coincidencia en el título, sin tildes ni mayúsculas", () => {
  const doc = splitNotes(SAMPLE);
  const hit = findConceptSection(doc.sections, { name: "Fórmula bien formada", aliases: ["fbf"] });
  assert.equal(hit?.id, "formulas-bien-formadas");
});

test("findConceptSection cae al cuerpo si el título no lo nombra", () => {
  const doc = splitNotes(SAMPLE);
  const hit = findConceptSection(doc.sections, { name: "árbol de formación" });
  assert.equal(hit?.id, "formulas-bien-formadas");
});

test("findConceptSection devuelve null si no aparece en ningún sitio", () => {
  const doc = splitNotes(SAMPLE);
  assert.equal(findConceptSection(doc.sections, { name: "resolución SLD" }), null);
  assert.equal(findConceptSection(doc.sections, { name: "" }), null);
});

test("wordCount ignora código y fórmulas; readingMinutes redondea con mínimo 1", () => {
  const md = "palabra uno dos tres `codigo ignorado` $x^2 + y^2$\n```\nbloque entero ignorado\n```\ncuatro";
  assert.equal(wordCount(md), 5); // palabra uno dos tres cuatro
  assert.equal(readingMinutes(0), 1);
  assert.equal(readingMinutes(200), 1);
  assert.equal(readingMinutes(340), 2);
  assert.equal(readingMinutes(4500), 23);
});

test("findConceptSection ignora la notación final del nombre y busca palabras enteras", () => {
  const doc = splitNotes(`# Tema 4 · Circuitos

## Forma normal disyuntiva y conjuntiva
Texto.

## Reglas de la conjunción ($\wedge$I, $\wedge$E)
Texto.

## Puertas lógicas
La puerta OR vale 1 si alguna entrada vale 1.
`);
  // «or» no debe casar dentro de «forma» ni de «normal»
  assert.equal(findConceptSection(doc.sections, { name: "Compuertas", aliases: ["OR", "AND"] })?.title, "Puertas lógicas");
  assert.equal(findConceptSection(doc.sections, { name: "Reglas de la conjunción (∧I, ∧E)" })?.title, "Reglas de la conjunción ($\wedge$I, $\wedge$E)");
});
