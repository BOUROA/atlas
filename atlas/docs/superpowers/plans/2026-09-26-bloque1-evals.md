# Bloque 1 · Evals y observabilidad de agentes · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a FlipyERP Academy la constelación `evals` («Evals y observabilidad de agentes»), con 15 conceptos en 3 temas, registrada en los itinerarios `desarrollo` y `avanzado`.

**Architecture:** Solo contenido JSON más un test de estructura: el frontend carga `content/*.json` con `import.meta.glob` y el servidor lee `subjects.json`/`itineraries.json`, así que no se toca código de la app ni el motor de Atlas. Un test nuevo (`tests/evals-content.test.ts`) fija la estructura del diseño y se va poniendo en verde tema a tema.

**Tech Stack:** JSON de contenido de Atlas, `node:test` + `tsx` (`npm test`), `scripts/validate-content.cjs`.

Diseño: `docs/superpowers/specs/2026-09-26-bloque1-evals-design.md`.
Anclajes verificados contra FlipyERP en el commit `9c10a5f6` (2026-09-26).

## Global Constraints

- Directorio de trabajo: `D:\Claude\Projects\Atlas\atlas` (repo git en `D:\Claude\Projects\Atlas`, rama `main`).
- En este Windows hay `NODE_ENV=production` global: si faltan dependencias de desarrollo, `npm ci --include=dev`.
- No editar ficheros con `Set-Content`/`Out-File` de PowerShell (rompe UTF-8). Usar el editor.
- Todo en español; commits en formato convencional terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ids de concepto `^[a-z]+\.[a-z0-9_]+$`; exactamente 3 preguntas por concepto, ids `<id>#q1..q3`; `summary` de 32 palabras como máximo.
- Sin `$` en ningún texto (es KaTeX); sin datos de clientes ni credenciales.
- `kind` de concepto ∈ `concepto|metodo|estructura`; `kind` de pregunta ∈ `recall|explain|distinguish|apply`; `kind` de recurso ∈ `documentacion|articulo`.
- Los conceptos con `sources` terminan su `definition` con un párrafo que empieza por `**En FlipyERP:**`; los que no tienen `sources` no lo llevan.
- Antes de cada commit: `npm test` en verde, `npm run check` sin errores y `FLIPYERP_ROOT='D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1' node scripts/validate-content.cjs content` con 0 errores.
- Cambio respecto al diseño: 12 relaciones en vez de 9 (se añaden `evo.latencia→evo.traza`, `evo.errores_proveedor→evo.traza` y `evo.salida_estructurada→evo.criterios`), porque el validador avisa de conceptos sin ninguna relación `requires` y el objetivo es 0 avisos.

## Ficheros

| Fichero | Acción | Responsabilidad |
|---|---|---|
| `tests/evals-content.test.ts` | crear | Fija la estructura del diseño (registro, temas, conceptos, fuentes, recursos, relaciones). |
| `content/subjects.json` | modificar | Registrar la constelación `evals`. |
| `content/itineraries.json` | modificar | Añadir `evals` a `desarrollo` y `avanzado`. |
| `content/evals.json` | crear | Temas, conceptos y relaciones. |
| `tests/academy.test.ts:220` | modificar | El itinerario `desarrollo` pasa a incluir `evals`. |
| `docs/superpowers/specs/2026-09-26-bloque1-evals-design.md` | modificar | Reflejar las 12 relaciones. |
| `../CLAUDE.md` | modificar | Estado: Bloque 1 hecho. |

---

### Task 1: Registro de la constelación y test de estructura

**Files:**
- Create: `tests/evals-content.test.ts`
- Create: `content/evals.json`
- Modify: `content/subjects.json` (añadir al final del array)
- Modify: `content/itineraries.json`
- Modify: `tests/academy.test.ts:220`
- Modify: `docs/superpowers/specs/2026-09-26-bloque1-evals-design.md` (tabla de relaciones)

**Interfaces:**
- Produces: `content/evals.json` con `subjectId: "evals"`, temas `evals.t1`–`evals.t3`, `concepts: []`, `relations: []`. Las tareas 2–4 añaden conceptos y relaciones a esos arrays. El test define las tablas `UNITS` y `RELATIONS` que las tareas 2–4 deben satisfacer.

- [ ] **Step 1: Escribir el test**

Crear `tests/evals-content.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `node --import tsx --test tests/evals-content.test.ts`
Expected: FAIL con `ENOENT ... content/evals.json` (el fichero aún no existe).

- [ ] **Step 3: Crear `content/evals.json` con los temas**

```json
{
  "subjectId": "evals",
  "units": [
    {
      "id": "evals.t1",
      "number": 1,
      "title": "Observar un agente",
      "summary": "Qué dejar registrado de cada ejecución de un agente para poder entender, depurar y pagar lo que hace."
    },
    {
      "id": "evals.t2",
      "number": 2,
      "title": "Evaluar",
      "summary": "Cómo medir si un agente lo hace bien: casos, criterios, jueces y la señal que ya dejan las personas al revisar."
    },
    {
      "id": "evals.t3",
      "number": 3,
      "title": "Cerrar el bucle",
      "summary": "Usar lo observado y lo evaluado para cambiar prompts y modelos con seguridad y enterarse a tiempo cuando algo se tuerce."
    }
  ],
  "concepts": [],
  "relations": []
}
```

- [ ] **Step 4: Registrar la constelación en `content/subjects.json`**

Añadir como último elemento del array (después de `tenancy`):

```json
  {
    "id": "evals",
    "name": "Evals y observabilidad de agentes",
    "shortName": "Evals",
    "abbr": "EVO",
    "year": 2,
    "semester": 1,
    "status": "current",
    "color": "#8FD3B6",
    "colorLight": "#2E7A5B",
    "order": 3,
    "file": "evals.json",
    "level": 2,
    "track": "ia",
    "audience": ["desarrollo"],
    "prerequisites": ["fundamentos"],
    "description": "Cómo saber qué hace un agente de IA y si lo hace bien: qué registrar de cada llamada, cómo construir evals y cómo usarlos para cambiar prompts y modelos sin romper nada. Con ejemplos del agente de FlipyERP."
  }
```

- [ ] **Step 5: Añadirla a los itinerarios en `content/itineraries.json`**

Sustituir las entradas `desarrollo` y `avanzado` por:

```json
  {
    "id": "desarrollo",
    "name": "Desarrollador que se incorpora",
    "description": "Para una persona que va a programar en FlipyERP: fundamentos de IA, cómo está construido el ERP por dentro y cómo observar y evaluar sus agentes.",
    "subjects": ["fundamentos", "tenancy", "evals"]
  },
  {
    "id": "avanzado",
    "name": "Avanzado",
    "description": "Para perfiles técnicos que ya dominan la IA generativa: el funcionamiento interno de FlipyERP y la evaluación y observabilidad de sus agentes.",
    "subjects": ["tenancy", "evals"]
  }
```

- [ ] **Step 6: Actualizar el test de academia que fija el itinerario `desarrollo`**

En `tests/academy.test.ts`, línea 220, cambiar:

```ts
  assert.deepEqual(upd.json.enrollment.subjectIds, ["fundamentos", "tenancy"]);
```

por:

```ts
  assert.deepEqual(upd.json.enrollment.subjectIds, ["fundamentos", "tenancy", "evals"]);
```

(`closeOverPrerequisites` devuelve las constelaciones en el orden de `subjects.json`, y `evals` va la última.)

- [ ] **Step 7: Reflejar las 12 relaciones en el diseño**

En `docs/superpowers/specs/2026-09-26-bloque1-evals-design.md`, al final de la tabla de «Relaciones», añadir estas filas y, debajo de la tabla, la nota:

```markdown
| `evo.latencia` | `evo.traza` | La duración de cada paso se lee en la traza. |
| `evo.errores_proveedor` | `evo.traza` | Un error o un fallback solo se ve si queda en la traza. |
| `evo.salida_estructurada` | `evo.criterios` | Validar el esquema es el criterio determinista más barato. |

