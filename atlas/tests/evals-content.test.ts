// Estructura del Bloque 1 de evals (content/evals.json) según
// docs/superpowers/specs/2026-09-26-bloque1-evals-design.md: registro en el
// catálogo, temas, conceptos con sus fuentes de FlipyERP y recursos, y
// relaciones. Los textos los revisa el validador de contenido, no este test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT = join(process.cwd(), "content");
const read = (file: string) => JSON.parse(readFileSync(join(CONTENT, file), "utf8"));

type Concept = {
  id: string;
  unitId: string;
  order: number;
  definition: string;
  questions: { id: string }[];
  sources?: string[];
  resources?: { url: string }[];
};

const DEVELOP_TESTS = "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests";
const EVALS_POST = "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents";
const STRUCTURED = "https://platform.claude.com/docs/en/build-with-claude/structured-outputs";
const AGENTS_POST = "https://www.anthropic.com/engineering/building-effective-agents";

// tema → concepto (en orden) → [sources esperadas, urls de resources esperadas]
const UNITS: Record<string, Record<string, [string[], string[]]>> = {
  "evals.t1": {
    "evo.traza": [["ai/models.py", "ai/services/chat_service.py"], [AGENTS_POST]],
    "evo.tokens_coste": [["ai/models.py", "ai/services/anthropic_client.py"], []],
    "evo.latencia": [["ai/models.py", "ai/services/chat_service.py"], []],
    "evo.auditoria_herramientas": [["core/mcp_middleware.py", "core/models.py", "core/mcp_write.py"], []],
    "evo.errores_proveedor": [["ai/services/llm_router.py", "ai/services/anthropic_client.py"], []],
  },
  "evals.t2": {
    "evo.eval": [[], [DEVELOP_TESTS, EVALS_POST]],
    "evo.golden_set": [["pim/services/qa_fugas.py"], []],
    "evo.criterios": [[], [DEVELOP_TESTS]],
    "evo.llm_juez": [["pim/services/qa_fugas.py", "pim/management/commands/revisar_enriquecimiento_ia.py"], [DEVELOP_TESTS]],
    "evo.senal_humana": [["soporte/models.py"], []],
    "evo.tests_vs_evals": [["ai/tests_router_agentes.py"], []],
  },
  "evals.t3": {
    "evo.version_prompt": [["ai/models.py", "ai/services/chat_service.py"], []],
    "evo.regresion": [["ai/models.py"], [EVALS_POST]],
    "evo.salida_estructurada": [["pim/content_studio/batch_processor.py", "ai/agents/base.py"], [STRUCTURED]],
    "evo.alertas": [["ai/models.py", "core/utils_alertas.py"], []],
  },
};

// source>target, todas de tipo requires.
const RELATIONS = [
  "evo.latencia>evo.traza",
  "evo.auditoria_herramientas>evo.traza",
  "evo.errores_proveedor>evo.traza",
  "evo.golden_set>evo.eval",
  "evo.criterios>evo.eval",
  "evo.llm_juez>evo.criterios",
  "evo.senal_humana>evo.eval",
  "evo.tests_vs_evals>evo.eval",
  "evo.regresion>evo.golden_set",
  "evo.regresion>evo.version_prompt",
  "evo.salida_estructurada>evo.criterios",
  "evo.alertas>evo.tokens_coste",
];

const evals = read("evals.json");
const concepts: Concept[] = evals.concepts;
const relations: { source: string; target: string; type: string }[] = evals.relations;

test("evals: registrada en subjects.json según el diseño", () => {
  const s = read("subjects.json").find((x: { id: string }) => x.id === "evals");
  assert.ok(s, "falta la constelación evals en subjects.json");
  assert.deepEqual(
    {
      abbr: s.abbr, level: s.level, track: s.track, audience: s.audience,
      prerequisites: s.prerequisites, file: s.file, color: s.color, colorLight: s.colorLight,
    },
    {
      abbr: "EVO", level: 2, track: "ia", audience: ["desarrollo"],
      prerequisites: ["fundamentos"], file: "evals.json", color: "#8FD3B6", colorLight: "#2E7A5B",
    },
  );
});

test("evals: en los itinerarios desarrollo y avanzado, no en cero", () => {
  const byId = Object.fromEntries(read("itineraries.json").map((i: { id: string; subjects: string[] }) => [i.id, i.subjects]));
  assert.ok(byId.desarrollo.includes("evals"));
  assert.ok(byId.avanzado.includes("evals"));
  assert.ok(!byId.cero.includes("evals"));
});

test("evals.json: tres temas en orden", () => {
  assert.equal(evals.subjectId, "evals");
  assert.deepEqual(evals.units.map((u: { id: string }) => u.id), Object.keys(UNITS));
});

for (const [unitId, expected] of Object.entries(UNITS)) {
  test(`${unitId}: conceptos, preguntas, fuentes y recursos`, () => {
    const got = concepts.filter((c) => c.unitId === unitId).sort((a, b) => a.order - b.order);
    assert.deepEqual(got.map((c) => c.id), Object.keys(expected));
    for (const c of got) {
      const [sources, urls] = expected[c.id];
      assert.equal(c.questions.length, 3, `${c.id}: tiene que tener 3 preguntas`);
      assert.deepEqual(c.sources ?? [], sources, `${c.id}: sources`);
      assert.deepEqual((c.resources ?? []).map((r) => r.url), urls, `${c.id}: resources`);
      assert.equal(
        c.definition.includes("**En FlipyERP:**"),
        sources.length > 0,
        `${c.id}: el párrafo «En FlipyERP:» va solo en los conceptos con sources`,
      );
    }
  });
}

test("evals.json: solo relaciones requires del diseño", () => {
  for (const r of relations) {
    assert.equal(r.type, "requires");
    assert.ok(RELATIONS.includes(`${r.source}>${r.target}`), `relación no prevista ${r.source}>${r.target}`);
  }
});

test("evals.json: están todas las relaciones del diseño", () => {
  assert.deepEqual(relations.map((r) => `${r.source}>${r.target}`).sort(), [...RELATIONS].sort());
});
