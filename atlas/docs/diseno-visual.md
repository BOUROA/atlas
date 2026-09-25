# Atlas v2 · Sistema visual «Observatorio»

Dirección elegida el 24-09-2026 entre tres maquetas. Referencia principal: `docs/maquetas/observatorio.html` (+ `observatorio.png`). Las maquetas `cuaderno.*` y `estudio.*` solo aportan los injertos citados abajo.

## Idea

El conocimiento es **un cielo nocturno que vas encendiendo**. Cada concepto es una **estrella**: brilla cuando la dominas y se atenúa hacia azul escarcha cuando dejas de repasarla. Cada asignatura es una **constelación**; el mapa es una **carta celeste**. Los exámenes de élite son **misiones**; las leyendas y los perfiles destacados son **estrellas guía**, cada una con su propia constelación de conceptos que puedes trazar en tu cielo.

Principios: calma nocturna para estudiar muchas horas · una sola acción protagonista por pantalla (dorada) · cada número dice algo · la gamificación recompensa el esfuerzo sin infantilizar · nada de avisos de cautela.

## Tokens

### Tema principal: «Observatorio» (oscuro, por defecto)

```css
--ink-0:#070B18; --ink-1:#0B1122; --ink-2:#111A31; --ink-3:#18223D;   /* fondo → superficies elevadas */
--line:rgba(170,188,235,.10); --line-2:rgba(170,188,235,.18);
--text:#ECE6D6; --text-2:#A9B1C9; --text-3:#6C7594; --text-4:#454E6C;  /* text-4 solo decorativo */
--gold:#F3B64A; --gold-hi:#FFD68A; --gold-lo:#B7802A; --gold-ink:#1C1405; /* acción, XP, dominio */
--frost:#8DB4E8;   /* se enfría / escarcha */
--ember:#F08A6C;   /* urgencia: examen cercano, fallo */
--star:#FFF6E4;    /* núcleo de estrella encendida */
```

### Tema secundario: «Carta impresa» (claro)

Una carta celeste antigua impresa en papel: fondo pergamino, tinta azul noche, oro viejo. Mismos nombres de variables:

```css
--ink-0:#EFE8D8; --ink-1:#F6F0E2; --ink-2:#FBF7EE; --ink-3:#FFFFFF;
--line:rgba(20,30,60,.12); --line-2:rgba(20,30,60,.22);
--text:#141C33; --text-2:#3D4766; --text-3:#626C8A; --text-4:#9AA0B4;
--gold:#A8741C; --gold-hi:#C8912E; --gold-lo:#7A5210; --gold-ink:#FFF8E8;
--frost:#4E77AE; --ember:#B8452D; --star:#1C1405;
```

### Asignaturas (`var(--s-<id>)`, abreviatura)

| id | Abrev. | Observatorio | Carta impresa |
|---|---|---|---|
| ia | IAC | #BFA2F2 | #6E4FB0 |
| calculo | CAL | #6FD5C8 | #1E8A7E |
| logica | LOG | #97AAFB | #4058B8 |
| algebra | ALG | #95D69A | #3E8A45 |
| programacion | FPR | #F6A98C | #B9573A |
| algoritmia | ALC | #D2D67C | #7C8020 |
| estructuras | EDA | #74C3EC | #2A7BAE |
| computacion | TC | #E59BD8 | #A04A93 |
| operativos | MOE | #F4A3B5 | #B04C66 |
| preprocesamiento | PMD | #E8C79A | #946126 |

Los colores de asignatura se usan en puntos, carriles, estrellas y etiquetas; nunca como fondo grande.

### Tipografía

- `--serif: 'Cormorant Garamond'` — titulares, cifras grandes, nombres de estrella/concepto destacados, cursivas del tutor ("Hoy puedes encender *seis estrellas nuevas*").
- `--sans: 'Hanken Grotesk'` — interfaz y texto.
- `--mono: 'DM Mono'` — etiquetas en versalitas espaciadas (11 px, `letter-spacing:.14em`, mayúsculas), cifras tabulares, tiempos.
- Paquetes locales: `@fontsource/cormorant-garamond` (500, 600, 700 + cursivas), `@fontsource-variable/hanken-grotesk`, `@fontsource/dm-mono`.
- Escala: 12 · 13 · 14 · 16 (cuerpo) · 18 · 22 · 28 · 40 · 56 (titular Hoy). Texto legible ≥ 13 px.

### Forma, profundidad y movimiento