Nota (plan de implementación): las tres últimas se añaden porque el validador
avisa de conceptos sin ninguna relación `requires`, y el objetivo es 0 avisos.
```

- [ ] **Step 8: Ejecutar el test y ver qué pasa y qué falla**

Run: `node --import tsx --test tests/evals-content.test.ts`
Expected: PASS «registrada en subjects.json», «en los itinerarios», «tres temas en orden» y «solo relaciones requires»; FAIL los tres de tema (`evals.t1`…`evals.t3`: lista de conceptos vacía) y «están todas las relaciones». Los fallos restantes los cierran las tareas 2–4.

- [ ] **Step 9: Validador y suite completa**

Run: `FLIPYERP_ROOT='D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1' node scripts/validate-content.cjs content`
Expected: `0 errores`; `Conceptos por asignatura` incluye `"evals":0`.

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` y `npm run check`
Expected: solo fallan los 4 tests pendientes de `evals-content.test.ts`; `academy.test.ts` pasa; `tsc` sin errores.

- [ ] **Step 10: Commit**

Con tests en rojo a propósito no se hace commit en `main`. Dejar los cambios sin commitear y seguir con la tarea 2; el primer commit va al final de la tarea 2, cuando el tema 1 está en verde. (Si se trabaja en una rama, sí se puede commitear aquí con `test(academy): estructura del Bloque 1 de evals`.)

---

### Task 2: Tema 1 · Observar un agente

**Files:**
- Modify: `content/evals.json` (arrays `concepts` y `relations`)

**Interfaces:**
- Consumes: `content/evals.json` y `tests/evals-content.test.ts` de la tarea 1.
- Produces: conceptos `evo.traza`, `evo.tokens_coste`, `evo.latencia`, `evo.auditoria_herramientas`, `evo.errores_proveedor` (orders 1–5); relaciones con target `evo.traza`. Las tareas 3–4 añaden detrás.

- [ ] **Step 1: Confirmar que el test del tema 1 falla**

Run: `node --import tsx --test --test-name-pattern="evals.t1" tests/evals-content.test.ts`
Expected: FAIL (`[]` frente a los 5 ids).

- [ ] **Step 2: Releer los anclajes en FlipyERP**

Comprobar que siguen igual (si algo cambió, ajustar el texto del párrafo «En FlipyERP:» a lo que hay):

```bash
cd /d/Claude/Projects/FlipyERP/FlipyERP_v1.0.1
grep -n "tool_name\|tool_use_id\|tool_input\|duracion_segundos" ai/models.py
grep -n "MAX_TOOL_ITERATIONS\|duracion = time.time\|duracion_segundos" ai/services/chat_service.py
grep -n "Retry automatico\|if tarea_id" ai/services/anthropic_client.py
grep -n "success = \|MCPToolUsage" core/mcp_middleware.py
grep -n "agente='mcp_write'\|duracion_segundos=0\|def _check_write_permission" core/mcp_write.py
grep -n "ROUTING_TAREAS = \|fallback" ai/services/llm_router.py | head -5
```

Expected: `ChatService` calcula `duracion` en la línea ~145 y no hay ninguna asignación a `duracion_segundos` en `chat_service.py`; `success = 200 <= response.status_code < 400`; `if tarea_id:` antes de crear `AiCosteLog`; «Retry automatico con backoff» en la cabecera y ningún bucle de reintentos.

- [ ] **Step 3: Añadir los conceptos del tema 1 a `concepts`**

