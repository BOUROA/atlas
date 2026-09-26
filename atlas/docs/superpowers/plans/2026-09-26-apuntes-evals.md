# Apuntes largos · Bloque 1 de evals · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptar la guía y el validador de apuntes a la academia y escribir los apuntes largos de los 3 temas de `evals`.

**Architecture:** Solo Markdown en `content/apuntes/evals/` (Atlas ya los carga con `import.meta.glob` y los pinta en `#/apuntes/<unidad>`), la guía `docs/apuntes-guia.md` reescrita y una línea del validador `scripts/validate-notes.cjs`. No se toca el motor de Atlas.

**Tech Stack:** Markdown que pinta Atlas, `node scripts/validate-notes.cjs`, `npm test`.

Diseño: `docs/superpowers/specs/2026-09-26-apuntes-evals-design.md`.
Contenido de referencia de cada concepto: `content/evals.json` (fichas ya publicadas). Los apuntes amplían las fichas; no las contradicen.

## Global Constraints

- Directorio de trabajo `D:\Claude\Projects\Atlas\atlas`; repo git en `D:\Claude\Projects\Atlas`; rama `academy/apuntes-evals`.
- Commits en formato convencional, en español, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (esa línea exacta, sea cual sea el modelo que escribe).
- No editar ficheros con `Set-Content`/`Out-File` de PowerShell. UTF-8, finales de línea LF.
- Español de España, con todas las tildes, ñ y ¿¡, tuteando, sin emojis. Término inglés entre paréntesis la primera vez si es habitual.
- **Sin código** en los apuntes: ni bloques ``` ni fragmentos de programa. Los nombres de clases, campos, métodos y rutas sí van entre comillas invertidas (`AiCosteLog`, `ai/models.py`).
- **Sin `$`** en el texto (es KaTeX): los importes se escriben «0,045 USD». Sin HTML, imágenes, listas anidadas, `####` ni notas al pie. Sin enlaces externos.
- Estructura de cada tema:
  - Primera línea `# Tema N · Título` (única `# `).
  - Entradilla de 2–4 líneas.
  - Una `##` por concepto, en el orden del catálogo. Dentro: definición con la palabra definida en negrita, intuición en 2–3 frases, al menos un ejemplo narrado y errores típicos. En los conceptos con `sources`, una `### En FlipyERP`.
  - Al final, en este orden: `## Chuleta`, `## Casos prácticos` (cada caso como `### Caso N · título`) y `## Antes de seguir` (lista de comprobaciones que empiezan por «Sé»).
- Llamadas: `> **Idea clave.**`, `> **Error típico.**`, `> **Ojo.**`, `> **Truco.**`. Pocas: 3–6 por tema.
- Extensión: 2000–3500 palabras por tema (el validador imprime `~N palabras`).
- Los números de los ejemplos son **exactamente** los de este plan (verificados con script). No inventar cifras nuevas. Si hace falta una cifra adicional, calcularla con un script en el scratchpad y anotarla en el informe.
- Los precios por token son **ilustrativos** y así se dice en el texto.
- Hechos de FlipyERP: solo los que figuran en este plan o en `content/evals.json`. Antes de escribir cada `### En FlipyERP`, releer el fichero citado en `D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1`.
- Verificación por tema: `node scripts/validate-notes.cjs content/apuntes/evals/<unidad>.md` con `0 errores · 0 avisos`; `npm test` y `npm run check` en verde.

## Ficheros

| Fichero | Acción | Responsabilidad |
|---|---|---|
| `docs/apuntes-guia.md` | reescribir | Guía de redacción de apuntes de la academia. |
| `scripts/validate-notes.cjs:86` | modificar | Secciones obligatorias de la academia. |
| `content/apuntes/evals/evals.t1.md` | crear | Tema 1 · Observar un agente. |
| `content/apuntes/evals/evals.t2.md` | crear | Tema 2 · Evaluar. |
| `content/apuntes/evals/evals.t3.md` | crear | Tema 3 · Cerrar el bucle. |
| `../CLAUDE.md` | modificar | Estado y referencia a la guía. |

---

### Task 1: Guía y validador de apuntes para la academia

**Files:**
- Modify: `scripts/validate-notes.cjs` (línea con `for (const need of [...])`)
- Modify: `docs/apuntes-guia.md` (sustituir el contenido entero)

**Interfaces:**
- Produces: el validador exige `## Chuleta`, `## Casos prácticos` y `## Antes de seguir`. Las tareas 2–4 escriben contra esta guía.

- [ ] **Step 1: Comprobar el comportamiento actual con un fichero de prueba**

Crear en el scratchpad de la sesión (no en el repo) un fichero `evals.t1.md` dentro de una carpeta `evals`, con este contenido:

```markdown
# Tema 1 · Prueba

Entradilla.

## Traza de una ejecución

Texto.

## Chuleta

x

## Casos prácticos

x

## Antes de seguir

- Sé x.
```

Run (desde `atlas/`): `node scripts/validate-notes.cjs <ruta-scratchpad>/evals/evals.t1.md`
Expected: avisos `falta la sección «## Ejercicios resueltos»` y `falta la sección «## Antes del control»` (además de avisos de conceptos no nombrados).

- [ ] **Step 2: Cambiar las secciones obligatorias**