- Radios: 8 px (chips), 12 px (controles), 20 px (tarjetas). Bordes 1 px `--line`. Tarjetas en `--ink-2` con borde `--line` y un brillo interior sutil (`inset 0 1px 0 rgba(255,255,255,.04)`).
- Fondo: cielo `--ink-1` con **campo de estrellas** muy tenue (puntos de 1 px a opacidades 0,15–0,5, generado una vez con semilla fija) y un leve gradiente radial hacia `--ink-0` en los bordes. En el tema claro, retícula de coordenadas fina (líneas de ascensión/declinación) en `--line`.
- Brillos: solo en lo que importa (estrellas dominadas, botón principal, nivel). `filter: drop-shadow` o `box-shadow` dorado suave; nada de neón.
- Movimiento: `--dur-fast:120ms; --dur:220ms; --dur-slow:420ms; --ease:cubic-bezier(.2,.7,.2,1)`. Titileo muy lento (6–9 s) en estrellas de hoy. Respetar `prefers-reduced-motion`.

## Componentes clave

- **Tarjeta protagonista "Sesión de hoy"**: `--ink-2` con borde dorado tenue, cifras enormes en serif (repasos + nuevos), **anillo de tiempo** (arco dorado sobre carril tenue con la hora de fin prevista), barra segmentada por asignatura, botón **Empezar sesión** dorado (texto `--gold-ink`) con atajo visible.
- **Estrella** (`Star`): el átomo visual. Estados: *sin ver* (punto `--text-4` de 2 px) · *visto* (estrella pequeña del color de su asignatura, sin halo) · *lo entiendo* (estrella brillante con núcleo `--star`) · *lo domino* (brillante + halo dorado + destello de 4 puntas) · *se enfría* (desaturada hacia `--frost` con anillo punteado) · *hoy* (titileo + etiqueta `HOY`) · *bloqueada* (contorno tenue con candado mini) · *siguiente* (etiqueta `SIGUIENTE`).
- **Insignia** (`Badge`, logros): medallón circular con icono lineal (lucide) dentro de un anillo con marcas de reloj astronómico; conseguida en dorado, bloqueada en `--text-4` con la condición.
- **Nivel y rango**: medallón con el icono del rango, "Nivel N", nombre del rango en mono dorado, barra de XP con el tramo ganado hoy y la previsión de la sesión en rayado dorado claro; **camino de rangos** (6–10 hitos con icono) debajo.
- **Anillos y barras**: dominio y frescura por asignatura como dos barras finas (dominio en color de asignatura, frescura en `--frost`→`--gold`); preparación de exámenes como barra con porcentaje.
- **Chips de motivo** en la cola: icono lucide + texto; el principal resaltado (`--ember` si es examen, `--frost` si se enfría, color de asignatura si es "lo necesitarás en", `--gold` si "desbloquea").
- **Mapa de actividad**: puntos (no cuadrados) cuyo tamaño y brillo crecen con los minutos, como un campo de estrellas; hoy con anillo dorado; comodín con icono de luna.

## Carta celeste (mapa)

- Fondo de cielo con campo de estrellas y, en el tema claro, retícula de coordenadas.
- **Franjas** horizontales por asignatura (nombre en serif y color a la izquierda, con % encendido); x = profundidad de requisitos (bases a la izquierda).
- **Zoom lejano**: cada asignatura es una **constelación** — sus temas como estrellas mayores unidas por líneas finas, con nombre y % encendido; los enlaces entre asignaturas como arcos tenues.
- **Zoom medio/cercano**: estrellas = conceptos (radio según impacto); líneas de constelación = relaciones `requires` en trazo fino (`--line-2`); las que cruzan de franja en discontinuo del color de destino.
- Selección: se enciende la ruta hacia atrás (bases) y hacia delante (lo que desbloquea) en dorado animado; el resto se atenúa al 25 %; las franjas alcanzadas muestran cuántos conceptos dependen.
- Avisos del tutor anclados (cursiva serif con icono de alerta): "Autovalores llega tarde: Preprocesamiento ya lo necesita — te lo adelanto".
- Lente **Estrella guía**: dibuja en dorado la constelación de una leyenda o perfil sobre tu cielo.
- Tira inferior "Hoy se encienden": chips de la sesión con su transición (1 → 2).

## Gamificación: nombres

Rangos (cada 5 niveles): Polvo estelar (1–5) · Nebulosa (6–10) · Protoestrella (11–15) · Estrella (16–20) · Gigante (21–25) · Supergigante (26–30) · Púlsar (31–35) · Cúmulo (36–40) · Galaxia (41–45) · Supernova (46+).

