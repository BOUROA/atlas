# Tema 2 · Evaluar

Observar te dice qué pasó en cada ejecución; evaluar te dice si estuvo bien. Una traza perfecta de una respuesta equivocada sigue siendo una respuesta equivocada. Este tema trata cómo medir la calidad de un agente de forma repetible: qué casos usar, con qué criterio puntuarlos, cuándo puede corregir otro modelo y cómo aprovechar la señal que ya dejan las personas al revisar.

## Qué es un eval

Un **eval** es una prueba repetible que mide la calidad de las salidas de un modelo o de un agente. Tiene tres piezas: unos **casos** (entradas representativas, a menudo con la salida esperada), un **criterio** que decide si cada salida es buena, o cuánto, y una **puntuación** agregada, como el porcentaje de aciertos o la nota media. Lo que lo separa de probar a mano es que se puede volver a lanzar tras cualquier cambio de prompt, de modelo o de código y comparar el resultado con el anterior. Y hay un paso previo que no se puede saltar: definir los criterios de éxito antes de construirlo, es decir, qué tiene que hacer bien el agente y qué nota es suficiente.

La intuición es un examen con plantilla de corrección. Las mismas preguntas y los mismos criterios cada vez permiten comparar de forma justa a dos alumnos, o al mismo alumno antes y después de estudiar. Si cambias las preguntas o el corrector improvisa, las notas dejan de ser comparables.

### Un eval de principio a fin

Este ejemplo te acompaña durante todo el tema. En FlipyERP existe un comando que asigna categorías del PIM con IA, `pim/management/commands/clasificar_categorias_ia.py`, pero no existe ningún eval que mida lo bien que lo hace. Lo que sigue es un ejercicio: cómo sería ese eval.

Primero, el criterio de éxito, fijado antes de mirar ningún resultado: una salida es correcta si coincide exactamente con la categoría que ha revisado una persona. Después, los casos: 40 productos, 10 de cada familia (Electrónica, Hogar, Cosmética y Juguetes), cada uno con su categoría revisada. Se lanza el clasificador sobre los 40 y se cuentan los aciertos.

| Familia | Aciertos | Porcentaje |
|---|---|---|
| Electrónica | 10/10 | 100 % |
| Hogar | 9/10 | 90 % |
| Cosmética | 6/10 | 60 % |
| Juguetes | 9/10 | 90 % |
| Total | 34/40 | 85 % |

Un 85 % suena razonable, y si solo miraras esa cifra podrías dar el clasificador por bueno. Pero el total esconde un 60 % en Cosmética: cuatro de cada diez productos de esa familia acaban en una categoría equivocada. Las otras tres familias suman 28/30, un 93,3 %; todo el problema está en una sola.

> **Idea clave.** Desglosa siempre la puntuación por grupo. Una media global alta puede ocultar un grupo que falla mucho, y ese grupo suele ser justo el que genera las quejas.

Si retocas el prompt para mejorar Cosmética, relanzas los mismos 40 casos y comparas familia por familia: si Cosmética sube y Electrónica baja, lo verás.

### Errores típicos

- Probar unos cuantos ejemplos a ojo y llamarlo eval: si no es repetible, no sirve para comparar.
- Construir el eval sin decidir antes qué es una salida buena: acabarás ajustando el criterio a lo que salga.

## Conjunto de referencia y muestreo

El **conjunto de referencia** (*golden set*) es la colección fija de casos sobre la que se repite el eval. Debe ser **representativo**, es decir, parecerse a lo que llega de verdad; debe **incluir casos difíciles y raros**, porque ahí es donde se equivoca el agente; debe estar **revisado por personas** cuando incluye la respuesta esperada; y debe ser **estable y versionado**, para que dos ejecuciones sean comparables y, si cambia, quede constancia de a qué versión corresponde cada nota.

La intuición son los platos de prueba de una cocina. Siempre los mismos, elegidos para cubrir lo fácil, lo difícil y lo raro, de modo que al probar una receta nueva sepas si es mejor de verdad o solo en los platos que ya salían bien.

### Por qué estratificar

Para sacar los casos de datos reales hay dos caminos. Una **muestra aleatoria simple** toma productos al azar de todo el catálogo. El **muestreo estratificado** divide primero el catálogo en grupos relevantes (familia, estado, cliente…) y toma al azar un número fijo de casos dentro de cada grupo.