En `scripts/validate-notes.cjs`, sustituir:

```js
  for (const need of ['Chuleta', 'Ejercicios resueltos', 'Antes del control']) {
```

por:

```js
  for (const need of ['Chuleta', 'Casos prácticos', 'Antes de seguir']) {
```

Y en el comentario de cabecera del fichero no hay que tocar nada más.

- [ ] **Step 3: Volver a validar el fichero de prueba**

Run: el mismo comando del paso 1.
Expected: ya no aparecen avisos de secciones que faltan (siguen los de conceptos no nombrados, que son esperables en el fichero de prueba). Borrar el fichero de prueba del scratchpad.

- [ ] **Step 4: Reescribir `docs/apuntes-guia.md`**

Sustituir el contenido entero por:

````markdown
# Apuntes de FlipyERP Academy · guía de redacción

Apuntes propios por tema, más largos y razonados que las fichas de concepto. Pensados para quien estudia por su cuenta y quiere entender cada idea y saber aplicarla en el trabajo diario con FlipyERP.

## Dónde van

- Un fichero por tema: `content/apuntes/<asignatura>/<unidad>.md`, p. ej. `content/apuntes/evals/evals.t1.md`.
- Atlas los muestra en `#/apuntes/<unidad>` y los enlaza desde la asignatura y la ficha del concepto.
- Se validan con `node scripts/validate-notes.cjs` (objetivo: 0 errores y 0 avisos).

## Estructura

```
# Tema N · Título de la unidad            ← única línea con «# », la primera
Entradilla de 2–4 líneas: de qué va y por qué importa.

## <Concepto>                             ← aparece en el índice lateral
### En FlipyERP                           ← solo si el concepto tiene sources
…
## Chuleta
## Casos prácticos
### Caso 1 · <título>
…
## Antes de seguir
```

- **Secciones.** Una por concepto o grupo pequeño de conceptos del tema, en el orden del catálogo (`order`). Todos los conceptos de la unidad (`content/<asignatura>.json`, campo `unitId`) salen nombrados.
- **Cada sección:**
  - la definición precisa, con la palabra definida en negrita;
  - la intuición, en 2 o 3 frases;
  - al menos un ejemplo narrado;
  - los errores típicos;
  - si el concepto tiene `sources`, una subsección `### En FlipyERP` que cita clases, campos y rutas reales y describe los huecos como hechos, sin juicios.
- **Llamadas.** Van como cita que empieza con un rótulo en negrita. Pocas y valiosas:
  - `> **Idea clave.** …`
  - `> **Error típico.** …`
  - `> **Ojo.** …`
  - `> **Truco.** …`
- **Chuleta.** Lo que conviene tener a mano: reglas, criterios y listas de comprobación, en tablas o listas cortas.
- **Casos prácticos.** 4–6 situaciones realistas de FlipyERP, de menos a más difíciles. Cada una con el planteamiento y una solución razonada paso a paso.
- **Antes de seguir.** Una lista de 6–10 comprobaciones «Sé …» que cubran todo el tema.

## Markdown que Atlas pinta

- Párrafos, **negrita**, *cursiva*, `código en línea`, citas `>` y separador `---`.
- Listas sin anidar. Una línea que empieza con dos espacios continúa el elemento anterior.
- Tablas con barras (`| a | b |` más una fila `|---|---|`).
- Fórmulas KaTeX: `$…$` en línea y `$$…$$` en bloque. Por eso un `$` suelto rompe el texto: los importes se escriben «0,045 USD».
- **No** usar: HTML, imágenes, listas anidadas, `####` ni notas al pie.

## Contenido

- **Sin código.** Los apuntes explican con prosa, tablas y ejemplos narrados. Los nombres de clases, campos y rutas van en `código en línea`, pero no hay bloques de programa.
- **Todo número, verificado.** Costes, percentiles, tasas o porcentajes de los ejemplos se calculan con un script en el scratchpad antes de escribirlos. Los scripts no van al repo.
- **Todo hecho de FlipyERP, contrastado.** Antes de escribir un apartado «En FlipyERP», relee el fichero citado en `FlipyERP_v1.0.1`. Los precios de los proveedores se dan como ilustrativos.
- **Coherentes con las fichas.** Los apuntes amplían lo que dicen las fichas del concepto (`content/<asignatura>.json`); no las contradicen.
- **Nivel.** Riguroso y práctico: casos límite, sutilezas y situaciones reales. Sin paja: cada párrafo tiene que ganarse su sitio.
- **Idioma.** Español de España, con todas las tildes, ñ y ¿¡, y tuteando. Término inglés entre paréntesis la primera vez si es habitual. Sin emojis.
- **Extensión orientativa.** 2000–3500 palabras por tema.
- **Sin enlaces externos.** Caducan; los recursos externos van en las fichas.
````

- [ ] **Step 5: Verificar y commit**

Run (desde `atlas/`): `node scripts/validate-notes.cjs` → `0 ficheros · 0 errores · 0 avisos`; `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → `pass 194`, `fail 0`.

```bash
cd /d/Claude/Projects/Atlas
git add atlas/docs/apuntes-guia.md atlas/scripts/validate-notes.cjs
git commit -m "docs(academy): guía y validador de apuntes adaptados a la academia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Apuntes del tema 1 · Observar un agente