```json
    {
      "id": "evo.traza",
      "name": "Traza de una ejecución",
      "aliases": ["traza", "trace", "registro de ejecución"],
      "unitId": "evals.t1",
      "order": 1,
      "kind": "concepto",
      "difficulty": 2,
      "summary": "Registro ordenado de todo lo que pasa en una ejecución del agente: qué entra, qué pide el modelo, qué herramientas llama, qué devuelven y qué responde.",
      "intuition": "Es la caja negra de un avión: si algo sale mal, no basta con saber que el vuelo acabó mal; necesitas la secuencia completa de decisiones para entender por qué.",
      "definition": "Un agente no hace una sola llamada al modelo: encadena turnos en los que el modelo razona, pide una herramienta, recibe el resultado y decide el siguiente paso. La **traza** guarda cada uno de esos pasos, en orden y enlazados entre sí (por ejemplo, cada resultado de herramienta con la petición que lo originó). Sin traza solo ves la respuesta final y no puedes saber si el fallo vino del prompt, de una herramienta o de un dato.\n\n**En FlipyERP:** el chat guarda cada paso como un `AiMensaje` (`ai/models.py`) con su `rol`; las llamadas a herramientas llevan `tool_name`, `tool_use_id` y `tool_input`. `ChatService` (`ai/services/chat_service.py`) los va creando en cada vuelta del bucle, hasta `MAX_TOOL_ITERATIONS = 10`.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Guardar solo la pregunta y la respuesta final: se pierde por qué el agente llegó ahí.",
        "No enlazar cada resultado de herramienta con la llamada que lo pidió: con varias herramientas a la vez la traza se vuelve ilegible."
      ],
      "questions": [
        {
          "id": "evo.traza#q1",
          "kind": "recall",
          "prompt": "¿Qué pasos de una ejecución debería recoger la traza de un agente?",
          "answer": "La entrada, cada llamada al modelo, cada herramienta que pide (con sus argumentos), lo que devuelve cada herramienta y la respuesta final, en orden.",
          "difficulty": 1
        },
        {
          "id": "evo.traza#q2",
          "kind": "explain",
          "prompt": "¿Por qué no basta con guardar la respuesta final para depurar un agente?",
          "answer": "Porque el fallo puede estar en cualquier paso intermedio: un prompt mal interpretado, una herramienta que devolvió un dato erróneo o una decisión equivocada del modelo. Sin los pasos no puedes localizarlo.",
          "difficulty": 2
        },
        {
          "id": "evo.traza#q3",
          "kind": "apply",
          "prompt": "En el chat de FlipyERP, ¿qué campo de `AiMensaje` permite saber a qué llamada de herramienta corresponde un resultado?",
          "answer": "`tool_use_id`: la petición de herramienta y su resultado comparten ese identificador.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/models.py", "ai/services/chat_service.py"],
      "resources": [
        {
          "title": "Building effective agents",
          "url": "https://www.anthropic.com/engineering/building-effective-agents",
          "provider": "Anthropic Engineering",
          "kind": "articulo"
        }
      ]
    },
    {
      "id": "evo.tokens_coste",
      "name": "Tokens y coste por llamada",
      "aliases": ["coste LLM", "consumo de tokens", "token usage"],
      "unitId": "evals.t1",
      "order": 2,
      "kind": "concepto",
      "difficulty": 2,
      "summary": "Cada llamada consume tokens de entrada y de salida con precios distintos; registrarlos por llamada es la única forma de saber cuánto cuesta cada agente.",
      "intuition": "Como una factura de la luz desglosada por aparato: el total del mes no te dice qué conviene apagar; el desglose, sí.",
      "definition": "La API devuelve en cada respuesta cuántos tokens de entrada y de salida ha usado. El coste es los tokens de entrada por su precio más los de salida por el suyo (la salida suele ser varias veces más cara). Registrarlo **por llamada**, con el modelo y el módulo que la hizo, permite atribuir el gasto, detectar prompts que crecen sin control y comparar modelos.\n\n**En FlipyERP:** el coste va a `AiCosteLog` (`ai/models.py`), con `modelo_llm`, `modulo`, `tokens_input`, `tokens_output` y `coste_estimado_usd`. `AiCosteLog.calcular_coste` usa una tabla de precios en el código y, si el modelo no aparece, recurre a `ModeloIA` o al precio de Sonnet. `AnthropicService.completar` (`ai/services/anthropic_client.py`) solo crea el registro si recibe `tarea_id`: las llamadas sin tarea no dejan coste.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Mirar solo el total mensual del proveedor: no dice qué agente o qué prompt gasta.",
        "Calcular el coste con un único precio por token: entrada y salida tienen precios distintos.",
        "Dar por hecho que todas las llamadas quedan registradas sin comprobar los caminos que no lo hacen."
      ],
      "questions": [
        {
          "id": "evo.tokens_coste#q1",
          "kind": "recall",
          "prompt": "¿Qué dos cantidades de tokens hay que registrar de cada llamada y por qué por separado?",
          "answer": "Los tokens de entrada y los de salida, porque tienen precios distintos (la salida suele costar bastante más).",
          "difficulty": 1
        },
        {
          "id": "evo.tokens_coste#q2",
          "kind": "explain",
          "prompt": "¿Qué ganas registrando el coste por llamada y por módulo en vez de mirar la factura mensual?",
          "answer": "Saber qué agente, qué módulo o qué prompt concentra el gasto, detectar a tiempo un prompt que ha crecido y comparar el coste real de dos modelos para la misma tarea.",
          "difficulty": 2
        },
        {
          "id": "evo.tokens_coste#q3",
          "kind": "apply",
          "prompt": "Una llamada a `AnthropicService.completar` se hace sin `tarea_id`. ¿Qué pasa con su coste en FlipyERP?",
          "answer": "Se calcula pero no se guarda: el registro en `AiCosteLog` solo se crea cuando hay `tarea_id`, así que esa llamada no aparece en los informes de coste.",
          "difficulty": 3
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/models.py", "ai/services/anthropic_client.py"]
    },
    {
      "id": "evo.latencia",
      "name": "Latencia y duración",
      "aliases": ["latencia", "tiempo de respuesta", "duración"],
      "unitId": "evals.t1",
      "order": 3,
      "kind": "concepto",
      "difficulty": 2,
      "summary": "Cuánto tarda cada llamada y cada ejecución completa; en un agente la duración total suma varias llamadas al modelo y a herramientas.",
      "intuition": "En un restaurante no importa solo lo que tarda el cocinero en un plato, sino cuánto espera el cliente desde que pide hasta que come, con todas las idas y vueltas.",
      "definition": "Hay dos medidas útiles: la **latencia de cada llamada** al modelo o a una herramienta, y la **duración de la ejecución completa** que percibe la persona. En un agente la segunda crece con cada vuelta del bucle, así que conviene guardar ambas para saber qué paso es el lento. Se analizan con percentiles (p50, p95), no con la media, porque unos pocos casos lentos son los que molestan.\n\n**En FlipyERP:** `AiTarea` y `AiMensaje` (`ai/models.py`) tienen un campo `duracion_segundos`. `ChatService` (`ai/services/chat_service.py`) calcula la duración de cada llamada (`duracion = time.time() - inicio`) pero no la guarda en ningún campo, así que la latencia del chat no queda registrada.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Medir solo la media: esconde los casos lentos, que son los que ve el usuario.",
        "Medir la ejecución completa sin desglose: no sabes si tarda el modelo o una herramienta."
      ],
      "questions": [
        {
          "id": "evo.latencia#q1",
          "kind": "recall",
          "prompt": "¿Qué dos duraciones conviene registrar en un agente?",
          "answer": "La latencia de cada llamada (al modelo o a una herramienta) y la duración total de la ejecución que percibe el usuario.",
          "difficulty": 1
        },
        {
          "id": "evo.latencia#q2",
          "kind": "distinguish",
          "prompt": "¿Por qué se usan percentiles como el p95 en lugar de la media para la latencia?",
          "answer": "Porque la media apenas se mueve con unos pocos casos muy lentos, y son justamente esos los que sufre el usuario; el p95 dice cuánto tarda el 5 % más lento.",
          "difficulty": 2
        },
        {
          "id": "evo.latencia#q3",
          "kind": "apply",
          "prompt": "En el chat de FlipyERP, ¿puedes consultar cuánto tardó cada llamada al modelo? ¿Por qué?",
          "answer": "No: `ChatService` calcula la duración de cada llamada, pero nunca la asigna a `duracion_segundos` de `AiMensaje`, así que se pierde.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/models.py", "ai/services/chat_service.py"]
    },
    {
      "id": "evo.auditoria_herramientas",
      "name": "Auditar lo que hace el agente",
      "aliases": ["auditoría de herramientas", "tool audit", "registro de herramientas"],
      "unitId": "evals.t1",
      "order": 4,
      "kind": "metodo",
      "difficulty": 3,
      "summary": "Registrar cada herramienta que usa el agente, quién la pidió, con qué argumentos y si de verdad funcionó, sobre todo cuando escribe datos.",
      "intuition": "El registro de entradas de un edificio: no basta con saber que alguien entró; hay que saber quién, cuándo, a qué planta y si salió.",
      "definition": "Las herramientas son la parte del agente que **actúa** sobre el mundo: consultas, escrituras, comandos. Auditarlas es registrar de cada llamada la herramienta, el usuario y la empresa, los argumentos, la duración y si tuvo éxito. «Éxito» debe significar que la herramienta hizo lo que tenía que hacer, no solo que la petición llegó.\n\n**En FlipyERP:** `MCPUsageMiddleware` (`core/mcp_middleware.py`) guarda un `MCPToolUsage` (`core/models.py`) por petición MCP con usuario, empresa, `duration_ms` y `success`, pero `success` se calcula como `200 <= status_code < 400` y no se guardan los argumentos. Las escrituras de `SystemWriteToolset` (`core/mcp_write.py`) exigen rol admin o gestor y se auditan como `AiTarea` con `agente='mcp_write'` y `duracion_segundos=0`.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Tomar el código HTTP como prueba de éxito: un protocolo como JSON-RPC puede devolver 200 con un error dentro.",
        "No guardar los argumentos: sabes que se llamó a la herramienta, pero no qué hizo.",
        "Auditar igual lecturas y escrituras: las escrituras necesitan más detalle y control de permisos."
      ],
      "questions": [
        {
          "id": "evo.auditoria_herramientas#q1",
          "kind": "recall",
          "prompt": "¿Qué datos mínimos debe registrar la auditoría de cada llamada a una herramienta?",
          "answer": "Qué herramienta, quién la pidió (usuario y empresa), con qué argumentos, cuánto tardó y si realmente tuvo éxito.",
          "difficulty": 1
        },
        {
          "id": "evo.auditoria_herramientas#q2",
          "kind": "apply",
          "prompt": "¿Por qué `MCPToolUsage` puede marcar como éxito una llamada cuya herramienta falló?",
          "answer": "Porque `success` sale del código HTTP (`200 <= status_code < 400`), y en MCP, que usa JSON-RPC, un error de la herramienta puede viajar dentro de una respuesta con código 200.",
          "difficulty": 3
        },
        {
          "id": "evo.auditoria_herramientas#q3",
          "kind": "explain",
          "prompt": "¿Por qué las herramientas que escriben datos necesitan más control que las de lectura?",
          "answer": "Porque cambian el estado del sistema: un error o un abuso tiene efectos reales. Por eso en FlipyERP las escrituras exigen rol admin o gestor y dejan un registro propio.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["core/mcp_middleware.py", "core/models.py", "core/mcp_write.py"]
    },
    {
      "id": "evo.errores_proveedor",
      "name": "Errores del proveedor, reintentos y fallback",
      "aliases": ["reintentos", "retry", "fallback de modelo", "rate limit"],
      "unitId": "evals.t1",
      "order": 5,
      "kind": "metodo",
      "difficulty": 3,
      "summary": "Las APIs de modelos fallan por límites de uso, saturación o cortes: hay que distinguir el error, reintentar con espera y, si no, pasar a otro modelo.",
      "intuition": "Si la línea de un proveedor comunica, vuelves a llamar al rato; si sigue sin cogerlo, llamas a otro. Y apuntas cuántas veces pasó.",
      "definition": "Los errores típicos son de **límite de uso** (429), de **sobrecarga** (529) y **fallos transitorios** de red o del servidor. Los transitorios se reintentan con espera creciente (*backoff*); los de la petición (400) no, porque volverán a fallar. Si los reintentos se agotan, un **fallback** pasa la tarea a otro modelo o proveedor. Todo ello debe quedar registrado: un fallback silencioso cambia la calidad y el coste sin que nadie lo sepa.\n\n**En FlipyERP:** `LLMRouter` (`ai/services/llm_router.py`) elige proveedor según la configuración y `ROUTING_TAREAS`, y si el primero falla lo intenta con otro. La cabecera de `ai/services/anthropic_client.py` anuncia «Retry automatico con backoff», pero el fichero no implementa reintentos propios: dependen de los que traiga el SDK por defecto.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Reintentar cualquier error: un 400, que es una petición mal formada, fallará igual cada vez.",
        "Reintentar sin espera: empeora la saturación que causó el error.",
        "Hacer fallback sin registrarlo: la respuesta la dio otro modelo y nadie lo sabe."
      ],
      "questions": [
        {
          "id": "evo.errores_proveedor#q1",
          "kind": "distinguish",
          "prompt": "¿Qué errores de una API de modelos tiene sentido reintentar y cuáles no?",
          "answer": "Se reintentan los transitorios: límite de uso (429), sobrecarga (529) y fallos de red o del servidor (5xx). No se reintenta un 400, porque la petición está mal y fallará igual.",
          "difficulty": 2
        },
        {
          "id": "evo.errores_proveedor#q2",
          "kind": "explain",
          "prompt": "¿Por qué un fallback a otro modelo debe quedar registrado?",
          "answer": "Porque cambia quién responde: la calidad, el formato y el coste pueden ser distintos, y sin registro no puedes explicar por qué una respuesta salió peor o más cara.",
          "difficulty": 2
        },
        {
          "id": "evo.errores_proveedor#q3",
          "kind": "apply",
          "prompt": "La cabecera de `anthropic_client.py` dice «Retry automatico con backoff». ¿Qué harías antes de confiar en ello?",
          "answer": "Comprobar el código: en ese fichero no hay bucle de reintentos, así que el comportamiento real es el que traiga el SDK por defecto. El comentario de un fichero no sustituye a mirar qué hace.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/services/llm_router.py", "ai/services/anthropic_client.py"]
    }
```