Vuelve al clasificador. Si Cosmética es el 5 % del catálogo y eliges 40 productos con una muestra aleatoria simple, saldrán de media 2 productos de Cosmética. Con 2 casos no puedes ver un 60 % de acierto: un solo error mueve la cifra 50 puntos, y hay casi un 13 % de probabilidades de que no salga ninguno. El eval daría una nota global alta y no diría nada de la familia que falla. Con 10 casos fijos por familia, en cambio, el 60 % aparece con claridad.

> **Ojo.** Estratificar cambia las proporciones: en el ejemplo, Cosmética pesa un 25 % del eval aunque sea el 5 % del catálogo. Por eso el total del eval no es la precisión que verá el catálogo entero. Úsalo para comparar versiones y lee siempre el desglose por grupo.

### Errores típicos

- Quedarse con los casos fáciles o con los primeros que salen: el eval da buena nota y el agente falla en producción.
- Cambiar el conjunto entre dos ejecuciones y comparar las notas como si fueran equivalentes. Si añades casos, crea una versión nueva y vuelve a lanzar la versión anterior del agente sobre ella.

### En FlipyERP

`pim/services/qa_fugas.py` tiene `muestra_estratificada`, que toma al azar un número fijo de productos de cada estado del catálogo (por defecto, `por_estado=300`), en lugar de una muestra aleatoria simple de todo el catálogo. Si un estado tiene menos productos que ese número, los toma todos. Admite una semilla (`seed`), así que la misma llamada puede repetir la misma muestra. Además de la muestra, devuelve cuántos productos hay en cada estado, que es justo lo que necesitas para no confundir el porcentaje de la muestra con el del catálogo.

## Criterios de evaluación

El **criterio de evaluación** es la regla que decide si una salida es buena. Hay tres niveles, de más barato y fiable a más flexible:

- **Coincidencia exacta** con la respuesta esperada: para clasificaciones y para extraer un campo concreto.
- **Reglas deterministas** escritas en código: el JSON cumple el esquema, están los campos obligatorios, el importe cuadra, no aparece una palabra prohibida.
- **Rúbrica**: criterios escritos que aplica una persona o un modelo, para lo que el código no puede comprobar, como el tono, la utilidad o la fidelidad a las fuentes.

La regla práctica es usar el criterio más simple que mida lo que importa. La intuición es corregir tres exámenes distintos: uno tipo test se corrige con plantilla, uno de problemas comprobando el resultado y una redacción con una rúbrica. Nadie corrige un test con rúbrica.

### Tres salidas, tres criterios

| Salida del agente | Criterio | Qué se comprueba |
|---|---|---|
| Categoría de un producto | Coincidencia exacta | Que sea la categoría revisada por una persona |
| JSON con la ficha de un producto | Reglas deterministas | Que cumpla el esquema, tenga los campos obligatorios y no contenga palabras prohibidas |
| Respuesta a un cliente de soporte | Rúbrica | Que resuelva la duda, con los datos correctos y el tono adecuado |

En la primera fila, lo único delicado es normalizar antes de comparar: mayúsculas, espacios y tildes no deberían contar como fallo. En la segunda, cada regla es una comprobación de código que dice sí o no sin ambigüedad. Solo la tercera necesita que alguien, persona o modelo, lea y juzgue.

### Cómo escribir una rúbrica útil

Una rúbrica útil está hecha de criterios concretos que se pueden comprobar leyendo la salida, cada uno con respuesta sí o no. Para una respuesta de soporte sobre un pedido:

- ¿Cita el número de pedido correcto?
- ¿Evita prometer plazos que no constan en los datos?
- ¿El tono es correcto: educado, sin excusas vacías ni lenguaje de robot?

Compara esto con «¿la respuesta es buena? Puntúa del 1 al 10»: dos personas darán notas distintas a la misma respuesta. Con preguntas cerradas suelen coincidir, y cuando no, sabes en qué punto.

### Errores típicos

- Usar un modelo como juez para algo que una regla en código comprobaría mejor y gratis, como si el JSON es válido.
- Escribir rúbricas vagas, como «que sea buena»: cada evaluador las interpreta distinto.

## LLM como juez

Un **juez LLM** es un modelo que puntúa las salidas de otro. Recibe la entrada, la salida que hay que evaluar y una rúbrica, y devuelve una etiqueta o una puntuación, mejor en formato estructurado y con un motivo breve. Escala donde no llegan las personas, pero funciona bien con preguntas concretas y cerradas («¿la descripción menciona algo que no está en la ficha? sí o no») y mal con notas abstractas. Antes de fiarte de él tienes que **calibrarlo**: comparar sus veredictos con los de personas en una muestra y medir cuánto coinciden.