**Files:**
- Create: `content/apuntes/evals/evals.t1.md`

**Interfaces:**
- Consumes: guía y validador de la tarea 1; fichas `evo.traza`, `evo.tokens_coste`, `evo.latencia`, `evo.auditoria_herramientas`, `evo.errores_proveedor` de `content/evals.json`.

- [ ] **Step 1: Ver que el validador aún no tiene el fichero**

Run: `node scripts/validate-notes.cjs content/apuntes/evals/evals.t1.md`
Expected: error de fichero inexistente (ENOENT).

- [ ] **Step 2: Releer los anclajes en FlipyERP**

En `D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1`, leer: `ai/models.py` (`AiMensaje`, `AiCosteLog`, `AiTarea`), `ai/services/chat_service.py` (bucle de herramientas, `MODEL`, `MAX_TOOL_ITERATIONS`, cálculo de `duracion` y registro final de `AiCosteLog`), `ai/services/anthropic_client.py` (cabecera y `if tarea_id:`), `core/mcp_middleware.py` (`success`), `core/models.py` (`MCPToolUsage`), `core/mcp_write.py` (`_check_write_permission`, `_log_operation`), `ai/services/llm_router.py` (`ROUTING_TAREAS`, fallback).
Confirmar estos hechos (si alguno no se cumple, parar e informar):
- `ChatService` guarda cada paso como `AiMensaje` con `rol`, y las herramientas con `tool_name`, `tool_use_id`, `tool_input`; hasta `MAX_TOOL_ITERATIONS = 10`.
- `ChatService` acumula los tokens de todas las vueltas y crea **un** `AiCosteLog` por respuesta con `tarea=None` y sin `modulo`.
- `ChatService` calcula `duracion = time.time() - inicio` y no la guarda.
- `AnthropicService.completar` solo crea `AiCosteLog` si recibe `tarea_id`; la cabecera anuncia «Retry automatico con backoff» y no hay bucle de reintentos.
- `MCPToolUsage.success` = `200 <= status_code < 400`; no guarda argumentos.
- `SystemWriteToolset` exige admin o gestor y audita como `AiTarea(agente='mcp_write')` con `duracion_segundos=0`.

- [ ] **Step 3: Escribir `content/apuntes/evals/evals.t1.md`**

Título exacto: `# Tema 1 · Observar un agente`.

Entradilla: no se puede mejorar (ni pagar con conocimiento de causa) lo que no se ve; un agente encadena varias llamadas y herramientas, y este tema trata qué dejar registrado de cada ejecución y cómo leerlo.

Secciones, en este orden y con estos títulos `##`:

**`## Traza de una ejecución`**
- Definición de **traza**: registro ordenado y enlazado de cada paso (entrada, llamadas al modelo, herramientas pedidas con argumentos, resultados, respuesta final).
- Intuición: caja negra de un avión.
- Ejemplo narrado: la pregunta «¿cuántos pedidos de Amazon hay pendientes de enviar?» genera tres llamadas al modelo: la primera pide una herramienta de consulta, la segunda pide otra para afinar, la tercera responde. Mostrar la traza como tabla de pasos (paso, quién, qué, enlace por `tool_use_id`).
- Errores típicos: guardar solo pregunta y respuesta; no enlazar resultado con petición.
- `### En FlipyERP`: `AiMensaje` (`ai/models.py`) con `rol`, `tool_name`, `tool_use_id`, `tool_input`; `ChatService` (`ai/services/chat_service.py`) los crea en cada vuelta, hasta `MAX_TOOL_ITERATIONS = 10`.

**`## Tokens y coste por llamada`**
- Definición: tokens de entrada y de salida, precios distintos; coste = entrada × precio de entrada + salida × precio de salida.
- Intuición: factura de la luz desglosada por aparato.
- Ejemplo con números (precios **ilustrativos**: 3 USD por millón de tokens de entrada y 15 USD por millón de salida), la misma conversación del ejemplo de traza. Tabla:

  | Llamada | Entrada | Salida |
  |---|---|---|
  | 1 (pide herramienta) | 2800 | 120 |
  | 2 (pide otra herramienta) | 4420 | 90 |
  | 3 (responde) | 5110 | 350 |
  | Total | 12 330 | 560 |

  Explicar que la entrada crece porque cada llamada reenvía todo el historial (2800 = prompt de sistema y herramientas más la pregunta; +120 de la petición de herramienta y +1500 de su resultado; +90 y +600 en la siguiente).
  Coste: entrada 0,03699 USD, salida 0,0084 USD, total 0,04539 USD (unos 0,045 USD); la entrada es el 81,5 % del coste. A 1000 conversaciones así al mes: 45,39 USD.
- Idea clave: en agentes con herramientas manda la entrada, no la salida.
- Errores típicos: mirar solo la factura mensual; usar un único precio por token; dar por hecho que todo queda registrado.
- `### En FlipyERP`: `AiCosteLog` (`ai/models.py`) con `modelo_llm`, `modulo`, `tokens_input`, `tokens_output`, `coste_estimado_usd`; `calcular_coste` con tabla en código y caída a `ModeloIA` o al precio de Sonnet; `AnthropicService.completar` solo registra con `tarea_id`; `ChatService` registra un único `AiCosteLog` por respuesta, con `tarea=None` y sin `modulo`, así que el gasto del chat no se puede atribuir a un módulo.

