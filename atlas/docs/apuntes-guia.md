# Apuntes de Atlas · guía de redacción

Apuntes propios por tema para preparar cada prueba (controles y parcial). Pensados para quien estudia solo y los usa como material principal. Objetivo: que con ellos se pueda sacar un 10.

## Dónde van

- Un fichero por tema: `content/apuntes/<asignatura>/<unidad>.md`, p. ej. `content/apuntes/logica/logica.t1.md`.
- Atlas los muestra en `#/apuntes/<unidad>` y los enlaza desde la prueba, la asignatura y la ficha del concepto.
- Se validan con `node scripts/validate-notes.cjs` (0 errores; los avisos se revisan uno a uno).

## Estructura

```
# Tema N · Título de la unidad            ← única línea con «# », la primera
Entradilla de 2–4 líneas: de qué va, por qué importa, qué te pedirán.

## <Sección>                              ← aparece en el índice lateral
### <Subsección>                          ← no uses ####
…
## Chuleta
## Ejercicios resueltos
## Antes del control
```

- **Secciones.** Una por concepto o grupo pequeño de conceptos del tema, en el orden del catálogo (`order`). Todos los conceptos de la unidad (`content/<asignatura>.json`, campo `unitId`) salen nombrados.
- **Cada sección:**
  - la definición precisa, en negrita la palabra definida;
  - la intuición, en 2 o 3 frases;
  - uno o más ejemplos resueltos paso a paso;
  - los errores típicos.
- **Llamadas.** Van como cita que empieza con un rótulo en negrita:
  - `> **Idea clave.** …`
  - `> **Error típico.** …`
  - `> **Truco de examen.** …`
  - `> **Ojo.** …`

  Pocas y valiosas.
- **Chuleta.** Lo que hay que saber de memoria: reglas, leyes y tablas, en tablas o listas cortas.
- **Ejercicios resueltos.** 4–6 ejercicios de nivel examen, de fácil a difícil. El último debe tener el nivel del simulacro de parcial B. Cada uno lleva enunciado, solución completa y justificada, y, cuando aporte, la idea que lo desbloquea.
- **Antes del control.** Una lista de 6–10 comprobaciones «Sé …» que cubran todo lo que puede pedir la prueba.

## Markdown que Atlas pinta

- Párrafos, **negrita**, *cursiva*, `código`, bloques ``` con lenguaje, citas `>` y separador `---`.
- Listas sin anidar. Una línea que empieza con dos espacios continúa el elemento anterior.
- Tablas con barras (`| a | b |` más una fila `|---|---|`). Dentro de las celdas puede haber fórmulas $…$.
- Fórmulas KaTeX: `$…$` en línea (sin espacio pegado a los dólares por dentro) y `$$…$$` en bloque, en su propia línea.
- **No** usar: HTML, imágenes, listas anidadas, `####` ni notas al pie.

## Contenido

- **Notación.** Exactamente la de las pruebas de la asignatura: lee el campo `rules` de los controles y del parcial en `content/trials/<asignatura>.json`. En Lógica eso fija:
  - las conectivas y su precedencia;
  - las reglas de deducción natural y su formato de tabla con «›»;
  - las reglas derivadas permitidas;
  - el código Gray en Karnaugh.
- **No reutilices problemas de las pruebas.** Las pruebas tienen que seguir siendo un examen honesto. El mismo tipo de ejercicio vale, pero con otros datos y otro enunciado.
- **Todo cálculo, verificado con código antes de escribirlo.** Tablas de verdad, equivalencias, formas normales, Karnaugh, tableaux, modelos y contraejemplos se comprueban con Python (itertools, sympy). Las deducciones se revisan línea a línea: qué regla, qué líneas y si el ámbito sigue abierto. Los scripts van al scratchpad, no al repo.
- **Nivel.** Universitario y riguroso, pensado para el 10: casos límite, sutilezas y los patrones difíciles de examen. Sin paja: cada párrafo tiene que ganarse su sitio.
- **Idioma.** Español de España, con todas las tildes, ñ y ¿¡, y tuteando. Terminología estándar de las universidades españolas, con el término inglés entre paréntesis la primera vez si es habitual. Sin emojis.
- **Extensión orientativa.** 2500–4500 palabras por tema; los temas densos pueden pasar de ahí.
- **Sin enlaces externos.** No se pueden verificar y caducan.
