# Apuntes largos · Bloque 1 de evals · diseño

Fecha: 2026-09-26 · Estado: aprobado en conversación, pendiente de revisión escrita.

## Objetivo

Escribir los apuntes largos de los 3 temas de la constelación `evals` y, de paso,
adaptar la guía y el validador de apuntes (heredados del Atlas original, pensados
para exámenes de un grado) a la academia, que no tiene pruebas. Es el piloto:
Fundamentos y Multi-empresa seguirán después con el mismo molde.

## Decisiones

- Empezar por Evals (contexto reciente; sirve para fijar el molde).
- **Sin código** en los apuntes: prosa, tablas, ejemplos narrados y chuletas.
- Enfoque A: guía adaptada a la academia, con secciones finales
  `## Chuleta`, `## Casos prácticos` y `## Antes de seguir`.

## Guía (`atlas/docs/apuntes-guia.md`)

Se reescribe para la academia.

**Se mantiene:**
- Un fichero por tema en `content/apuntes/<asignatura>/<unidad>.md`.
- Atlas los muestra en `#/apuntes/<unidad>` y los enlaza desde la asignatura y la ficha.
- Estructura de títulos: una sola `# Tema N · Título` en la primera línea, `##` por sección, `###` para subsecciones, nunca `####`.
- Llamadas como cita con rótulo en negrita (`> **Idea clave.**`, `> **Error típico.**`, `> **Ojo.**`), pocas y valiosas.
- El Markdown que pinta Atlas y lo que no (HTML, imágenes, listas anidadas, notas al pie).
- Idioma: español de España, con tildes, tuteando y sin emojis.
- Sin enlaces externos.

**Cambia:**
- **Objetivo:** entender cada concepto y saber aplicarlo en el trabajo diario con FlipyERP (no «sacar un 10»).
- **Estructura de cada tema:**
  - Entradilla de 2–4 líneas.
  - Una sección `##` por concepto (o grupo pequeño), en el orden del catálogo (`order`), nombrando todos los conceptos de la unidad. Cada una incluye:
    - la definición, con la palabra definida en negrita;
    - la intuición en 2–3 frases;
    - al menos un ejemplo narrado;
    - los errores típicos;
    - cuando el concepto tiene `sources`, un apartado `### En FlipyERP` que cita clases, campos y rutas reales, sin código, y describe los huecos como hechos.
  - `## Chuleta`: lo que conviene tener a mano, en tablas o listas cortas.
  - `## Casos prácticos`: 4–6 situaciones realistas de FlipyERP, de menos a más difíciles, cada una con planteamiento y solución razonada.
  - `## Antes de seguir`: 6–10 comprobaciones «Sé …» que cubran el tema.
- **Verificación:**
  - Todo número de un ejemplo (costes, percentiles, tasas) se calcula con un script en el scratchpad antes de escribirlo.
  - Todo apartado «En FlipyERP» se contrasta con el código de `FlipyERP_v1.0.1`.
  - Los precios de tokens se presentan como ilustrativos, no como tarifas vigentes.
- **Extensión orientativa:** 2000–3500 palabras por tema.
- **Se elimina:** lo específico de pruebas (`content/trials`, `rules`, «no reutilices problemas de las pruebas», «Ejercicios resueltos», «Antes del control», simulacros).

## Validador (`atlas/scripts/validate-notes.cjs`)

Único cambio: la lista de secciones obligatorias pasa de
`['Chuleta', 'Ejercicios resueltos', 'Antes del control']` a
`['Chuleta', 'Casos prácticos', 'Antes de seguir']`.
El resto (título, KaTeX, tildes, cobertura de conceptos, Markdown admitido) no cambia.

## Contenido

### `content/apuntes/evals/evals.t1.md` · Tema 1 · Observar un agente

- Entradilla: no se puede mejorar lo que no se ve; qué registrar de cada ejecución.
- Secciones: traza de una ejecución; tokens y coste por llamada; latencia y duración; auditar lo que hace el agente; errores del proveedor, reintentos y fallback.
- Ejemplos con números:
  - coste de una conversación del chat con varias vueltas de herramientas (tokens de entrada y salida acumulados, precios ilustrativos);
  - media frente a mediana y p95 en una serie de latencias.
- Chuleta: qué registrar de cada llamada; qué errores se reintentan y cuáles no; huecos actuales de FlipyERP.
- Casos prácticos:
  1. El chat va lento y no sabes por qué.
  2. La factura del proveedor sube y los informes de coste no cuadran (llamadas sin `tarea_id`).
  3. Una herramienta MCP falla pero figura como éxito.
  4. Un fallback silencioso empeora las respuestas.
  5. Diseñar qué debería guardar una traza completa del chat.

### `content/apuntes/evals/evals.t2.md` · Tema 2 · Evaluar

- Secciones: qué es un eval; conjunto de referencia y muestreo; criterios de evaluación; LLM como juez; señal humana como eval; tests con el LLM simulado frente a evals.
- Ejemplos con números:
  - eval de un clasificador de categorías del PIM de principio a fin: 40 casos estratificados, coincidencia exacta y lectura de resultados por grupo;
  - calibración de un juez LLM frente a personas con una tabla de coincidencias.
- Chuleta: qué criterio usar según el tipo de salida; preguntas para escribir una rúbrica.
- Casos prácticos:
  1. Diseñar el eval de las respuestas de soporte partiendo de `DraftRespuestaIA`.
  2. Elegir el criterio para tres agentes distintos.
  3. Un juez que prefiere respuestas largas.
  4. Tests en verde y usuarios que se quejan.

### `content/apuntes/evals/evals.t3.md` · Tema 3 · Cerrar el bucle

- Secciones: versionar prompts y modelo; eval de regresión; salida estructurada y validación; alertas de gasto y de calidad.
- Ejemplo con números: comparar la versión 3 con la 4 de un prompt caso a caso; la media mejora y se rompen dos casos críticos.
- Chuleta: proceso seguro para cambiar un prompt o un modelo; umbrales de alerta razonables.
- Casos prácticos:
  1. Cambiar el modelo del agente de soporte.
  2. Un 7 % de JSON inválidos.
  3. Montar la alerta del 80 % de gasto con lo que ya existe (`pct_limite_usado()`, `alerta_gasto_pct`, `enviar_telegram_ops`).
  4. El prompt «mejorado» que nadie probó.

Los hechos de FlipyERP que se citan son los ya verificados para las fichas del
Bloque 1 (diseño `2026-09-26-bloque1-evals-design.md` y `content/evals.json`),
contrastados de nuevo antes de escribir cada tema.

## Verificación

1. `node scripts/validate-notes.cjs`: 0 errores y 0 avisos en los 3 ficheros.
2. `npm test`, `npm run check` y `FLIPYERP_ROOT=… node scripts/validate-content.cjs content` en verde.
3. Pasada en local: `#/apuntes/evals.t1` pinta el índice lateral con las secciones, y la ficha de un concepto de evals enlaza a sus apuntes.

## Fuera de alcance

- Apuntes de Fundamentos y Multi-empresa (siguiente paso, mismo molde).
- Ejecutar `validate-notes` dentro de `deploy.sh`.
- Desplegar a producción (se hará cuando Raul lo pida).