**`## Latencia y duración`**
- Definición: latencia de cada llamada frente a duración total de la ejecución.
- Intuición: la espera del cliente en un restaurante.
- Ejemplo con números: 20 latencias de llamadas, en segundos: 1,8 · 2,1 · 1,9 · 2,4 · 2,0 · 2,2 · 1,7 · 2,3 · 2,1 · 1,9 · 2,0 · 2,6 · 2,2 · 1,8 · 2,5 · 2,1 · 9,8 · 2,0 · 14,5 · 2,3. Media 3,11 s; mediana 2,10 s; p95 (método del rango más cercano: posición 19 de 20 ordenadas) 9,8 s; media sin los dos lentos 2,11 s. Moraleja: la media no describe ni la llamada típica ni la lenta; la mediana dice lo típico y el p95 lo que sufre el 5 % más lento.
- Definir el p95 como el valor por debajo del cual queda el 95 % de las llamadas.
- Errores típicos: medir solo la media; no desglosar modelo y herramientas.
- `### En FlipyERP`: `AiTarea.duracion_segundos` y `AiMensaje.duracion_segundos` existen; `ChatService` calcula `duracion` y no la guarda.

**`## Auditar lo que hace el agente`**
- Definición: registrar por cada llamada a herramienta qué, quién (usuario y empresa), argumentos, duración y éxito real.
- Intuición: registro de entradas de un edificio.
- Ejemplo narrado: una herramienta de escritura cambia el estado de un pedido; qué debe quedar registrado para poder reconstruirlo una semana después.
- Ojo: en JSON-RPC un error de la herramienta puede ir dentro de una respuesta HTTP 200.
- Errores típicos: tomar el HTTP como éxito; no guardar argumentos; auditar igual lecturas y escrituras.
- `### En FlipyERP`: `MCPUsageMiddleware` (`core/mcp_middleware.py`) → `MCPToolUsage` (`core/models.py`) con usuario, empresa, `duration_ms`, `success` = `200 <= status_code < 400`, sin argumentos; `SystemWriteToolset` (`core/mcp_write.py`) exige admin o gestor y audita como `AiTarea(agente='mcp_write')` con `duracion_segundos=0`.

**`## Errores del proveedor, reintentos y fallback`**
- Definición: 429 (límite de uso), 529 (sobrecarga), 5xx y red (transitorios) se reintentan con espera creciente (*backoff*); 400 no. Fallback = pasar a otro modelo o proveedor al agotar reintentos.
- Intuición: la línea que comunica.
- Ejemplo narrado: una hora de saturación del proveedor; con reintentos sin espera se multiplica la carga; con backoff se recupera; con fallback registrado se sabe qué respuestas dio el modelo alternativo.
- Errores típicos: reintentar todo; reintentar sin espera; fallback sin registrar.
- `### En FlipyERP`: `LLMRouter` (`ai/services/llm_router.py`) elige proveedor por configuración y `ROUTING_TAREAS` y prueba otro si falla; `ai/services/anthropic_client.py` anuncia «Retry automatico con backoff» en la cabecera pero no implementa reintentos propios (dependen de los del SDK).

**`## Chuleta`**
- Tabla «Qué registrar de cada llamada»: entrada/salida o su referencia, modelo, versión de prompt, tokens de entrada y salida, coste, latencia, herramienta y argumentos, éxito real, usuario y empresa, fallback usado.
- Tabla «¿Se reintenta?»: 429 sí con espera · 529 sí con espera · 5xx y red sí con espera · 400 no · 401/403 no.
- Tabla «Huecos actuales de FlipyERP»: coste sin `tarea_id` no se guarda · chat sin `modulo` · latencia del chat no se guarda · `MCPToolUsage.success` según HTTP · sin argumentos en `MCPToolUsage` · reintentos anunciados sin implementar.

**`## Casos prácticos`**, con estos cinco casos (`### Caso N · título`), cada uno con planteamiento y solución razonada:
1. `### Caso 1 · El chat va lento` — Un usuario dice que el chat tarda. Solución: mirar la traza de esa conversación (`AiMensaje`) para ver cuántas vueltas de herramientas hubo; como la latencia por llamada no se guarda, lo que sí se puede ver es el número de pasos y las herramientas usadas; propuesta: guardar `duracion` en `duracion_segundos` y leer p50/p95, no la media.
2. `### Caso 2 · La factura sube y los informes no cuadran` — La factura del proveedor es mayor que la suma de `AiCosteLog`. Solución: llamadas por `AnthropicService.completar` sin `tarea_id` no dejan registro; además el chat no lleva `modulo`; cómo localizarlo (comparar por modelo y día, buscar llamadores sin `tarea_id`).
3. `### Caso 3 · Una herramienta falla pero figura como éxito` — Solución: `success` sale del código HTTP; en MCP el error puede ir en el cuerpo JSON-RPC con 200; qué habría que mirar para decidir el éxito real.
4. `### Caso 4 · Un fallback silencioso` — Durante una mañana las respuestas empeoran sin errores visibles. Solución: el router cambió de proveedor; sin registrar qué modelo respondió no se puede explicar; qué dato añadir a la traza.
5. `### Caso 5 · Diseñar la traza completa del chat` — Proponer qué campos debería guardar cada paso para responder a «qué pasó, cuánto costó, cuánto tardó y quién lo pidió». Solución: tabla de campos con qué existe ya y qué falta.