Vocabulario: *estrellas encendidas* (conceptos en nivel ≥ 2), *se apaga / escarcha*, *constelaciones* (asignaturas), *carta celeste* (mapa), *misiones* (exámenes de élite), *estrellas guía* (leyendas y perfiles destacados), *insignias* (logros), *comodín* (racha, icono de luna), *cofre semanal* (los 3 objetivos semanales → +300 XP).

## Injertos de las otras maquetas

- De Cuaderno: la tabla de cola con motivo por fila, la línea temporal de próximas fechas con anillo de preparación, el tono del tutor en cursiva.
- De Estudio: estados de árbol de habilidades en el mapa (bloqueada, siguiente), el reparto semanal por asignatura con aviso de la más descuidada, objetivos semanales con recompensa visible.

## Tono del texto

Directo, en segunda persona, con cifras concretas y sin dramatismo: "Hoy puedes encender seis estrellas nuevas". "Matrices se está apagando: último repaso hace 11 días". "Aún no" en vez de "te falta".

## Densidad e iconografía

25-09-2026: el diseño gustaba, pero se sentía **saturado, con demasiado texto**. Hoy muestra **696 palabras visibles** (estado demo del 18-11-2026). Esta sección fija un vocabulario de iconos único y las reglas de densidad. Dos maquetas para elegir hasta dónde llegar:

| Maqueta | Idea | Palabras visibles |
|---|---|---|
| `docs/maquetas/hoy-actual.png` | Hoy real, captura de referencia | 696 |
| `docs/maquetas/hoy-calma.{html,png}` (+ `-390.png`) | Mínima: cada sección en una línea tranquila, casi sin iconos, explicaciones en ⓘ | 279 (−60 %) |
| `docs/maquetas/hoy-iconos.{html,png}` (+ `-390.png`) | Misma rejilla y densidad de datos; texto → icono + etiqueta corta, cifras → fichas | 372 (−47 %) |

Recuento: tokens con al menos una letra dentro de `<main>` (sin la barra superior); no cuentan el texto oculto (sr-only, `<option>` no seleccionadas), las cifras sueltas ni el pie de las maquetas. Las dos maquetas usan los mismos datos, las mismas prioridades y mantienen todas las funciones; solo cambia la presentación.

### Vocabulario de iconos

Un concepto, un icono, en toda la app, y cada icono con un solo significado. Nombres de `lucide-react` (1.48). Los glifos propios (`Star`/`StarMark`, `RouteMark` y su planeta, `RankGlyph`, medallón de `Badge`) siguen siendo el átomo visual donde ya existen; el icono lucide es su equivalente en texto, fichas y botones. Los iconos de las insignias (`achievementIcons.tsx`) y los sellos de las biografías son ilustración: pueden repetir un icono del vocabulario solo si significa lo mismo (la llama en las insignias de constancia).

