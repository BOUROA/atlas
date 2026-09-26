# Bloque 1 · Evals y observabilidad de agentes · diseño

Fecha: 2026-09-26 · Estado: aprobado en conversación, pendiente de revisión escrita.

## Objetivo

Nueva constelación de la academia que enseña a **observar** y **evaluar** agentes
de IA, con un enfoque mixto: cada concepto se explica en general y, cuando el
código de FlipyERP ya lo toca, termina con cómo se aplica allí (clases y rutas
reales, incluidos los huecos que hoy existen).

## Encaje en la academia

| Campo | Valor |
|---|---|
| `id` | `evals` |
| `name` / `shortName` / `abbr` | «Evals y observabilidad de agentes» / «Evals» / `EVO` |
| `level` | 2 |
| `track` | `ia` |
| `audience` | `["desarrollo"]` |
| `prerequisites` | `["fundamentos"]` |
| `year` / `semester` / `order` | 2 / 1 / 3 |
| `status` | `current` |
| `color` / `colorLight` | `#8FD3B6` / `#2E7A5B` |
| `file` | `evals.json` |
| `description` | Cómo saber qué hace un agente de IA y si lo hace bien: qué registrar de cada llamada, cómo construir evals y cómo usarlos para cambiar prompts y modelos sin romper nada. Con ejemplos del agente de FlipyERP. |

Itinerarios: se añade `evals` a `desarrollo` (tras `fundamentos`) y a
`avanzado`. No entra en `cero`. En `avanzado`, el cierre de prerrequisitos de
`catalog.mjs` añadirá `fundamentos` automáticamente.

Ids: temas `evals.t1`–`evals.t3`; conceptos `evo.<nombre>` (cumplen
`^[a-z]+\.[a-z0-9_]+$`).

## Temas y conceptos (15)

### Tema 1 · Observar un agente (`evals.t1`)

Resumen: qué dejar registrado de cada ejecución de un agente para poder
entender, depurar y pagar lo que hace.

| Id | Concepto | kind | Anclaje en FlipyERP (`sources`) |
|---|---|---|---|
| `evo.traza` | Traza de una ejecución | concepto | `ai/models.py` (`AiMensaje`: rol, `tool_name`, `tool_use_id`, `tool_input`), `ai/services/chat_service.py` |
| `evo.tokens_coste` | Tokens y coste por llamada | concepto | `ai/models.py` (`AiCosteLog`, `calcular_coste`), `ai/services/anthropic_client.py` (solo registra coste si recibe `tarea_id`) |
| `evo.latencia` | Latencia y duración | concepto | `ai/models.py` (`AiTarea.duracion_segundos`), `ai/services/chat_service.py` (no rellena `duracion_segundos`) |
| `evo.auditoria_herramientas` | Auditar lo que hace el agente | metodo | `core/mcp_middleware.py`, `core/models.py` (`MCPToolUsage`: `success` derivado del HTTP, sin argumentos), `core/mcp_write.py` |
| `evo.errores_proveedor` | Errores del proveedor, reintentos y fallback | metodo | `ai/services/llm_router.py`, `ai/services/anthropic_client.py` (la cabecera anuncia reintentos que no implementa) |

### Tema 2 · Evaluar (`evals.t2`)

Resumen: cómo medir si un agente lo hace bien: casos, criterios, jueces y la
señal que ya dejan las personas al revisar.

| Id | Concepto | kind | Anclaje |
|---|---|---|---|
| `evo.eval` | Qué es un eval | concepto | genérico |
| `evo.golden_set` | Conjunto de referencia y muestreo | estructura | `pim/services/qa_fugas.py` (muestreo estratificado) |
| `evo.criterios` | Criterios de evaluación | concepto | genérico (coincidencia exacta, reglas deterministas, rúbrica) |
| `evo.llm_juez` | LLM como juez | metodo | `pim/services/qa_fugas.py` (`es_fuga_descripcion`), `pim/management/commands/revisar_enriquecimiento_ia.py` |
| `evo.senal_humana` | Señal humana como eval | concepto | `soporte/models.py` (`DraftRespuestaIA`: propuesto frente a editado, aprobado/rechazado) |
| `evo.tests_vs_evals` | Tests con el LLM simulado frente a evals | concepto | `ai/tests_router_agentes.py` |

### Tema 3 · Cerrar el bucle (`evals.t3`)

Resumen: usar lo observado y lo evaluado para cambiar prompts y modelos con
seguridad y enterarse a tiempo cuando algo se tuerce.

| Id | Concepto | kind | Anclaje |
|---|---|---|---|
| `evo.version_prompt` | Versionar prompts y modelo | estructura | `ai/models.py` (`AiPromptVersion`) |
| `evo.regresion` | Eval de regresión | metodo | genérico; en FlipyERP no existe comparación entre versiones de `AiPromptVersion` |
| `evo.salida_estructurada` | Salida estructurada y validación | metodo | `pim/content_studio/batch_processor.py` (`response_format`), `ai/agents/base.py` (`parsear_json_llm`) |
| `evo.alertas` | Alertas de gasto y de calidad | metodo | `ai/models.py` (`ConfiguracionModuloIA`: `alerta_gasto_pct` sin uso; `gasto_mes_actual()` y `pct_limite_usado()` ya calculan el gasto), `core/utils_alertas.py` (`enviar_telegram_ops`) |