**`## Antes de seguir`** — entre 6 y 10 líneas que empiezan por «Sé», cubriendo: qué es una traza y qué recoge; calcular el coste de una llamada con precios de entrada y salida; por qué la entrada domina en agentes; mediana frente a media y qué es el p95; qué auditar de una herramienta; por qué el HTTP no basta como éxito; qué errores se reintentan; por qué registrar un fallback; los huecos de observabilidad de FlipyERP.

- [ ] **Step 4: Validar**

Run: `node scripts/validate-notes.cjs content/apuntes/evals/evals.t1.md`
Expected: `1 ficheros · 0 errores · 0 avisos` y entre ~2000 y ~3500 palabras. Comprobar también con `grep -c '\$' content/apuntes/evals/evals.t1.md` → `0` y `grep -c '^\`\`\`' content/apuntes/evals/evals.t1.md` → `0`.

- [ ] **Step 5: Commit**

```bash
cd /d/Claude/Projects/Atlas
git add atlas/content/apuntes/evals/evals.t1.md
git commit -m "feat(academy): apuntes del tema 1 de evals «Observar un agente»

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Apuntes del tema 2 · Evaluar

**Files:**
- Create: `content/apuntes/evals/evals.t2.md`

**Interfaces:**
- Consumes: guía de la tarea 1; fichas `evo.eval`, `evo.golden_set`, `evo.criterios`, `evo.llm_juez`, `evo.senal_humana`, `evo.tests_vs_evals` de `content/evals.json`.

- [ ] **Step 1: Ver que el validador aún no tiene el fichero**

Run: `node scripts/validate-notes.cjs content/apuntes/evals/evals.t2.md`
Expected: ENOENT.

- [ ] **Step 2: Releer los anclajes en FlipyERP**

En `D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1`, leer: `pim/services/qa_fugas.py` (`muestra_estratificada`, `es_fuga_descripcion`, `clasificar_producto`, `MODELO_CLASIFICADOR_DEFAULT`), `pim/management/commands/revisar_enriquecimiento_ia.py` (`--validar-descripciones`, JSON con `coherente` y `motivo`), `soporte/models.py` (`DraftRespuestaIA`: `cuerpo_propuesto`, `cuerpo_editado`, estados `generando`, `listo`, `aprobado`, `enviado`, `rechazado`, `error`; `modelo_usado`), `ai/tests_router_agentes.py` (`unittest.mock.patch`), y la existencia de `pim/management/commands/clasificar_categorias_ia.py`.
Confirmar (si algo no se cumple, parar e informar):
- `muestra_estratificada` toma al azar un número fijo de productos por estado.
- El juez de `qa_fugas` usa por defecto un modelo Haiku.
- `revisar_enriquecimiento_ia --validar-descripciones` pide `{"coherente": …, "motivo": …}` y se lanza a mano.
- `DraftRespuestaIA` tiene los campos y estados citados.

- [ ] **Step 3: Escribir `content/apuntes/evals/evals.t2.md`**

Título exacto: `# Tema 2 · Evaluar`.

Entradilla: observar dice qué pasó; evaluar dice si estuvo bien. Casos, criterios, jueces y la señal que ya dejan las personas.

Secciones `##`, en este orden:

**`## Qué es un eval`**
- Definición: casos, criterio y puntuación agregada; repetible. Criterios de éxito definidos antes de construirlo.
- Intuición: examen con plantilla de corrección.
- Ejemplo guiado de principio a fin (se retoma en las secciones siguientes): un eval del clasificador de categorías del PIM (en FlipyERP existe `pim/management/commands/clasificar_categorias_ia.py`; el eval es un ejercicio, no algo que exista). 40 casos, 10 por familia (Electrónica, Hogar, Cosmética, Juguetes), criterio de coincidencia exacta con la categoría revisada por una persona. Resultado: Electrónica 10/10, Hogar 9/10, Cosmética 6/10, Juguetes 9/10; total 34/40 = 85 %. Moraleja: el 85 % global esconde un 60 % en Cosmética.
- Errores típicos: probar a ojo; no definir criterios antes.

**`## Conjunto de referencia y muestreo`**
- Definición de **conjunto de referencia** (*golden set*): representativo, con casos difíciles y raros, revisado por personas, estable y versionado.
- Muestreo estratificado: al azar dentro de cada grupo. Con una muestra aleatoria simple de 40 productos, si Cosmética es el 5 % del catálogo, saldrían de media 2 casos: no bastan para ver su 60 %.
- Errores típicos: solo casos fáciles; cambiar el conjunto y comparar notas.
- `### En FlipyERP`: `muestra_estratificada` en `pim/services/qa_fugas.py` toma al azar un número fijo de productos de cada estado del catálogo.