- [ ] **Step 4: Añadir las relaciones del tema 1 a `relations`**

```json
    { "source": "evo.latencia", "target": "evo.traza", "type": "requires", "reason": "La duración de cada paso se lee en la traza." },
    { "source": "evo.auditoria_herramientas", "target": "evo.traza", "type": "requires", "reason": "Auditar herramientas es registrar una parte concreta de la traza." },
    { "source": "evo.errores_proveedor", "target": "evo.traza", "type": "requires", "reason": "Un error o un fallback solo se ve si queda en la traza." }
```

- [ ] **Step 5: Ejecutar el test del tema 1**

Run: `node --import tsx --test --test-name-pattern="evals.t1" tests/evals-content.test.ts`
Expected: PASS.

- [ ] **Step 6: Validador y suite**

Run: `FLIPYERP_ROOT='D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1' node scripts/validate-content.cjs content`
Expected: `0 errores`; `"evals":5`. (Puede haber un aviso de `evo.tokens_coste` sin relación: se cierra en la tarea 4.)

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` y `npm run check`
Expected: solo fallan `evals.t2`, `evals.t3` y «están todas las relaciones».

- [ ] **Step 7: Commit** (primer commit del bloque: incluye lo de la tarea 1)

Con tests aún en rojo, este commit va a una rama, no a `main`:

```bash
cd /d/Claude/Projects/Atlas
git switch -c academy/bloque1-evals
git add atlas/tests/evals-content.test.ts atlas/tests/academy.test.ts atlas/content/evals.json atlas/content/subjects.json atlas/content/itineraries.json atlas/docs/superpowers/specs/2026-09-26-bloque1-evals-design.md
git commit -m "feat(academy): constelación de evals y tema 1 «Observar un agente»

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tema 2 · Evaluar

**Files:**
- Modify: `content/evals.json` (arrays `concepts` y `relations`)

**Interfaces:**
- Consumes: tema 1 de la tarea 2 (orders 1–5).
- Produces: `evo.eval`, `evo.golden_set`, `evo.criterios`, `evo.llm_juez`, `evo.senal_humana`, `evo.tests_vs_evals` (orders 6–11). La tarea 4 enlaza `evo.regresion` con `evo.golden_set` y `evo.salida_estructurada` con `evo.criterios`.

- [ ] **Step 1: Confirmar que el test del tema 2 falla**

Run: `node --import tsx --test --test-name-pattern="evals.t2" tests/evals-content.test.ts`
Expected: FAIL.

- [ ] **Step 2: Releer los anclajes en FlipyERP**

```bash
cd /d/Claude/Projects/FlipyERP/FlipyERP_v1.0.1
grep -n "def es_fuga_descripcion\|def clasificar_producto\|def muestra_estratificada\|Haiku\|haiku" pim/services/qa_fugas.py | head
grep -n "validar-descripciones\|coherente" pim/management/commands/revisar_enriquecimiento_ia.py | head -3
grep -n "class DraftRespuestaIA\|cuerpo_propuesto\|cuerpo_editado\|'aprobado'\|'rechazado'\|'enviado'" soporte/models.py
grep -n "from unittest.mock import patch\|class .*Test" ai/tests_router_agentes.py
```

Expected: `muestra_estratificada` toma un número fijo por estado (`por_estado`); el juez usa un modelo Haiku; `revisar_enriquecimiento_ia` pide `{"coherente": ..., "motivo": ...}`; `DraftRespuestaIA` tiene `cuerpo_propuesto`, `cuerpo_editado` y los estados citados; los tests usan `patch`.

- [ ] **Step 3: Añadir los conceptos del tema 2 a `concepts`** (detrás de `evo.errores_proveedor`)