| Concepto | Icono lucide | Dónde | Etiqueta corta |
|---|---|---|---|
| **Estudio** | | | |
| Sesión de estudio (empezar) | `play` (relleno) | CTA de Hoy, buscador, ficha, empezar prueba o paso | «Empezar sesión», «Empezar» |
| Repaso | `refresh-ccw` | cifra de la sesión, pestaña y fila de la cola, tarjeta de repaso, «Solo repasos», objetivo semanal | «Repasos» |
| Primer recuerdo | `refresh-ccw-dot` | ficha junto a los repasos, fila de la cola | «1.º recuerdo» |
| Concepto nuevo | `book-open` | cifra de la sesión, pestaña y fila de la cola, tarjeta «Toca estudiarlo», «Estudiar el tema» | «Nuevos» |
| Visto / «Lo he estudiado» | `book-open-check` | botón de la sesión, menú de la ficha, historial, cifra de vistos | «Visto», «vistos» |
| Ejercicios | `list-checks` | menú de la ficha, casilla de la sesión | «Ejercicios» |
| Registrar estudio (un concepto) | `pen-line` | ficha del concepto | «Registrar estudio» |
| Registrar lo visto en clase | `notebook-pen` | Hoy, buscador | «Registrar clase» + `N` |
| Ver (respuesta, ficha) | `eye` | sesión | «Ver respuesta», «Ver ficha» |
| **Gamificación** | | | |
| Racha | `flame` (oro si hoy está hecha; `--text-3` si pendiente) | barra superior, jugador, resumen de sesión, constancia | «64 días», «racha» |
| Comodín | `moon` (escarcha), exclusivo | jugador, constancia, mapa de actividad | «comodín» |
| XP | `sparkles` (oro), exclusivo | sesión, jugador, cofre, logros | «+470 XP» |
| Nivel y rango | glifo propio `RankGlyph` | jugador, barra superior, subida de nivel | «Nivel 13» + rango en mono |
| Insignia / logro | `award` (el medallón lleva el icono de la insignia) | cabecera y recuento de logros | «Logros», «17 / 42» |
| Cofre semanal | `gift` | objetivos de la semana | «Cofre semanal» |
| **Estructura** | | | |
| Asignatura (constelación) | `layers` + punto o código de color | nav, reparto, selector «Una asignatura», enlaces | nombre corto o código (ALG) |
| Tema | `bookmark` (en la carta: estrella de `RouteMark`) | rumbo, ficha | «Tema 1» |
| Concepto / estrella | glifo propio `StarMark` | mapa, estado en la cola, cifra de encendidas | nombre; «encendidas» |
| **Apuntes** | | | |
| Apuntes del tema | `book-text` | cabecera del lector (secciones), enlaces desde la prueba, la asignatura, Pruebas y la ficha de concepto | «Apuntes», «N secciones» |
| **Rumbo y misiones** | | | |
| Rumbo | `compass` | pestaña, «Ver rumbo», «Volver al rumbo», marca «principal» | «Rumbo» |
| Control de tema | `clipboard-check` (en la carta: estrella) | rumbo, pruebas | «Control» |
| Simulacro de parcial o final | `hourglass` (en la carta: rombo) | rumbo, pruebas | «Simulacro parcial / final» |
| Pruebas (lista) | `clipboard-list` | enlace de Rumbo, pestaña | «Pruebas» |
| Examen real (misión principal) | `graduation-cap` (en la carta: planeta) | próximas fechas, rumbo | «Examen final», «Parcial» |
| Misión de élite | `rocket` | nav Misiones, misión más cercana, ficha | «Misión» |
| Estrella guía | `telescope` | estrella guía más cercana, ficha | «Estrella guía» |
| **Misión del día y Camino** | | | |
| Refuerzo | `target` | cadena de la Misión de hoy | «Refuerzo» |
| Día redondo (día completado) | `calendar-check` | cadena, insignias | «Día redondo +60 XP» |
| Mañana | `calendar-clock` | línea de mañana | «Mañana» |
| Camino | `route` | pestaña, enlaces | «Camino» |
| Estás aquí | `map-pin` | sendero | «Estás aquí» |
| Bloqueado | `lock` | sendero, peldaños de élite | tooltip |
| Cumbre | `mountain` | sendero, Élite | «Cumbre» |
| **Estados** | | | |
| Atrasado | `circle-alert` (ascua) | rumbo, avisos del mapa | «26 d tarde» |
| Siguiente | `flag` | rumbo, escalera de élite | «Siguiente» |
| Listo (preparación ≥ umbral) | `circle-play` (oro) | rumbo, pruebas | «Listo · 82 %» |
| Hecho | `check` | rumbo, élite, fin de sesión | «Hecho» |
| Ya no aplica | `circle-slash` (`--text-3`) | rumbo, carta | «Ya no aplica» |
| Recomendada | `lightbulb` (oro) | pruebas, sugerencias del tutor | «Recomendada» |
| Provisional / plantilla | `circle-dashed` | fechas supuestas, ajustes, asignatura | «provisional», «plantilla» |
| En curso | `timer` | prueba empezada, cronómetro de la sesión | «En curso», «12:40» |
| **Motivos de la cola** | | | |
| Examen cercano | `calendar` (ascua) | fila de la cola | «examen en 5 d» |
| Se enfría | `snowflake` (escarcha) | fila de la cola, cifra de Hoy | «se enfría», «6 se enfrían» |
| Desbloquea / adelantar | `lock-open` (oro) | fila de la cola | «para División euclídea» |
| Dependencias (base de, lo usan) | `waypoints` | fila de la cola, avisos del mapa | «base de 3», «lo usan MOE · PMD +6» |
| **Datos** | | | |
| Fecha / cuenta atrás | `calendar` | próximas fechas, asignaturas, motivos | «mar 12 ene», «55 d» |
| Duración | `clock` | sesión, «30 min», constancia | «2 h 30», «52 min / día» |
| Preparación % | `gauge` (o anillo `Ring`) | rumbo, misiones, fechas | «Preparación 7 %» |
| Nota | `file-check` | resultado de prueba, paso hecho | «Nota 7,5» |
| Estrellas de nota | `star` (relleno oro / hueco) | rumbo, pruebas | con `aria-label` «2 de 3 estrellas» |
| Ritmo del 10 | `trending-up` / `trending-down` | asignaturas | «ritmo −16 d» |
| **Navegación y sistema** | | | |
| Hoy | `sunrise` | nav móvil, buscador | «Hoy» |
| Mapa / carta celeste | `orbit` | nav, «Ver en el mapa», «Abrir mapa» | «Mapa» |
| Calendario | `calendar-days` | Ajustes · Calendario, agenda del rumbo, aviso de semana cargada | «Calendario» |
| Añadir evaluación | `calendar-plus` | próximas fechas, asignatura | «Añadir» |
| Usar plantilla | `wand-sparkles` | rumbo, ajustes | «Usar plantilla» |
| Progreso | `trophy` | nav, buscador | «Progreso» |
| Ajustes | `settings` | barra superior, buscador | tooltip «Ajustes» |
| Tema claro / oscuro | `contrast` | barra superior | tooltip «Tema» |
| Buscar | `search` | barra superior | «Buscar…» + `Ctrl K` |
| Ayuda / explicación ⓘ | `info`, exclusivo | junto a títulos y cifras; leyenda del mapa | tooltip con la explicación |
| Abrir / ir | `chevron-right` | enlaces de tarjeta | «Ver rumbo ›» |
| Ver más / desplegar | `chevron-down` | cola, fechas | «Ver 164 más» |
| Reintentar | `rotate-ccw` | prueba, misión | «Reintentar» |
| Entregar / corregir | `square-check` | prueba, misión | «Corregir», «Terminar» |
| Enlace externo | `external-link` | apuntes, fuentes | «Abrir» |