**`## Criterios de evaluación`**
- Tres niveles: coincidencia exacta, reglas deterministas, rúbrica. Usar el más simple que mida lo que importa.
- Intuición: test, problemas, redacción.
- Ejemplo: tabla de tres salidas (categoría → coincidencia exacta; JSON de ficha → reglas: esquema, campos obligatorios, sin palabras prohibidas; respuesta de soporte → rúbrica).
- Cómo escribir una rúbrica útil: criterios concretos y comprobables (cita el número de pedido; no promete plazos; tono correcto), cada uno sí/no.
- Errores típicos: juez LLM para algo comprobable por código; rúbricas vagas.

**`## LLM como juez`**
- Definición: modelo que puntúa con rúbrica; mejor preguntas cerradas y salida estructurada con motivo.
- Calibración con números: 50 descripciones revisadas por personas y por el juez (etiqueta «incoherente» / «coherente»). Tabla 2×2: ambos incoherente 8; juez incoherente y persona coherente 4; juez coherente y persona incoherente 3; ambos coherente 35. Acuerdo 43/50 = 86 %. De las 11 que las personas marcan incoherentes, el juez detecta 8 (72,7 %). De las 12 que el juez marca, 8 lo son (66,7 %). Moraleja: un 86 % de acuerdo puede ocultar que se escapan 3 de 11 problemas.
- Sesgos: preferencia por respuestas largas, por su propio estilo; no usar el mismo modelo y prompt para generar y juzgar.
- `### En FlipyERP`: `es_fuga_descripcion` y `clasificar_producto` en `pim/services/qa_fugas.py` con Haiku por defecto; `revisar_enriquecimiento_ia --validar-descripciones` (`pim/management/commands/revisar_enriquecimiento_ia.py`) pide `coherente` y `motivo`; ambos se lanzan a mano, no son un eval automático.

**`## Señal humana como eval`**
- Aprobar, rechazar, editar; guardar propuesta y versión final; métricas: tasa de aprobación sin cambios, cuánto se edita, en qué casos; los casos editados alimentan el conjunto de referencia. Sesgos: solo lo revisado, revisión con prisa.
- `### En FlipyERP`: `DraftRespuestaIA` (`soporte/models.py`) con `cuerpo_propuesto`, `cuerpo_editado`, estados (`aprobado`, `enviado`, `rechazado`…) y `modelo_usado`; la información existe pero no se explota como métrica.

**`## Tests con el LLM simulado frente a evals`**
- Test: respuesta fija, comprueba el código, en cada commit, rápido y gratis. Eval: modelo real, comprueba la calidad, al cambiar prompt o modelo. Tabla comparativa (qué mide, cuándo, coste, determinismo).
- `### En FlipyERP`: `ai/tests_router_agentes.py` usa `unittest.mock.patch`; comprueba limpieza de bloques de código y el plan B ante respuestas degeneradas; no hay evals de calidad.

**`## Chuleta`**
- Tabla «Qué criterio usar»: clasificación o extracción → coincidencia exacta (normalizando); JSON o formato → reglas; texto libre → rúbrica (persona o juez calibrado).
- Lista «Para escribir una rúbrica»: criterios concretos; cada uno sí/no; ejemplos de sí y de no; probarla con dos personas.
- Lista «Para fiarte de un juez»: calibrarlo con una muestra humana; mirar lo que se le escapa, no solo el acuerdo; salida estructurada con motivo; revisar una muestra cada cierto tiempo.

**`## Casos prácticos`**:
1. `### Caso 1 · El eval de las respuestas de soporte` — Diseñarlo con `DraftRespuestaIA`: casos a partir de borradores editados y rechazados (estratificando por intención), criterio con rúbrica de 4–5 puntos sí/no, métrica de partida: tasa de enviados sin cambios.
2. `### Caso 2 · Tres agentes, tres criterios` — Clasificador de categorías, extractor de facturas, redactor de descripciones: elegir y justificar el criterio de cada uno.
3. `### Caso 3 · Un juez que prefiere lo largo` — El juez aprueba más las descripciones largas aunque las personas no. Cómo detectarlo (calibración por longitud) y corregirlo (rúbrica cerrada, pedir motivo, penalizar relleno).
4. `### Caso 4 · Tests en verde y usuarios que se quejan` — Por qué ocurre (los tests simulan el modelo) y qué añadir (un eval con casos de las quejas).

**`## Antes de seguir`** — entre 6 y 10 líneas «Sé …»: las tres piezas de un eval; por qué estratificar; calcular aciertos por grupo; elegir criterio según la salida; escribir una rúbrica útil; calibrar un juez y leer una tabla 2×2; aprovechar la señal humana; distinguir test y eval; qué hay y qué falta en FlipyERP.

- [ ] **Step 4: Validar**

Run: `node scripts/validate-notes.cjs content/apuntes/evals/evals.t2.md` → `0 errores · 0 avisos`, ~2000–3500 palabras; `grep -c '\$'` → `0`; `grep -c '^\`\`\`'` → `0`.

- [ ] **Step 5: Commit**