```json
    {
      "id": "evo.eval",
      "name": "Qué es un eval",
      "aliases": ["eval", "evaluación", "evaluation"],
      "unitId": "evals.t2",
      "order": 6,
      "kind": "concepto",
      "difficulty": 1,
      "summary": "Prueba repetible que mide la calidad de las salidas de un modelo o agente: unos casos, un criterio para puntuarlos y una puntuación agregada.",
      "intuition": "Un examen con plantilla de corrección: las mismas preguntas y los mismos criterios cada vez, para comparar de forma justa a varios alumnos, o a un mismo alumno antes y después.",
      "definition": "Un **eval** tiene tres piezas: **casos** (entradas representativas, a veces con la salida esperada), un **criterio** que decide si cada salida es buena, o cuánto, y una **puntuación** agregada (porcentaje de aciertos, nota media…). Lo que lo distingue de probar a mano es que es **repetible**: se puede volver a lanzar tras cualquier cambio y comparar resultados. Los criterios de éxito se definen antes de construirlo: qué tiene que hacer bien el agente y cuánto es suficiente.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Llamar eval a probar unos cuantos ejemplos a ojo: si no es repetible, no sirve para comparar.",
        "Construir el eval sin definir antes qué significa que una salida sea buena."
      ],
      "questions": [
        {
          "id": "evo.eval#q1",
          "kind": "recall",
          "prompt": "¿Cuáles son las tres piezas de un eval?",
          "answer": "Los casos (entradas, a veces con la salida esperada), el criterio que puntúa cada salida y la puntuación agregada.",
          "difficulty": 1
        },
        {
          "id": "evo.eval#q2",
          "kind": "distinguish",
          "prompt": "¿En qué se diferencia un eval de probar el agente a mano con unos ejemplos?",
          "answer": "En que el eval es repetible y tiene un criterio fijo: se lanza igual tras cada cambio y se comparan números. La prueba a mano depende de quién mira y de qué ejemplos elige ese día.",
          "difficulty": 1
        },
        {
          "id": "evo.eval#q3",
          "kind": "explain",
          "prompt": "¿Por qué conviene definir los criterios de éxito antes de construir el eval?",
          "answer": "Porque deciden qué casos incluir y cómo puntuar; si se definen después, se tiende a medir lo que es fácil de medir y no lo que importa.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "resources": [
        {
          "title": "Define success criteria and build evaluations",
          "url": "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests",
          "provider": "Anthropic (documentación oficial)",
          "kind": "documentacion"
        },
        {
          "title": "Demystifying evals for AI agents",
          "url": "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents",
          "provider": "Anthropic Engineering",
          "kind": "articulo"
        }
      ]
    },
    {
      "id": "evo.golden_set",
      "name": "Conjunto de referencia y muestreo",
      "aliases": ["golden set", "dataset de evaluación", "conjunto dorado"],
      "unitId": "evals.t2",
      "order": 7,
      "kind": "estructura",
      "difficulty": 2,
      "summary": "Colección fija de casos, revisada por personas, que representa bien el trabajo real del agente y sobre la que se repite el eval.",
      "intuition": "Los platos de prueba de una cocina: siempre los mismos, elegidos para cubrir lo fácil, lo difícil y lo raro, y así saber si la receta nueva es mejor.",
      "definition": "El **conjunto de referencia** (*golden set*) son los casos del eval. Debe ser **representativo** (parecerse a lo que llega de verdad), **cubrir los casos difíciles y raros** y estar **revisado por personas** cuando incluye la respuesta esperada. Para construirlo a partir de datos reales se usa **muestreo estratificado**: se toman casos de cada grupo relevante (estado, categoría, cliente…) en vez de los primeros o al azar, que dejaría fuera los grupos pequeños. Se mantiene estable para poder comparar; si cambia, se versiona.\n\n**En FlipyERP:** `pim/services/qa_fugas.py` tiene `muestra_estratificada`, que toma un número fijo de productos por estado del catálogo para revisarlos, en lugar de una muestra al azar.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Usar solo casos fáciles o los primeros que salen: el eval da buena nota y el agente falla en producción.",
        "Cambiar el conjunto entre dos ejecuciones y comparar las notas como si fueran equivalentes."
      ],
      "questions": [
        {
          "id": "evo.golden_set#q1",
          "kind": "recall",
          "prompt": "¿Qué tres propiedades debe tener un buen conjunto de referencia?",
          "answer": "Ser representativo del trabajo real, cubrir los casos difíciles y raros, y estar revisado por personas cuando incluye la respuesta esperada.",
          "difficulty": 1
        },
        {
          "id": "evo.golden_set#q2",
          "kind": "explain",
          "prompt": "¿Por qué se usa muestreo estratificado en lugar de una muestra al azar?",
          "answer": "Porque al azar los grupos pequeños pueden no salir nunca; estratificando se toman casos de cada grupo y el eval los cubre todos.",
          "difficulty": 2
        },
        {
          "id": "evo.golden_set#q3",
          "kind": "apply",
          "prompt": "Si amplías el conjunto de referencia con 50 casos nuevos, ¿puedes comparar la nota nueva con la de la semana pasada?",
          "answer": "No directamente: el conjunto ha cambiado. Hay que versionarlo y comparar las dos versiones del agente sobre el mismo conjunto.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["pim/services/qa_fugas.py"]
    },
    {
      "id": "evo.criterios",
      "name": "Criterios de evaluación",
      "aliases": ["métricas de evaluación", "rúbrica", "criterio de éxito"],
      "unitId": "evals.t2",
      "order": 8,
      "kind": "concepto",
      "difficulty": 2,
      "summary": "La regla que decide si una salida es buena: coincidencia exacta, comprobaciones deterministas en código o una rúbrica que aplica una persona o un modelo.",
      "intuition": "Corregir un examen tipo test, uno de problemas y una redacción: el primero con plantilla, el segundo comprobando el resultado y el tercero con una rúbrica.",
      "definition": "De más barato y fiable a más flexible: 1) **coincidencia exacta** con la respuesta esperada (clasificaciones, extracción de un campo); 2) **reglas deterministas** en código (el JSON cumple el esquema, el importe cuadra, no aparece una palabra prohibida); 3) **rúbrica** con criterios escritos que aplica una persona o un modelo (tono, utilidad, fidelidad a las fuentes). Conviene usar el criterio más simple que mida lo que importa y reservar la rúbrica para lo que el código no puede comprobar.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Usar un LLM como juez para algo que una regla en código comprobaría mejor y gratis.",
        "Escribir rúbricas vagas, como «que sea buena»: cada evaluador las interpreta distinto."
      ],
      "questions": [
        {
          "id": "evo.criterios#q1",
          "kind": "recall",
          "prompt": "Ordena de más barato a más flexible los tres tipos de criterio.",
          "answer": "Coincidencia exacta, reglas deterministas en código y rúbrica aplicada por una persona o un modelo.",
          "difficulty": 1
        },
        {
          "id": "evo.criterios#q2",
          "kind": "apply",
          "prompt": "Un agente extrae el NIF de una factura. ¿Qué criterio usarías?",
          "answer": "Coincidencia exacta con el NIF esperado, tras normalizar mayúsculas y espacios, más una regla de formato; no hace falta una rúbrica.",
          "difficulty": 2
        },
        {
          "id": "evo.criterios#q3",
          "kind": "explain",
          "prompt": "¿Qué hace que una rúbrica sea útil?",
          "answer": "Que sus criterios sean concretos y comprobables (por ejemplo, «cita el número de pedido», «no promete plazos»), de forma que dos evaluadores lleguen a la misma nota.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "resources": [
        {
          "title": "Define success criteria and build evaluations",
          "url": "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests",
          "provider": "Anthropic (documentación oficial)",
          "kind": "documentacion"
        }
      ]
    },
    {
      "id": "evo.llm_juez",
      "name": "LLM como juez",
      "aliases": ["LLM-as-judge", "juez LLM", "evaluación con modelo"],
      "unitId": "evals.t2",
      "order": 9,
      "kind": "metodo",
      "difficulty": 3,
      "summary": "Usar un modelo para puntuar las salidas de otro con una rúbrica: escala donde no llegan las personas, pero hay que comprobar que coincide con ellas.",
      "intuition": "Un corrector ayudante: corrige rápido cientos de exámenes con la rúbrica del profesor, pero el profesor revisa una muestra para ver si corrige como él.",
      "definition": "Un **juez LLM** recibe la entrada, la salida a evaluar y una rúbrica, y devuelve una puntuación o una etiqueta, mejor en un formato estructurado y con un motivo breve. Funciona mejor con preguntas concretas y cerradas («¿la descripción menciona algo que no está en la ficha? sí o no») que con notas abstractas del 1 al 10. Antes de fiarse hay que **calibrarlo**: comparar sus veredictos con los de personas en una muestra y medir cuánto coinciden.\n\n**En FlipyERP:** `pim/services/qa_fugas.py` usa un modelo pequeño (Haiku) como juez en `es_fuga_descripcion` y `clasificar_producto`, y el comando `revisar_enriquecimiento_ia --validar-descripciones` (`pim/management/commands/revisar_enriquecimiento_ia.py`) pide al modelo un JSON con `coherente` (verdadero o falso) y `motivo`. Los dos se lanzan a mano; no forman parte de un eval automático.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Fiarse del juez sin compararlo con personas: puede tener sesgos, como preferir respuestas largas.",
        "Pedir una nota de 1 a 10 sin criterios: el juez da notas poco consistentes.",
        "Usar el mismo modelo y el mismo prompt para generar la salida y para juzgarla."
      ],
      "questions": [
        {
          "id": "evo.llm_juez#q1",
          "kind": "recall",
          "prompt": "¿Qué recibe y qué devuelve un juez LLM?",
          "answer": "Recibe la entrada, la salida que hay que evaluar y la rúbrica; devuelve una puntuación o etiqueta, mejor en formato estructurado y con un motivo breve.",
          "difficulty": 1
        },
        {
          "id": "evo.llm_juez#q2",
          "kind": "explain",
          "prompt": "¿Qué significa calibrar un juez LLM y por qué es necesario?",
          "answer": "Comparar sus veredictos con los de personas en una muestra y medir la coincidencia. Sin eso no sabes si el juez mide lo que crees o tiene sesgos propios.",
          "difficulty": 2
        },
        {
          "id": "evo.llm_juez#q3",
          "kind": "apply",
          "prompt": "`revisar_enriquecimiento_ia` pide al juez un JSON con `coherente` (sí o no) y `motivo`. ¿Por qué es mejor que pedir una nota del 1 al 10?",
          "answer": "Porque es una pregunta cerrada con respuesta estructurada: da resultados más consistentes entre ejecuciones, se agrega fácil (porcentaje de incoherentes) y el motivo permite revisar los casos dudosos.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["pim/services/qa_fugas.py", "pim/management/commands/revisar_enriquecimiento_ia.py"],
      "resources": [
        {
          "title": "Define success criteria and build evaluations",
          "url": "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests",
          "provider": "Anthropic (documentación oficial)",
          "kind": "documentacion"
        }
      ]
    },
    {
      "id": "evo.senal_humana",
      "name": "Señal humana como eval",
      "aliases": ["feedback humano", "revisión humana", "human feedback"],
      "unitId": "evals.t2",
      "order": 10,
      "kind": "concepto",
      "difficulty": 2,
      "summary": "Lo que hacen las personas con las salidas del agente (aprobar, rechazar, editar) es una evaluación gratuita y continua si se guarda de forma aprovechable.",
      "intuition": "Las correcciones en rojo que un jefe hace a los borradores de un becario: si las guardas, sabes exactamente en qué falla y si mejora.",
      "definition": "Cuando una persona revisa lo que propone un agente deja **señal**: aprueba, rechaza o edita. Si se guarda la propuesta original junto a la versión final, se puede medir la tasa de aprobación sin cambios, cuánto se edita y en qué tipo de casos; y los casos editados son muy buenos candidatos para el conjunto de referencia. Es señal real y continua, pero sesgada: solo cubre lo que la gente revisa, y como lo revisa.\n\n**En FlipyERP:** `DraftRespuestaIA` (`soporte/models.py`) guarda `cuerpo_propuesto` y `cuerpo_editado` y un estado (`aprobado`, `rechazado`, `enviado`…). Esa información ya existe, pero no se aprovecha como métrica de calidad.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Guardar solo la versión final: se pierde qué cambió la persona.",
        "Tomar la tasa de aprobación como verdad absoluta: quien revisa con prisa aprueba cosas mejorables."
      ],
      "questions": [
        {
          "id": "evo.senal_humana#q1",
          "kind": "recall",
          "prompt": "¿Qué tres acciones de una persona sobre una propuesta del agente son señal de evaluación?",
          "answer": "Aprobarla tal cual, rechazarla o editarla antes de usarla.",
          "difficulty": 1
        },
        {
          "id": "evo.senal_humana#q2",
          "kind": "explain",
          "prompt": "¿Por qué hay que guardar la propuesta original además de la versión editada?",
          "answer": "Porque la diferencia entre las dos es la señal: dice qué corrigió la persona, cuánto y en qué casos. Con la versión final sola no se puede medir.",
          "difficulty": 2
        },
        {
          "id": "evo.senal_humana#q3",
          "kind": "apply",
          "prompt": "Con `DraftRespuestaIA`, ¿qué métrica sencilla podrías calcular hoy sin tocar el agente?",
          "answer": "El porcentaje de borradores aprobados o enviados sin cambios frente a los editados o rechazados, comparando `cuerpo_propuesto` con `cuerpo_editado` y mirando el estado.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["soporte/models.py"]
    },
    {
      "id": "evo.tests_vs_evals",
      "name": "Tests con el LLM simulado frente a evals",
      "aliases": ["tests unitarios", "mock del LLM", "tests vs evals"],
      "unitId": "evals.t2",
      "order": 11,
      "kind": "concepto",
      "difficulty": 2,
      "summary": "Los tests con el modelo simulado comprueban la fontanería del código; los evals, con el modelo real, comprueban la calidad de las respuestas. Hacen falta los dos.",
      "intuition": "Probar que el grifo, las tuberías y el desagüe funcionan no te dice si el agua es potable; para eso hay que analizar el agua.",
      "definition": "Un **test** sustituye al modelo por una respuesta fija (*mock*) y comprueba que el código hace lo correcto con ella: lee el JSON, pasa al plan B si la respuesta es mala, guarda los registros. Es rápido, gratis y determinista, y se ejecuta en cada commit. Un **eval** llama al modelo real con casos reales y mide si las respuestas son buenas; es más lento, cuesta dinero y se lanza al cambiar el prompt o el modelo. Un test en verde no dice nada de la calidad de las respuestas.\n\n**En FlipyERP:** los tests de `ai/tests_router_agentes.py` usan `unittest.mock.patch` para simular al modelo y comprueban, por ejemplo, que se limpian los bloques de código de la salida o que una respuesta degenerada activa el plan B. No hay evals que midan la calidad de las respuestas.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Pensar que unos tests en verde garantizan que el agente responde bien.",
        "Meter llamadas al modelo real en los tests de cada commit: son lentos, caros y sus resultados varían."
      ],
      "questions": [
        {
          "id": "evo.tests_vs_evals#q1",
          "kind": "distinguish",
          "prompt": "¿Qué comprueba un test con el LLM simulado y qué comprueba un eval?",
          "answer": "El test comprueba que el código maneja bien una respuesta dada (lectura, plan B, registros); el eval comprueba, con el modelo real, si las respuestas son buenas.",
          "difficulty": 1
        },
        {
          "id": "evo.tests_vs_evals#q2",
          "kind": "explain",
          "prompt": "¿Por qué los tests de cada commit no deberían llamar al modelo real?",
          "answer": "Porque serían lentos, costarían dinero y sus resultados variarían entre ejecuciones, así que fallarían sin que el código haya cambiado.",
          "difficulty": 2
        },
        {
          "id": "evo.tests_vs_evals#q3",
          "kind": "apply",
          "prompt": "Los tests de `ai/tests_router_agentes.py` están en verde. ¿Qué puedes afirmar y qué no?",
          "answer": "Que el router y la lectura de la salida manejan bien las respuestas simuladas. No que los agentes respondan bien con el modelo real: eso lo mediría un eval, que hoy no existe.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/tests_router_agentes.py"]
    }
```