**Incoherencias actuales** (a corregir al implementar; ninguna tocada todavía en `src/`):

1. `Sparkles` tiene 11 significados: pestaña Hoy (`TopNav`), XP (`SessionQueue`, marcador de la sesión), subida de nivel, motivo «desbloquea / adelántalo» (`ReasonIcon`), «Recomendada» (`PruebasTab`), «Practicar…» (`MissionDetail`, `Bases`), «Repasar lo fallado» (`trial/Result`), «Comprobación de recuerdo» (`SessionCards`), «Sesión terminada» (`SessionSummary`) y «Hoy no vence nada» / «Rumbo completo» (`AgendaView`). Pasa a significar solo XP.
2. `Moon` tiene 4 significados: comodín (`PlayerCard`, `Heatmap`), motivo «se enfría» (`SessionQueue`), tema oscuro (`ThemeToggle`) y «Próxima sesión: mañana» (`SessionSummary`). Pasa a significar solo comodín; los demás pasan a `snowflake`, `contrast` y `calendar`.
3. Marcar como visto usa `Eye` en el menú de la ficha y en el historial, pero `GraduationCap` en la sesión («Lo he estudiado»); además `Eye` también es «Ver ficha» y «Ver respuesta». Queda `book-open-check` para visto y `eye` solo para ver.
4. Concepto nuevo usa `Compass` en la sesión («Toca estudiarlo»), que es también el icono del Rumbo (estado vacío de `Rumbo.tsx`). Pasa a `book-open`.
5. Ejercicios usa `ListChecks` en `StudyMenu` pero `BookOpenCheck` en la sesión («He resuelto ejercicios»); `BookOpenCheck` es además «N conceptos» en el buscador.
6. Registrar clase usa `NotebookPen` en Hoy pero `CalendarPlus` en el buscador.
7. Usar plantilla usa `Wand2` en `PrincipalesTab` pero `CalendarClock` en Ajustes, y el aviso de plantilla usa `CalendarDays`.
8. `Rocket` es misión de élite y también «Volver al rumbo» (`trial/Result`).
9. `Layers` es asignaturas (nav) y también «semana cargada» (`AgendaView`).
10. `Info` aparece como icono genérico de los motivos secundarios de la cola («Base directa de…», «Lo necesitarás en…»), no como ayuda. Debe reservarse para ⓘ.
11. `ArrowUpRight` es «lo necesitarás en» (cola) y también «Su historia» (mapa).
12. En `GuideDetail`, `Flag` («hito») choca con «Siguiente» (`EliteTab`), `Trophy` («competición») con Progreso y `GraduationCap` («título») con examen. Los sellos pasan a `milestone`, `medal` y `scroll`.
13. Hay 7 tamaños de icono (13, 14, 15, 16, 18, 20 y 24 px) con trazo fijo 2 (1,6 solo en insignias); ver la regla 10.