La intuición es un corrector ayudante. Corrige cientos de exámenes rápido con la rúbrica del profesor, pero el profesor revisa una muestra para comprobar que corrige como él.

### Calibrar con una tabla 2×2

Tienes 50 descripciones de producto revisadas por personas y por el juez. Cada uno etiqueta cada descripción como «incoherente» (habla de otro tipo de producto o no encaja con la ficha) o «coherente».

| | Persona: incoherente | Persona: coherente | Total juez |
|---|---|---|---|
| Juez: incoherente | 8 | 4 | 12 |
| Juez: coherente | 3 | 35 | 38 |
| Total personas | 11 | 39 | 50 |

Hay tres lecturas, y cada una responde a una pregunta distinta:

- **Acuerdo**: coinciden en 8 + 35 = 43 de 50, un 86 %.
- **De los problemas reales, cuántos detecta**: las personas marcan 11 incoherentes y el juez encuentra 8, un 72,7 %. Se le escapan 3.
- **De lo que marca, cuánto es de verdad un problema**: el juez marca 12 y 8 lo son, un 66,7 %. Las otras 4 son falsas alarmas.

Un 86 % de acuerdo parece un buen juez, pero se le escapan 3 de cada 11 problemas. El acuerdo es alto sobre todo porque la mayoría de las descripciones son coherentes: un juez que dijera siempre «coherente», sin leer nada, ya coincidiría en 39 de 50, un 78 %. Si lo que quieres es cazar descripciones malas, la cifra que importa es el 72,7 %.

> **Error típico.** Dar un juez por bueno mirando solo el acuerdo. Cuando los problemas son pocos, el acuerdo sale alto casi por defecto. Mira siempre qué parte de los problemas reales detecta y qué parte de sus alarmas son ciertas.

### Sesgos del juez

Los jueces LLM tienen sesgos conocidos. Tienden a preferir las respuestas largas aunque no sean mejores, y a preferir las que se parecen a su propio estilo. Si usas el mismo modelo con el mismo prompt para generar y para juzgar, el juez tiende a dar por buenos sus propios errores, porque los comete por las mismas razones. Usa otro prompt, a ser posible otro modelo, y compara con personas.

### Errores típicos

- Fiarse del juez sin compararlo con personas.
- Pedirle una nota de 1 a 10 sin criterios: da notas poco consistentes.
- Generar y juzgar con el mismo modelo y el mismo prompt.

### En FlipyERP

`pim/services/qa_fugas.py` usa un modelo pequeño como juez: `es_fuga_descripcion` y `clasificar_producto` usan por defecto `MODELO_CLASIFICADOR_DEFAULT`, que es un Haiku. El comando `revisar_enriquecimiento_ia --validar-descripciones` (`pim/management/commands/revisar_enriquecimiento_ia.py`) pide al modelo un JSON con `coherente` (verdadero o falso) y `motivo`, que es justo el formato recomendado: pregunta cerrada, salida estructurada y un motivo breve. Los dos se lanzan a mano; no forman parte de un eval automático.

## Señal humana como eval

Cuando una persona revisa lo que propone un agente deja **señal humana**: aprueba, rechaza o edita. Si se guardan la propuesta original y la versión final, esa señal se convierte en un eval gratuito y continuo. Se puede medir la tasa de aprobación sin cambios, cuánto se edita y en qué tipo de casos se edita más; y los casos editados son excelentes candidatos para el conjunto de referencia, porque son reales y ya traen la respuesta corregida por una persona.

La intuición son las correcciones en rojo que un jefe hace a los borradores de un becario. Si las guardas, sabes exactamente en qué falla y si va mejorando; si las tiras, cada corrección se pierde.

### Un ejemplo con borradores de soporte

Un agente redacta borradores de respuesta y un equipo los revisa antes de enviarlos. Durante un mes, guardas por cada borrador la propuesta, la versión enviada y el estado final. Al agruparlos por tipo de consulta aparece un patrón: las consultas de seguimiento se envían casi siempre sin cambios, y las devoluciones se editan casi todas en el mismo párrafo, el que explica el reembolso. Sin haber escrito ni un solo caso de prueba, ya sabes qué parte del agente falla y tienes decenas de ejemplos corregidos para construir su eval.

La señal es real, pero está sesgada. Solo cubre lo que la gente revisa, y como lo revisa: quien va con prisa aprueba cosas mejorables, y un borrador que nadie abre no deja señal.

### Errores típicos