- [ ] **Step 4: Añadir las relaciones del tema 2 a `relations`**

```json
    { "source": "evo.golden_set", "target": "evo.eval", "type": "requires", "reason": "El conjunto de referencia son los casos del eval." },
    { "source": "evo.criterios", "target": "evo.eval", "type": "requires", "reason": "Un criterio es la pieza del eval que decide si una salida es buena." },
    { "source": "evo.llm_juez", "target": "evo.criterios", "type": "requires", "reason": "El juez aplica una rúbrica escrita como criterio." },
    { "source": "evo.senal_humana", "target": "evo.eval", "type": "requires", "reason": "La revisión humana es un eval hecho por personas." },
    { "source": "evo.tests_vs_evals", "target": "evo.eval", "type": "requires", "reason": "Se distinguen a partir de qué mide un eval." }
```

- [ ] **Step 5: Ejecutar el test del tema 2**

Run: `node --import tsx --test --test-name-pattern="evals.t2" tests/evals-content.test.ts`
Expected: PASS.

- [ ] **Step 6: Validador y suite**

Run: `FLIPYERP_ROOT='D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1' node scripts/validate-content.cjs content`
Expected: `0 errores`; `"evals":11`.

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` y `npm run check`
Expected: solo fallan `evals.t3` y «están todas las relaciones».

- [ ] **Step 7: Commit**

```bash
cd /d/Claude/Projects/Atlas
git add atlas/content/evals.json
git commit -m "feat(academy): tema 2 «Evaluar» del Bloque 1 de evals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tema 3 · Cerrar el bucle

**Files:**
- Modify: `content/evals.json` (arrays `concepts` y `relations`)

**Interfaces:**
- Consumes: `evo.golden_set`, `evo.criterios` (tarea 3) y `evo.tokens_coste` (tarea 2) como targets de relaciones.
- Produces: `evo.version_prompt`, `evo.regresion`, `evo.salida_estructurada`, `evo.alertas` (orders 12–15). Con esto, el test completo y el validador quedan en verde.

- [ ] **Step 1: Confirmar que el test del tema 3 falla**

Run: `node --import tsx --test --test-name-pattern="evals.t3" tests/evals-content.test.ts`
Expected: FAIL.

- [ ] **Step 2: Releer los anclajes en FlipyERP**

```bash
cd /d/Claude/Projects/FlipyERP/FlipyERP_v1.0.1
grep -n "class AiPromptVersion\|system_prompt\|user_prompt_template\|modelo_llm = \|temperatura\|max_tokens\|activo = \|prompt_version" ai/models.py | head -12
grep -n "MODEL = " ai/services/chat_service.py
grep -rn "AiPromptVersion" --include=*.py . | grep -v "migrations\|admin.py\|models.py" | head
grep -n "response_format=JSON_SCHEMA_FICHA" pim/content_studio/batch_processor.py
grep -n "def parsear_json_llm\|return None" ai/agents/base.py | head -4
grep -rn "alerta_gasto_pct" --include=*.py . | grep -v migrations
grep -n "def enviar_telegram_ops\|def registrar_alerta" core/utils_alertas.py
```

Expected: `AiPromptVersion` con los campos citados y FK `prompt_version` en `AiTarea`; `MODEL = 'claude-sonnet-4-5'` en `ChatService`; ningún código que compare versiones de prompt; `response_format=JSON_SCHEMA_FICHA`; `parsear_json_llm` devuelve `None`; `alerta_gasto_pct` solo aparece en `models.py`, `mcp.py` (lectura) y un comando de alta de datos, nunca en una comprobación.

- [ ] **Step 3: Añadir los conceptos del tema 3 a `concepts`** (detrás de `evo.tests_vs_evals`)