### Reglas de densidad

1. **Como mucho dos niveles de texto por tarjeta o fila**: título y dato. Un tercero (condición, desglose, explicación) va a ⓘ o a la ficha.
   - Antes: «35 repasos · 33 primeros recuerdos incluidos» / «8 conceptos nuevos · requisitos ya cumplidos».
   - Después: «35 Repasos» + ficha `refresh-ccw-dot` «33» / «8 Nuevos»; los requisitos, en ⓘ.
2. **Eyebrow solo si añade un dato que el título no tiene.**
   - Fuera: «TUS PRÓXIMOS OBJETIVOS / Rumbo», «CUENTA ATRÁS / Próximas fechas», «MAPA · FRAGMENTO / Carta celeste», «ORDENADA POR IMPACTO / En la cola», «ÚLTIMAS 20 SEMANAS / Constancia».
   - Se quedan: «SEMANA 10 DE 20» sobre la fecha y «✦ SESIÓN DE HOY».
3. **Cifras antes que frases.**
   - «atrasado 26 días» → `circle-alert` «26 d tarde».
   - «Quedan 4 días de esta semana» → «Quedan 4 días».
   - «1204 / 7269 XP en este nivel» → «1204 / 7269 XP».
   - «media diaria de estudio este mes» → `clock` «52 min / día».
4. **Cada metadato, una sola vez.** La asignatura una vez por fila (código o nombre corto, nunca los dos ni el nombre largo «Álgebra y matemática discreta» dentro de una lista). El tipo, también una vez.
   - «ÁLGEBRA Y MATEMÁTICA DISCRETA · CONTROL / Control · Lógica proposicional e inferencia» → `clipboard-check` «Lógica proposicional e inferencia» · ALG · «Control».
   - «Examen final FINAL» → «Examen final».
   - «ADELANTAR» (etiqueta) + «ADELANTAR» (columna de tiempo) → una sola vez.
   - «Misión principal» y la primera de «Próximas fechas» son el mismo examen: una sola fila, marcada «principal».
   - «8 % del temario iluminado» y «66 de 870 estrellas encendidas» son la misma cifra: se muestra una vez.
5. **Un motivo por fila en las listas**: el más fuerte, como ficha; el resto, en la ficha del concepto.
   - Antes: «Adelántalo: lo necesitas para División euclídea · Base directa de 3 conceptos».
   - Después: `lock-open` «para División euclídea». La variante Iconos añade `waypoints` «base de 3».
6. **Las explicaciones van a ⓘ** (tooltip de `info` a 14 px junto al título), nunca como párrafo visible. Por ejemplo:
   - «Se adapta a tus fallos y a lo que se está enfriando»;
   - «Orden: examen cercano × lo que desbloquea × riesgo de olvido»;
   - «Cada punto es un día · cuanto más brilla, más estudiaste»;
   - «en esta racha, sin perderla».
7. **Un solo botón dorado por pantalla** («Empezar sesión»). El resto son ghost («Solo repasos», «30 min») o enlaces dorados («Ver rumbo ›»). Como color de texto, el dorado queda para XP, «siguiente» y la acción; no para etiquetas.
8. **Icono siempre con etiqueta corta** (1–2 palabras o una cifra con unidad); nunca un icono solo para un significado principal. Excepciones:
   - controles universales con tooltip (buscar, tema, ajustes, cerrar);
   - icono + número sin palabra, solo en metadatos repetidos de una lista cuando la cabecera o ⓘ los explican una vez.
9. **Asignaturas por nivel de detalle**: código (ALG, CAL…) en listas densas y leyendas; nombre corto en cabeceras y fichas; nombre largo solo en la página de la asignatura.
10. **Escala de iconos** (trazo visible ≈ 1–1,25 px):
    - 12 px / trazo 2: dentro de etiquetas mono;
    - 14 / 1,75: fichas, filas y enlaces;
    - 16 / 1,75: botones y nav;
    - 20 / 1,5: cabeceras de tarjeta, estados vacíos y botón grande;
    - 24 / 1,5: medallones.

    Color: el del texto al que acompaña o su acento semántico (oro = XP / acción / desbloquea, escarcha = frío / comodín, ascua = atraso / examen cercano). Nunca el color de una asignatura en un icono: la asignatura va en el punto o en el código.