- Guardar solo la versión final: se pierde qué cambió la persona.
- Tomar la tasa de aprobación como verdad absoluta: una aprobación con prisa no es una aprobación de calidad.

### En FlipyERP

`DraftRespuestaIA` (`soporte/models.py`) guarda `cuerpo_propuesto`, lo que redactó la IA, y `cuerpo_editado`, la versión editada por la persona. Su `estado` pasa por `generando`, `listo`, `aprobado`, `enviado`, `rechazado` o `error`, y `modelo_usado` registra qué modelo lo generó. Con esos campos se pueden calcular la tasa de aprobación sin cambios, la de rechazo y cuánto se edita, por modelo. La información existe, pero hoy no se explota como métrica de calidad.

## Tests con el LLM simulado frente a evals

Un **test** con el LLM simulado sustituye al modelo por una respuesta fija (*mock*) y comprueba que el código hace lo correcto con ella: que lee el JSON, que pasa al plan B si la respuesta es mala, que guarda los registros. Un **eval** llama al modelo real con casos reales y mide si sus respuestas son buenas. Los dos hacen falta, y ninguno sustituye al otro: un test en verde no dice nada de la calidad de las respuestas.

La intuición es la fontanería. Comprobar que el grifo, las tuberías y el desagüe funcionan no te dice si el agua es potable; para eso hay que analizar el agua.

| | Test con el LLM simulado | Eval |
|---|---|---|
| Qué mide | Que el código trata bien las respuestas | Que las respuestas son buenas |
| Cuándo se lanza | En cada commit | Al cambiar el prompt, el modelo o los datos |
| Coste | Rápido y gratis | Lento y con coste por token |
| Determinismo | Siempre da el mismo resultado | Varía entre ejecuciones |

### Un ejemplo

Un agente clasifica documentos y devuelve un JSON con la categoría y la confianza. Un test le pasa una respuesta simulada envuelta en un bloque de Markdown y comprueba que el código la limpia y lee bien la categoría; otro le pasa una respuesta vacía y comprueba que se activa el plan B. Los dos pasan siempre, y ninguno sabe si el modelo real clasifica bien: la respuesta la escribió quien hizo el test.

### Errores típicos

- Pensar que unos tests en verde garantizan que el agente responde bien.
- Meter llamadas al modelo real en los tests de cada commit: son lentos, caros y su resultado varía de una ejecución a otra.

### En FlipyERP

Los tests de `ai/tests_router_agentes.py` usan `unittest.mock.patch` para simular al modelo. Comprueban, por ejemplo, que se limpian los bloques de código que envuelven el JSON de la salida y que una respuesta degenerada, vacía o solo con espacios, activa el plan B. No hay evals que midan la calidad de las respuestas.

## Chuleta

**Qué criterio usar**

| Tipo de salida | Criterio |
|---|---|
| Clasificación o extracción de un campo | Coincidencia exacta, normalizando antes de comparar |
| JSON o formato fijo | Reglas deterministas en código |
| Texto libre | Rúbrica, aplicada por una persona o por un juez calibrado |

**Para escribir una rúbrica**

- Criterios concretos, que se comprueben leyendo la salida.
- Cada criterio, con respuesta sí o no.
- Un ejemplo de sí y uno de no para cada criterio.
- Probarla con dos personas sobre las mismas salidas y afinar donde no coincidan.

**Para fiarte de un juez**

- Calibrarlo con una muestra revisada por personas.
- Mirar lo que se le escapa y cuántas de sus alarmas son ciertas, no solo el acuerdo.
- Pedirle salida estructurada con un motivo breve.
- Revisar una muestra cada cierto tiempo, y siempre que cambie su modelo o su prompt.

## Casos prácticos

### Caso 1 · El eval de las respuestas de soporte

Te piden un eval para el agente que redacta las respuestas de soporte, y quieres aprovechar lo que ya guarda `DraftRespuestaIA`.

Empieza por la métrica de partida, que no exige construir nada: de los borradores que llegan a `enviado`, qué parte sale sin cambios, es decir, con `cuerpo_editado` vacío o igual a `cuerpo_propuesto`. Calcúlala por `modelo_usado` y por intención; cada borrador tiene un campo `intencion` (seguimiento, devolución, consulta de producto, queja, factura o genérico). Antes de contar, ten en cuenta que puede haber reglas `AutoAprobacionRule` que envían borradores de una intención sin revisión si pasan unos controles; esos envíos no son señal humana, así que déjalos fuera.