```bash
cd /d/Claude/Projects/Atlas
git add atlas/content/apuntes/evals/evals.t2.md
git commit -m "feat(academy): apuntes del tema 2 de evals «Evaluar»

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Apuntes del tema 3 · Cerrar el bucle

**Files:**
- Create: `content/apuntes/evals/evals.t3.md`

**Interfaces:**
- Consumes: guía de la tarea 1; fichas `evo.version_prompt`, `evo.regresion`, `evo.salida_estructurada`, `evo.alertas` de `content/evals.json`.

- [ ] **Step 1: Ver que el validador aún no tiene el fichero**

Run: `node scripts/validate-notes.cjs content/apuntes/evals/evals.t3.md` → ENOENT.

- [ ] **Step 2: Releer los anclajes en FlipyERP**

En `D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1`, leer: `ai/models.py` (`AiPromptVersion`, `AiTarea.prompt_version`, `ConfiguracionModuloIA` con `limite_gasto_mes_usd`, `alerta_gasto_pct`, `gasto_mes_actual()`, `pct_limite_usado()`, `limite_alcanzado()`), `ai/services/chat_service.py` (`MODEL`), `soporte/ia/generator.py` (`_resolver_modelo('soporte', …)` lee `ConfiguracionModuloIA`; el borrador guarda `modelo_usado`), `pim/content_studio/batch_processor.py` (`response_format=JSON_SCHEMA_FICHA` y reintento en la nube), `ai/agents/base.py` (`parsear_json_llm`), `core/utils_alertas.py` (`enviar_telegram_ops`, `registrar_alerta`).
Confirmar (si algo no se cumple, parar e informar):
- `alerta_gasto_pct` es un entero (80 por defecto) y no se usa en ninguna comprobación.
- `pct_limite_usado()` devuelve `min(100, round(gasto_mes_actual() / limite * 100, 1))`, o 0 sin límite.
- El modelo del agente de soporte sale de `ConfiguracionModuloIA` del módulo `soporte` y cada borrador guarda `modelo_usado`.

- [ ] **Step 3: Escribir `content/apuntes/evals/evals.t3.md`**

Título exacto: `# Tema 3 · Cerrar el bucle`.

Entradilla: con lo observado y lo evaluado se cambian prompts y modelos sin romper nada, y se avisa a tiempo cuando algo se tuerce.

Secciones `##`, en este orden:

**`## Versionar prompts y modelo`**
- Qué se versiona junto (prompt de sistema, plantilla, modelo, temperatura, máximo de tokens), versión activa, cada ejecución enlazada a su versión; nunca editar la activa.
- Intuición: revisiones de una receta.
- `### En FlipyERP`: `AiPromptVersion` (`ai/models.py`) con `agente`, `version`, `system_prompt`, `user_prompt_template`, `modelo_llm`, `temperatura`, `max_tokens`, `activo`; `AiTarea.prompt_version`. `ChatService` usa `MODEL = 'claude-sonnet-4-5'` fijo en el código. El agente de soporte toma el modelo de `ConfiguracionModuloIA` (`soporte/ia/generator.py`) y cada `DraftRespuestaIA` guarda `modelo_usado`.

**`## Eval de regresión`**
- Misma batería con la versión actual y la candidata; nota global y, sobre todo, casos que pasan de bien a mal; repetir ejecuciones (bajar la temperatura reduce la variación, no la elimina).
- Ejemplo con números: 30 casos. Versión 3: 24 bien (80,0 %). Versión 4: 26 bien (86,7 %). Detalle: 4 casos pasan de mal a bien y 2 de bien a mal; esos 2 son críticos (una devolución fuera de plazo que la v4 acepta y una factura rectificativa mal clasificada). Tabla de transiciones (bien→bien 22, mal→bien 4, bien→mal 2, mal→mal 2). Moraleja: la media sube y aun así la v4 no debe activarse sin arreglar esos dos.
- Errores típicos: solo la media; conjuntos o condiciones distintas; tomar diferencias pequeñas como mejora sin repetir.
- `### En FlipyERP`: `AiPromptVersion` permite varias versiones por agente, pero no hay código que las compare con un eval antes de activarlas.

**`## Salida estructurada y validación`**
- Forzar en la API con esquema o pedir en el prompt y validar; validar campos y tipos, no solo que sea JSON; plan B; contar las salidas inválidas.
- Ejemplo con números: 1000 fichas al día con un 7 % de JSON inválidos = 70; un reintento arregla 56 (el 80 %); quedan 14 (1,4 %) que van a revisión.
- `### En FlipyERP`: `pim/content_studio/batch_processor.py` usa `response_format=JSON_SCHEMA_FICHA` y reintenta en la nube; `parsear_json_llm` (`ai/agents/base.py`) quita bloques de código, busca el primer objeto y devuelve `None` sin comprobar esquema.

**`## Alertas de gasto y de calidad`**
- Umbral + aviso; pocas, accionables, por el canal habitual; ejemplos de métricas (gasto, errores, inválidos, aprobación humana).
- Ejemplo con números: límite de 200 USD al mes y `alerta_gasto_pct` 80 → umbral de 160 USD; con 163,40 USD gastados, `pct_limite_usado()` devuelve 81,7 y la alerta debería saltar.
- `### En FlipyERP`: `ConfiguracionModuloIA` (`ai/models.py`) con `limite_gasto_mes_usd`, `alerta_gasto_pct` (porcentaje, 80 por defecto), `gasto_mes_actual()`, `pct_limite_usado()` y `limite_alcanzado()`; `alerta_gasto_pct` no se usa en ninguna comprobación; el canal existe: `enviar_telegram_ops` y `registrar_alerta` (`core/utils_alertas.py`).