```json
    {
      "id": "evo.version_prompt",
      "name": "Versionar prompts y modelo",
      "aliases": ["versionado de prompts", "prompt versioning", "AiPromptVersion"],
      "unitId": "evals.t3",
      "order": 12,
      "kind": "estructura",
      "difficulty": 2,
      "summary": "Guardar cada versión del prompt junto con el modelo y sus parámetros, y anotar en cada ejecución qué versión se usó, para poder comparar y volver atrás.",
      "intuition": "Las revisiones de una receta: si cambias la cantidad de sal y el plato empeora, necesitas saber cuál era la versión anterior y qué platos salieron con cada una.",
      "definition": "El comportamiento de un agente depende del **prompt de sistema**, de la **plantilla** del mensaje, del **modelo** y de parámetros como la temperatura. Versionar es guardar esas piezas juntas con un identificador, marcar cuál está activa y **enlazar cada ejecución con la versión** que la produjo. Así se puede atribuir un cambio de calidad o de coste, comparar versiones con el mismo eval y volver atrás sin adivinar.\n\n**En FlipyERP:** `AiPromptVersion` (`ai/models.py`) guarda `agente`, `version`, `system_prompt`, `user_prompt_template`, `modelo_llm`, `temperatura`, `max_tokens` y `activo`, y cada `AiTarea` apunta a su `prompt_version`. En cambio, `ChatService` (`ai/services/chat_service.py`) usa un modelo fijo en el código (`MODEL = 'claude-sonnet-4-5'`), fuera de ese versionado.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Versionar el texto del prompt pero no el modelo ni la temperatura: el cambio que importó puede estar ahí.",
        "Editar la versión activa en lugar de crear una nueva: se pierde con qué se generaron las salidas antiguas."
      ],
      "questions": [
        {
          "id": "evo.version_prompt#q1",
          "kind": "recall",
          "prompt": "¿Qué piezas hay que versionar juntas para reproducir el comportamiento de un agente?",
          "answer": "El prompt de sistema, la plantilla del mensaje, el modelo y los parámetros (temperatura, máximo de tokens).",
          "difficulty": 1
        },
        {
          "id": "evo.version_prompt#q2",
          "kind": "explain",
          "prompt": "¿Por qué cada ejecución debe guardar qué versión la produjo?",
          "answer": "Para poder atribuir cambios de calidad o de coste a una versión concreta, comparar versiones y saber qué salidas habría que revisar si una versión resulta mala.",
          "difficulty": 2
        },
        {
          "id": "evo.version_prompt#q3",
          "kind": "apply",
          "prompt": "Quieres probar otro modelo en el chat de FlipyERP. ¿Qué obstáculo encuentras?",
          "answer": "Que `ChatService` tiene el modelo fijo en el código (`MODEL`), fuera de `AiPromptVersion`: cambiarlo exige tocar el código, y las conversaciones no guardan con qué versión se hicieron.",
          "difficulty": 3
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/models.py", "ai/services/chat_service.py"]
    },
    {
      "id": "evo.regresion",
      "name": "Eval de regresión",
      "aliases": ["regresión", "regression eval", "comparar versiones"],
      "unitId": "evals.t3",
      "order": 13,
      "kind": "metodo",
      "difficulty": 3,
      "summary": "Antes de activar un cambio de prompt o de modelo, lanzar el mismo eval con la versión actual y con la nueva, y comparar caso a caso.",
      "intuition": "Antes de cambiar el proveedor de un ingrediente, cocinas el menú de prueba con el viejo y con el nuevo y los pruebas lado a lado.",
      "definition": "Un cambio que mejora unos casos puede empeorar otros. El **eval de regresión** ejecuta la versión actual y la candidata sobre el **mismo conjunto de referencia** y compara la nota global y, sobre todo, **qué casos pasan de bien a mal**. La candidata solo se activa si no empeora lo que importa, o si se acepta ese empeoramiento a sabiendas. Como el modelo no es determinista, conviene repetir cada caso varias veces o fijar la temperatura, para no confundir ruido con cambio.\n\n**En FlipyERP:** `AiPromptVersion` (`ai/models.py`) permite tener varias versiones por agente, pero no existe ningún código que las compare con un eval antes de activar una.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Mirar solo la nota global: una misma media puede esconder casos importantes que se han roto.",
        "Comparar con conjuntos distintos, o en días distintos, sin fijar las condiciones.",
        "Tomar una diferencia de un par de casos como mejora real sin repetir las ejecuciones."
      ],
      "questions": [
        {
          "id": "evo.regresion#q1",
          "kind": "recall",
          "prompt": "¿Qué se compara en un eval de regresión?",
          "answer": "La versión actual y la candidata sobre el mismo conjunto de referencia: la nota global y qué casos cambian de resultado.",
          "difficulty": 1
        },
        {
          "id": "evo.regresion#q2",
          "kind": "explain",
          "prompt": "¿Por qué no basta con que la nota global de la versión nueva sea igual o mejor?",
          "answer": "Porque puede mejorar casos poco importantes y romper otros críticos; hay que mirar qué casos pasan de bien a mal.",
          "difficulty": 2
        },
        {
          "id": "evo.regresion#q3",
          "kind": "apply",
          "prompt": "Vas a cambiar el modelo de un agente de FlipyERP que usa `AiPromptVersion`. Describe el proceso seguro.",
          "answer": "Crear una versión nueva con el modelo nuevo, sin tocar la activa; lanzar las dos sobre el mismo conjunto de referencia; revisar los casos que empeoran, y solo entonces marcar la nueva como activa.",
          "difficulty": 3
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/models.py"],
      "resources": [
        {
          "title": "Demystifying evals for AI agents",
          "url": "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents",
          "provider": "Anthropic Engineering",
          "kind": "articulo"
        }
      ]
    },
    {
      "id": "evo.salida_estructurada",
      "name": "Salida estructurada y validación",
      "aliases": ["structured outputs", "JSON schema", "validación de salida"],
      "unitId": "evals.t3",
      "order": 14,
      "kind": "metodo",
      "difficulty": 2,
      "summary": "Pedir al modelo la respuesta en un formato fijo, como JSON con esquema, y validarla antes de usarla, con un plan B si no cumple.",
      "intuition": "Un formulario con casillas en vez de una carta libre: es fácil ver si falta algo y el sistema puede leerlo sin interpretar.",
      "definition": "Cuando otro programa va a usar la respuesta, se pide en un **formato estructurado**, normalmente JSON que cumple un **esquema**. Hay dos niveles: forzarlo en la API (salidas estructuradas o `response_format` con esquema, que garantizan el formato) o pedirlo en el prompt y **validarlo** después. En los dos casos el código debe comprobar la salida antes de usarla y tener un plan B si no cumple: reintentar, cambiar de modelo o dejar el caso para revisión. La tasa de salidas inválidas es en sí una métrica que vigilar.\n\n**En FlipyERP:** `pim/content_studio/batch_processor.py` pasa `response_format=JSON_SCHEMA_FICHA` y reintenta en la nube si el JSON no se puede leer. La mayoría de agentes usan `parsear_json_llm` (`ai/agents/base.py`), que quita los bloques de código, busca el primer `{...}` y devuelve `None` si no hay JSON válido, sin comprobar ningún esquema.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Pedir JSON en el prompt y usarlo sin validar: tarde o temprano llega un campo que falta o texto alrededor.",
        "Validar solo que es JSON, no que tiene los campos y tipos esperados.",
        "Descartar en silencio las salidas inválidas en lugar de contarlas."
      ],
      "questions": [
        {
          "id": "evo.salida_estructurada#q1",
          "kind": "recall",
          "prompt": "¿Cuáles son las dos formas de conseguir una salida estructurada?",
          "answer": "Forzar el formato en la API con un esquema (salidas estructuradas, `response_format`) o pedirlo en el prompt y validarlo después en el código.",
          "difficulty": 1
        },
        {
          "id": "evo.salida_estructurada#q2",
          "kind": "distinguish",
          "prompt": "¿Qué diferencia hay entre comprobar que la salida es JSON y validarla contra un esquema?",
          "answer": "Que sea JSON solo dice que se puede leer; el esquema comprueba además que están los campos obligatorios con el tipo correcto.",
          "difficulty": 2
        },
        {
          "id": "evo.salida_estructurada#q3",
          "kind": "apply",
          "prompt": "`parsear_json_llm` devuelve `None`. ¿Qué debería pasar y qué conviene registrar?",
          "answer": "El agente debe aplicar su plan B (reintentar, cambiar de modelo o dejar el caso para revisión) y registrar que hubo una salida inválida, para vigilar la tasa de fallos de formato.",
          "difficulty": 2
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["pim/content_studio/batch_processor.py", "ai/agents/base.py"],
      "resources": [
        {
          "title": "Structured outputs",
          "url": "https://platform.claude.com/docs/en/build-with-claude/structured-outputs",
          "provider": "Anthropic (documentación oficial)",
          "kind": "documentacion"
        }
      ]
    },
    {
      "id": "evo.alertas",
      "name": "Alertas de gasto y de calidad",
      "aliases": ["alertas", "alerting", "presupuesto de IA"],
      "unitId": "evals.t3",
      "order": 15,
      "kind": "metodo",
      "difficulty": 2,
      "summary": "Avisar a una persona cuando el gasto, los errores o la calidad cruzan un umbral, en vez de descubrirlo al mirar un panel o la factura.",
      "intuition": "El aviso del banco cuando un cargo supera cierta cantidad: no tienes que revisar el extracto cada día para enterarte.",
      "definition": "Un panel solo sirve si alguien lo mira. Una **alerta** convierte una métrica en un aviso cuando cruza un **umbral**: el gasto del mes pasa del 80 % del presupuesto, se dispara la tasa de errores o de salidas inválidas, cae la tasa de aprobación humana. Las buenas alertas son pocas, accionables (dicen qué pasa y dónde mirar) y llegan por el canal que el equipo ya usa.\n\n**En FlipyERP:** `ConfiguracionModuloIA` (`ai/models.py`) tiene `limite_gasto_mes_usd` y `alerta_gasto_pct`, pero `alerta_gasto_pct` no se usa en ninguna comprobación. El canal ya existe: `enviar_telegram_ops` y `registrar_alerta` (`core/utils_alertas.py`) se usan para alertas de operaciones, no de IA.",
      "formulas": [],
      "example": null,
      "mistakes": [
        "Configurar umbrales que nadie comprueba: dan una falsa sensación de control.",
        "Alertar de todo: el equipo acaba ignorando los avisos.",
        "Mandar alertas sin contexto: hay que decir qué métrica, cuánto y dónde mirar."
      ],
      "questions": [
        {
          "id": "evo.alertas#q1",
          "kind": "recall",
          "prompt": "¿Qué convierte una métrica en una alerta?",
          "answer": "Un umbral y un aviso automático a una persona cuando la métrica lo cruza.",
          "difficulty": 1
        },
        {
          "id": "evo.alertas#q2",
          "kind": "explain",
          "prompt": "¿Qué hace que una alerta sea útil y no ruido?",
          "answer": "Que salte pocas veces, que sea accionable (qué pasa y dónde mirar) y que llegue por un canal que el equipo ya atiende.",
          "difficulty": 2
        },
        {
          "id": "evo.alertas#q3",
          "kind": "apply",
          "prompt": "Con lo que ya existe en FlipyERP, ¿qué faltaría para avisar cuando un módulo gasta el 80 % de su presupuesto mensual?",
          "answer": "Una tarea periódica que sume el coste del mes en `AiCosteLog` por módulo, lo compare con `limite_gasto_mes_usd` multiplicado por `alerta_gasto_pct` y, si lo supera, llame a `enviar_telegram_ops`. Los campos y el canal existen; falta esa lógica.",
          "difficulty": 3
        }
      ],
      "alsoIn": [],
      "syllabus": true,
      "sources": ["ai/models.py", "core/utils_alertas.py"]
    }
```