### Relaciones (`type: "requires"`)

| source | target | reason |
|---|---|---|
| `evo.auditoria_herramientas` | `evo.traza` | Auditar herramientas es registrar una parte concreta de la traza. |
| `evo.alertas` | `evo.tokens_coste` | Una alerta de gasto necesita el coste registrado. |
| `evo.criterios` | `evo.eval` | Un criterio es la pieza del eval que decide si una salida es buena. |
| `evo.llm_juez` | `evo.criterios` | El juez aplica una rúbrica escrita como criterio. |
| `evo.golden_set` | `evo.eval` | El conjunto de referencia son los casos del eval. |
| `evo.regresion` | `evo.golden_set` | La regresión repite el mismo conjunto con la versión nueva. |
| `evo.regresion` | `evo.version_prompt` | Sin versiones no hay nada que comparar. |
| `evo.senal_humana` | `evo.eval` | La revisión humana es un eval hecho por personas. |
| `evo.tests_vs_evals` | `evo.eval` | Se distinguen a partir de qué mide un eval. |
| `evo.latencia` | `evo.traza` | La duración de cada paso se lee en la traza. |
| `evo.errores_proveedor` | `evo.traza` | Un error o un fallback solo se ve si queda en la traza. |
| `evo.salida_estructurada` | `evo.criterios` | Validar el esquema es el criterio determinista más barato. |

Nota (plan de implementación): las tres últimas se añaden porque el validador
avisa de conceptos sin ninguna relación `requires`, y el objetivo es 0 avisos.

## Redacción de cada concepto

Mismo esquema que `tenancy.json`; no cambia el motor de Atlas.

- `summary`: una frase.
- `intuition`: analogía o imagen, sin FlipyERP.
- `definition`: la idea general en uno o dos párrafos. En los conceptos con
  anclaje, un último párrafo que empieza por «**En FlipyERP:**» y cita clases y
  rutas reales. Los huecos se describen como hechos («`ChatService` no rellena
  `duracion_segundos`»), sin juicios.
- `mistakes`: 2–3 errores habituales.
- `questions`: exactamente 3, ids `evo.<nombre>#q1..q3`, mezclando `recall`,
  `explain`, `distinguish` y `apply`. En los conceptos con hueco, una pregunta
  `apply` de diagnóstico sobre el caso real (p. ej. «¿Por qué `MCPToolUsage`
  puede marcar como éxito una llamada cuya herramienta falló?»).
- `formulas: []`, `example: null`, `alsoIn: []`, `syllabus: true`.
- `sources`: solo en conceptos con anclaje; rutas relativas a `FlipyERP_v1.0.1/`.
- `resources` (URLs comprobadas el 2026-09-26):
  - `evo.eval`, `evo.criterios`: «Define success criteria and build evaluations»,
    https://platform.claude.com/docs/en/test-and-evaluate/develop-tests, `documentacion`.
  - `evo.eval`, `evo.regresion`: «Demystifying evals for AI agents»,
    https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents, `articulo`.
  - `evo.llm_juez`: la misma página de `develop-tests` (sección de evaluación con LLM).
  - `evo.salida_estructurada`: «Structured outputs»,
    https://platform.claude.com/docs/en/build-with-claude/structured-outputs, `documentacion`.
  - `evo.traza`: «Building effective agents»,
    https://www.anthropic.com/engineering/building-effective-agents, `articulo`.
- Todo en español; sin `$` sueltos (KaTeX); sin datos de clientes ni credenciales.

## Ficheros

- Nuevo `atlas/content/evals.json` (`subjectId`, `units`, `concepts`, `relations`).
- `atlas/content/subjects.json`: nueva entrada `evals`.
- `atlas/content/itineraries.json`: `evals` en `desarrollo` y `avanzado`; sus
  descripciones se actualizan para mencionarlo.

## Verificación

1. `FLIPYERP_ROOT=D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1 node scripts/validate-content.cjs content`: 0 errores, 0 avisos.
2. Antes de escribir cada «En FlipyERP:», releer el fichero citado para confirmar
   que la clase, el campo o el hueco siguen siendo así.
3. `npm test` y `npm run check` en verde.
4. Pasada en local contra el PostgreSQL de pruebas: un alumno del itinerario
   `desarrollo` ve la constelación y estudia un concepto de cada tema.

## Fuera de alcance

- Apuntes largos por tema (`content/apuntes/`).
- Corregir en FlipyERP los huecos descritos (se pueden abrir como tareas aparte).
- Desplegar a producción: se hará con `deploy.sh` cuando Raul lo pida.