**`## Chuleta`**
- Lista numerada «Cambiar un prompt o un modelo con seguridad»: crear versión nueva sin tocar la activa → lanzar la misma batería con las dos → revisar los casos que empeoran → repetir si las diferencias son pequeñas → activar → vigilar la señal humana y las alertas los días siguientes → poder volver a la anterior.
- Tabla «Umbrales de alerta razonables» (ilustrativos): gasto mensual ≥ 80 % del límite; tasa de salidas inválidas por encima de la habitual (p. ej. > 2 %); tasa de errores del proveedor en una hora; caída de la aprobación humana sin cambios de más de 10 puntos respecto a la semana anterior.

**`## Casos prácticos`**:
1. `### Caso 1 · Cambiar el modelo del agente de soporte` — El modelo se cambia en `ConfiguracionModuloIA` sin tocar código, pero no hay `AiPromptVersion` ni eval previo. Solución: eval con borradores reales (tema 2), comparar tasa de enviados sin cambios antes y después filtrando por `modelo_usado`, y poder volver atrás.
2. `### Caso 2 · Un 7 % de JSON inválidos` — Diagnóstico y plan: forzar esquema en la API donde se pueda, validar campos y tipos, reintento, cola de revisión, métrica y alerta (usar las cifras 70 → 14).
3. `### Caso 3 · La alerta del 80 % con lo que ya existe` — Tarea periódica que, para cada `ConfiguracionModuloIA`, compare `pct_limite_usado()` con `alerta_gasto_pct` y llame a `enviar_telegram_ops`; qué poner en el mensaje; cómo evitar que se repita cada hora (avisar una vez por mes y umbral). Recordar que el chat registra coste sin `modulo`, así que no entra en ese cálculo.
4. `### Caso 4 · El prompt «mejorado» que nadie probó` — Alguien edita la versión activa. Qué se pierde (con qué se generaron las salidas antiguas) y cómo reconducirlo (versión nueva, regresión, activación).

**`## Antes de seguir`** — entre 6 y 10 líneas «Sé …»: qué se versiona junto; por qué no editar la versión activa; montar y leer una regresión con tabla de transiciones; por qué la media no basta; forzar frente a validar la salida; calcular el efecto de un reintento; qué hace buena a una alerta; montar la alerta de gasto con lo que existe en FlipyERP; el proceso seguro para cambiar un modelo.

- [ ] **Step 4: Validar**

Run: `node scripts/validate-notes.cjs content/apuntes/evals/evals.t3.md` → `0 errores · 0 avisos`, ~2000–3500 palabras; `grep -c '\$'` → `0`; `grep -c '^\`\`\`'` → `0`.

- [ ] **Step 5: Commit**

```bash
cd /d/Claude/Projects/Atlas
git add atlas/content/apuntes/evals/evals.t3.md
git commit -m "feat(academy): apuntes del tema 3 de evals «Cerrar el bucle»

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Comprobación en la app, estado y fusión

**Files:**
- Modify: `../CLAUDE.md`

- [ ] **Step 1: Validación conjunta**

Run (desde `atlas/`): `node scripts/validate-notes.cjs` → `3 ficheros · 0 errores · 0 avisos`; `npm test` → `pass 194`, `fail 0`; `npm run check` limpio; `FLIPYERP_ROOT='D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1' node scripts/validate-content.cjs content` → `0 errores · 0 avisos`.

- [ ] **Step 2: Pasada en local**

Con el contenedor `academy-pg` en marcha y el servidor `academy-dev` (ver CLAUDE.md), entrar como el alumno de prueba del itinerario `desarrollo` y abrir `#/apuntes/evals.t1`, `#/apuntes/evals.t2` y `#/apuntes/evals.t3`: el índice lateral muestra las secciones, las tablas se pintan y no hay errores en consola. Desde la ficha de `evo.traza`, comprobar que hay enlace a los apuntes del tema.

- [ ] **Step 3: CLAUDE.md**

En `D:\Claude\Projects\Atlas\CLAUDE.md`:
- En «Contenido (`content/`)», sustituir la línea «sin `$` sueltos (es KaTeX). Guía de apuntes: `docs/apuntes-guia.md`.» por «sin `$` sueltos (es KaTeX). Apuntes largos por tema en `content/apuntes/<asignatura>/<unidad>.md` según `docs/apuntes-guia.md` (adaptada a la academia: sin código, `Chuleta`, `Casos prácticos`, `Antes de seguir`), validados con `node scripts/validate-notes.cjs`. Hechos: los 3 temas de evals.»
- En «Siguiente», en el punto 1 sustituir «apuntes largos por tema,» por «apuntes largos de Fundamentos y Multi-empresa (los de evals están hechos),».

Commit:

```bash
cd /d/Claude/Projects/Atlas
git add CLAUDE.md
git commit -m "docs(academy): estado tras los apuntes de evals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Fusionar en `main` y subir**

```bash
cd /d/Claude/Projects/Atlas
git switch main
git merge --ff-only academy/apuntes-evals
git push origin main
git branch -d academy/apuntes-evals
```

No se despliega a producción en este plan.