- [ ] **Step 4: Añadir las relaciones del tema 3 a `relations`**

```json
    { "source": "evo.regresion", "target": "evo.golden_set", "type": "requires", "reason": "La regresión repite el mismo conjunto con la versión nueva." },
    { "source": "evo.regresion", "target": "evo.version_prompt", "type": "requires", "reason": "Sin versiones no hay nada que comparar." },
    { "source": "evo.salida_estructurada", "target": "evo.criterios", "type": "requires", "reason": "Validar el esquema es el criterio determinista más barato." },
    { "source": "evo.alertas", "target": "evo.tokens_coste", "type": "requires", "reason": "Una alerta de gasto necesita el coste registrado." }
```

- [ ] **Step 5: Ejecutar el test completo del bloque**

Run: `node --import tsx --test tests/evals-content.test.ts`
Expected: PASS en los 8 tests.

- [ ] **Step 6: Validador con 0 errores y 0 avisos, y suite completa**

Run: `FLIPYERP_ROOT='D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1' node scripts/validate-content.cjs content`
Expected: `Conceptos por asignatura: {"fundamentos":7,"tenancy":12,"evals":15}` y `34 conceptos · 8 temas · 34 relaciones · 0 errores · 0 avisos`.

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` y `npm run check`
Expected: `fail 0` (186 tests previos + 8 nuevos = 194 pass); `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
cd /d/Claude/Projects/Atlas
git add atlas/content/evals.json
git commit -m "feat(academy): tema 3 «Cerrar el bucle» del Bloque 1 de evals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Comprobación en la app, estado y fusión

**Files:**
- Modify: `../CLAUDE.md` (sección «Estado» y «Siguiente»)

**Interfaces:**
- Consumes: el bloque completo de las tareas 1–4 en la rama `academy/bloque1-evals`.

- [ ] **Step 1: Levantar la academia en local contra el PostgreSQL de pruebas**

Comprobar que el contenedor sigue en marcha y arrancarlo si no:

```bash
docker start academy-pg
docker exec academy-pg pg_isready -U postgres
```

Expected: `accepting connections`. Arrancar el servidor de desarrollo con la configuración `academy-dev` de `D:\Claude\Projects\.claude\launch.json` (`preview_start` con nombre `academy-dev`), que usa `DATABASE_URL=postgres://postgres:dev@127.0.0.1:5435/postgres`.

- [ ] **Step 2: Recorrer el bloque como alumno del itinerario `desarrollo`**

Con el admin local (credenciales en el fichero `academy-local-creds.txt` del scratchpad de la sesión que montó el entorno; si no está, crear otro admin con `ACADEMY_PASSWORD=... node server/academy/cli.mjs bootstrap --org "Grupo Troviscal" --email admin.local@example.test --name "Admin local"`):
1. En `/admin`, cambiar el itinerario de `alumno.prueba@example.test` a «Desarrollador que se incorpora», o invitar a un alumno nuevo con ese itinerario.
2. Entrar como ese alumno; en «Asignaturas» aparece «Evals y observabilidad de agentes» (EVO, verde) junto a Fundamentos IA y Multi-empresa.
3. Abrir la ficha de `evo.traza`, `evo.eval` y `evo.regresion`: se ven la definición con el párrafo «En FlipyERP:», los errores habituales y el bloque de recursos con sus enlaces.
4. Estudiar un concepto de cada tema desde una sesión («Lo he estudiado»).

Expected: sin errores en la consola del navegador (`read_console_messages` con `onlyErrors`), y `/api/admin/overview` muestra el progreso del alumno.

- [ ] **Step 3: Actualizar el estado en `CLAUDE.md`**

En `D:\Claude\Projects\Atlas\CLAUDE.md`:
- En «Contenido (`content/`)», añadir tras la línea de `tenancy.json`:

```markdown
- `evals.json` — «Evals y observabilidad de agentes» (EVO, nivel 2, itinerarios
  desarrollo y avanzado), 15 conceptos en 3 temas: observar, evaluar, cerrar el
  bucle. Enfoque mixto: idea general y, cuando existe, cómo está en FlipyERP
  (con `sources`, incluidos los huecos actuales). Diseño y plan en `atlas/docs/superpowers/`.
```

- En «Siguiente», sustituir el punto 1 por:

```markdown
1. Contenido: apuntes largos por tema, constelaciones de herramientas
   (Git/GitHub, Python/Django) y de operaciones (Vendor Central, GPSR,
   supresión de búsqueda). Bloque 1 de evals hecho (2026-09-26), pendiente de
   desplegar con `deploy.sh`.
```

- En «Reglas», cambiar `(hoy 186/186)` por `(hoy 194/194)`.

- [ ] **Step 4: Verificación final y commit**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`, `npm run check` y el validador con `FLIPYERP_ROOT`.
Expected: `pass 194`, `fail 0`; `0 errores · 0 avisos`.

```bash
cd /d/Claude/Projects/Atlas
git add CLAUDE.md
git commit -m "docs(academy): estado tras el Bloque 1 de evals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Fusionar en `main` y subir**

```bash
cd /d/Claude/Projects/Atlas
git switch main
git merge --ff-only academy/bloque1-evals
git push origin main
git branch -d academy/bloque1-evals
```

Expected: fast-forward sin conflictos. No se despliega a producción en este plan: se hace con `deploy.sh` cuando Raul lo pida.