Después, los casos. Los mejores candidatos son los borradores editados y los rechazados: son los que fallaron, y los editados traen además la versión buena. Estratifica por intención, tomando un número fijo de cada una, para que las intenciones poco frecuentes, como las facturas, no desaparezcan del conjunto. Haz que una persona revise cada caso y congela el conjunto con una versión.

Por último, el criterio: una rúbrica de cuatro o cinco puntos sí/no, por ejemplo: ¿cita el número de pedido correcto?, ¿los datos coinciden con los del pedido?, ¿evita prometer plazos que no constan?, ¿responde a lo que pregunta el cliente?, ¿el tono es correcto? Aplícala con personas al principio y, si pasas a un juez, calíbralo antes con esas mismas revisiones.

### Caso 2 · Tres agentes, tres criterios

Tienes tres agentes y hay que elegir el criterio de cada uno: el clasificador de categorías del PIM, un extractor de datos de facturas y un redactor de descripciones de producto.

El clasificador devuelve una etiqueta de una lista cerrada: coincidencia exacta con la categoría revisada, normalizando mayúsculas y espacios, y con el desglose por familia del ejemplo del tema. El extractor de facturas devuelve campos estructurados: reglas deterministas para el formato (JSON válido, campos obligatorios presentes, fechas e importes bien formados, la suma de líneas cuadra con el total) y coincidencia exacta campo a campo con los valores revisados, como el NIF o el número de factura. No hace falta ningún juez. El redactor de descripciones produce texto libre: rúbrica con preguntas cerradas (¿menciona algo que no está en la ficha?, ¿usa alguna palabra prohibida?, ¿habla del producto correcto?), y algunas de esas preguntas, como las palabras prohibidas, pueden pasar a reglas en código. Lo que quede de rúbrica lo aplica una persona o un juez calibrado.

### Caso 3 · Un juez que prefiere lo largo

Al revisar una muestra ves que el juez aprueba más las descripciones largas que las cortas, aunque las personas no las prefieren.

Para detectarlo, calibra por longitud: divide la muestra revisada por personas en descripciones cortas, medias y largas, y construye la tabla 2×2 de cada grupo. Si el juez es sesgado, en las largas se le escaparán más problemas reales que en las cortas, y el acuerdo global no lo mostrará porque mezcla los grupos, igual que el 85 % del clasificador escondía Cosmética.

Para corregirlo, cambia la rúbrica: sustituye la nota general por preguntas cerradas que no premian la extensión (¿hay alguna afirmación que no esté en la ficha?, ¿repite información?, ¿tiene frases de relleno?), pide un motivo breve para cada veredicto y penaliza explícitamente el relleno. Después, vuelve a calibrar con la misma muestra y comprueba que las tablas por longitud se parecen.

### Caso 4 · Tests en verde y usuarios que se quejan

Todos los tests del agente pasan, pero los usuarios se quejan de que las respuestas han empeorado desde el último cambio de prompt.

No hay contradicción. Los tests simulan el modelo con respuestas fijas, así que comprueban que el código trata bien esas respuestas, no que el modelo real las dé buenas; un cambio de prompt no puede romper un test que nunca llama al modelo. Lo que falta es un eval. Recoge los casos de las quejas, pide a una persona la respuesta correcta o los criterios de cada uno, añade casos de las situaciones que funcionaban bien para no romperlas, y lanza el prompt anterior y el nuevo sobre el mismo conjunto. A partir de ahí, ese eval se lanza antes de cada cambio de prompt o de modelo, y los tests siguen en cada commit.

## Antes de seguir

- Sé cuáles son las tres piezas de un eval y por qué los criterios de éxito se fijan antes de construirlo.
- Sé calcular los aciertos por grupo y por qué una puntuación global puede esconder un grupo que falla.
- Sé por qué estratificar al construir un conjunto de referencia y qué problema tiene una muestra aleatoria simple.
- Sé elegir entre coincidencia exacta, reglas deterministas y rúbrica según el tipo de salida.
- Sé escribir una rúbrica útil, con criterios concretos de sí o no.
- Sé calibrar un juez LLM y leer una tabla 2×2: acuerdo, problemas que detecta y alarmas que son ciertas.
- Sé qué señal dejan las personas al revisar y cómo convertirla en métricas y en casos.
- Sé distinguir un test con el LLM simulado de un eval y para qué sirve cada uno.
- Sé qué hay y qué falta en FlipyERP: la muestra estratificada, los jueces que se lanzan a mano, los borradores de soporte sin explotar y los tests sin evals de calidad.
