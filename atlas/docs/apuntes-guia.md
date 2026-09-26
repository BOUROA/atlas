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
