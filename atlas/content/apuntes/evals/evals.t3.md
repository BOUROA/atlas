# Tema 3 · Cerrar el bucle

Observar te dice qué pasó y evaluar te dice si estuvo bien. Este tema cierra el bucle: con lo observado y lo evaluado puedes cambiar prompts y modelos sin romper nada, y enterarte a tiempo cuando algo se tuerce. Son cuatro piezas: versionar lo que define al agente, comparar antes de activar, validar lo que devuelve el modelo y avisar cuando una métrica cruza un umbral.

## Versionar prompts y modelo

**Versionar** un agente es guardar juntas, con un identificador, todas las piezas que determinan su comportamiento: el prompt de sistema, la plantilla del mensaje de usuario, el modelo, la temperatura y el máximo de tokens. De todas las versiones, una es la **activa**, la que se usa en producción, y cada ejecución queda **enlazada a la versión** que la produjo. La regla que sostiene lo demás es sencilla: la versión activa no se edita nunca. Si quieres cambiar algo, creas una versión nueva.

Las piezas van juntas porque el mismo prompt con otro modelo, o con otra temperatura, es otro agente. Si solo versionas el texto y alguien cambia el modelo, dos ejecuciones con «la misma versión» dejan de ser comparables.

La intuición son las revisiones de una receta. La revisión 3 dice qué ingredientes, en qué cantidad, a qué temperatura de horno y cuánto tiempo. Si un día cambias la harina, eso es la revisión 4 aunque el texto no cambie; y si un cliente se queja de la tarta del martes, quieres saber con qué revisión se hizo.

### Qué ganas al enlazar cada ejecución

A mitad de mes, el coste diario del agente que clasifica documentos sube y, a la vez, las personas empiezan a corregir más sus resultados. Si cada ejecución apunta a su versión, agrupas el coste y las correcciones por versión y lo ves enseguida: el salto coincide con la versión 5, que cambió a un modelo más caro y alargó el prompt de sistema. Tienes dónde mirar y cómo volver atrás: marcar de nuevo como activa la versión 4, que sigue intacta.

Sin ese enlace, solo sabes que algo cambió en algún momento. Te toca cruzar fechas de despliegue con gráficas a ojo, y si hubo dos cambios la misma semana no puedes separar el efecto de cada uno.

> **Idea clave.** Una versión publicada es inmutable. Es lo que permite atribuir cada salida, comparar versiones con el mismo eval y volver atrás sin adivinar qué había antes.

### Errores típicos

- Versionar el texto del prompt y dejar fuera el modelo o la temperatura: el cambio que más mueve la calidad y el coste no queda registrado.
- Editar la versión activa «para un retoque»: las salidas antiguas quedan atribuidas a un texto que ya no es el que las generó.
- Dejar el modelo fijo en el código: cambiarlo exige desplegar y no pasa por ninguna versión que se pueda comparar.

### En FlipyERP

`AiPromptVersion` (`ai/models.py`) guarda `agente`, `version`, `system_prompt`, `user_prompt_template`, `modelo_llm`, `temperatura`, `max_tokens` y `activo`, y cada `AiTarea` apunta a la versión que la produjo con `prompt_version`. Es el esquema de esta sección: las piezas juntas, la marca de activa y el enlace desde cada ejecución.

No todos los agentes pasan por ahí. `ChatService` (`ai/services/chat_service.py`) usa `MODEL = 'claude-sonnet-4-5'`, fijo en el código. El agente de soporte toma el modelo de la `ConfiguracionModuloIA` del módulo `soporte` (`soporte/ia/generator.py`): se cambia desde la configuración, sin tocar código y sin crear ninguna versión. A cambio, cada `DraftRespuestaIA` guarda en `modelo_usado` el modelo que lo generó, así que sí se puede saber después qué borrador salió de qué modelo.

## Eval de regresión

Un **eval de regresión** lanza la versión actual y la candidata sobre el **mismo conjunto de referencia**, en las mismas condiciones, y compara dos cosas: la nota global y, sobre todo, **qué casos pasan de bien a mal**. Una regresión es justo eso, volver atrás en algo que ya funcionaba. La candidata se activa si no empeora lo que importa, o si se acepta ese empeoramiento a sabiendas y por escrito. Como el modelo no es determinista, conviene repetir cada caso varias veces: bajar la temperatura reduce la variación, pero no la elimina.

La intuición es probar la receta nueva con los mismos platos de prueba del tema 2, uno a uno, al lado de la antigua. Que la nueva gane de media no sirve de nada si ahora quema el plato que más te piden.

### Treinta casos, dos versiones

Un agente clasifica las consultas de clientes y propone la respuesta. Tienes un conjunto de referencia de 30 casos revisados. La versión 3, la activa, acierta 24 (80,0 %). La versión 4, la candidata, acierta 26 (86,7 %). Si solo miras la nota, la v4 mejora 6,7 puntos y la activarías. Pero la nota es el saldo de varios movimientos, y para verlos hace falta la **tabla de transiciones**, que cruza el resultado de cada caso en las dos versiones:

| | v4 bien | v4 mal | Total v3 |
|---|---|---|---|
| v3 bien | 22 | 2 | 24 |
| v3 mal | 4 | 2 | 6 |
| Total v4 | 26 | 4 | 30 |

Se lee así: 22 casos siguen bien, 4 pasan de mal a bien, 2 pasan de bien a mal y 2 siguen mal. La mejora neta de 2 casos sale de 6 cambios: 4 a favor y 2 en contra. Y los 2 que empeoran son críticos: una devolución fuera de plazo que la v4 acepta, con lo que el agente promete un reembolso que la política no permite, y una factura rectificativa mal clasificada, que acaba en la cola equivocada.

La moraleja: la media sube y aun así la v4 no debe activarse sin arreglar esos dos. Lo que toca es una v5 que los corrija y volver a lanzar el conjunto de referencia completo, no solo esos dos casos, porque el arreglo puede romper otros.

Queda la duda del ruido. Dos casos sobre treinta son 6,7 puntos, y basta que un par de casos dudosos cambien de lado por azar para producir una diferencia así. Por eso se repite: si un caso sale bien en unas ejecuciones y mal en otras con la misma versión, es inestable, y no cuenta como mejora ni como regresión hasta entender por qué. Lo que sí pesa es un caso que falla siempre con la candidata y nunca con la activa.

> **Error típico.** Mirar solo la media. Una nota global más alta puede esconder casos que antes estaban bien y ahora fallan, y un solo caso crítico roto pesa más que varios casos menores arreglados.

### Errores típicos

- Comparar solo la nota global y no mirar las transiciones.
- Lanzar cada versión con un conjunto o en condiciones distintas: otros casos, otra temperatura, herramientas que devuelven datos de otra fecha. Entonces la diferencia ya no es solo de la versión.
- Tomar una diferencia pequeña como mejora sin repetir las ejecuciones.

### En FlipyERP

`AiPromptVersion` (`ai/models.py`) permite tener varias versiones por agente, porque la pareja `agente` y `version` es única y no el agente solo. Lo que no existe es código que las compare con un eval antes de activar una: el paso de una versión a otra se decide sin tabla de transiciones.

## Salida estructurada y validación

Cuando la respuesta la va a usar otro programa, se pide en **formato estructurado**, normalmente JSON que cumple un **esquema**: qué campos hay, de qué tipo es cada uno y cuáles son obligatorios. Hay dos niveles. El primero es **forzarlo en la API**, con salidas estructuradas (*structured outputs*) o `response_format` con esquema, que garantizan el formato cuando el proveedor lo aplica, salvo respuestas cortadas por el máximo de tokens o endpoints que no lo respetan; por eso sigue haciendo falta validar. El segundo es **pedirlo en el prompt y validarlo** después. En los dos casos el código comprueba la salida antes de usarla y tiene un **plan B** si no cumple: reintentar, cambiar de modelo o dejar el caso para revisión. Y cuenta las salidas inválidas, porque su tasa es una métrica en sí misma.

Validar no es comprobar que el texto se deja leer como JSON. Es comprobar que están los campos obligatorios, que cada uno tiene el tipo correcto (el precio es un número, las viñetas son una lista) y que los valores están dentro de lo permitido, como una categoría de una lista cerrada. Un JSON impecable sin el campo `descripcion` es una salida inválida. Y ni siquiera el esquema forzado garantiza el contenido: una descripción bien formada puede hablar de otro producto, y eso ya es cosa de los criterios del tema 2.

La intuición es un formulario frente a una carta. El formulario obliga a poner cada dato en su casilla; la carta puede traerlo todo, pero alguien tiene que leerla y comprobar que no falta nada. Validar es el control de la ventanilla: aunque te den un formulario, miras que la fecha sea una fecha.

### Mil fichas al día

Un proceso genera 1000 fichas de producto al día, y un 7 % vuelve con un JSON inválido: 70 fichas. Un reintento arregla 56 de esas 70, el 80 %. Quedan 14, un 1,4 % del total, que van a una cola de revisión.

| Paso | Fichas | Sobre 1000 |
|---|---|---|
| Generadas | 1000 | 100 % |
| Inválidas en el primer intento | 70 | 7 % |
| Arregladas con el reintento | 56 | 5,6 % |
| A revisión | 14 | 1,4 % |

El reintento no es gratis: son 70 llamadas más al día, un 7 % más de llamadas. Y las 14 que quedan son unas 420 al mes, que alguien tiene que revisar. Con cola y métrica es trabajo previsible; sin ellas, son fichas que desaparecen o se publican incompletas sin que nadie lo sepa.

Aquí conviene vigilar dos tasas. La del primer intento, el 7 %, dice lo sano que está el prompt o el modelo: si sube, algo ha cambiado. La final, el 1,4 %, dice cuánto trabajo llega a las personas.

> **Ojo.** Un lector de JSON tolerante que devuelve «nada» cuando no entiende la respuesta esconde el problema si nadie cuenta esos «nada». El plan B tiene que dejar rastro: cuántas veces se activó, en qué casos y con qué resultado.

### Errores típicos

- Comprobar solo que la respuesta se puede leer como JSON, sin validar campos ni tipos.
- Un plan B silencioso: descartar la salida o poner un valor por defecto sin contarlo.
- Reintentar sin límite: multiplica el coste y puede entrar en bucle con un caso que siempre falla.

### En FlipyERP

`pim/content_studio/batch_processor.py` pasa `response_format=JSON_SCHEMA_FICHA` al generar el contenido de una ficha y, si el modelo local responde con un JSON que no se puede leer, hace un único reintento en la nube antes de marcar el error. La mayoría de agentes usan `parsear_json_llm` (`ai/agents/base.py`): quita los bloques de código que envuelven la respuesta, intenta leerla entera y, si no puede, busca el primer objeto entre llaves; si no hay JSON válido, devuelve `None`. No comprueba ningún esquema, así que un objeto sin campos obligatorios o con un tipo equivocado pasa como bueno, y cada agente decide su propio plan B cuando recibe `None`.

## Alertas de gasto y de calidad

Un panel solo sirve si alguien lo mira. Una **alerta** convierte una métrica en un aviso cuando cruza un **umbral**. Las buenas alertas son **pocas**, **accionables** (dicen qué pasa, cuánto, dónde mirar y qué se espera que hagas) y llegan por el **canal que el equipo ya usa**. Las métricas típicas de un agente son el gasto del mes frente al presupuesto, la tasa de errores del proveedor, la tasa de salidas inválidas y la tasa de aprobación humana.

La intuición es el testigo de la reserva del coche. No te enseña toda la telemetría del motor: se enciende cuando queda poco, y a tiempo para llegar a una gasolinera. Si se encendiera cada cinco minutos por cualquier cosa, dejarías de mirarlo.

### Un límite de 200 USD

Un módulo tiene un límite de 200 USD al mes y `alerta_gasto_pct` vale 80, así que el umbral está en 160 USD. Un día, el gasto acumulado del mes llega a 163,40 USD. `pct_limite_usado()` devuelve 81,7, por encima de 80: la alerta debería saltar. Quedan 36,60 USD hasta el límite.

Compara dos avisos posibles. «Gasto IA alto» obliga a quien lo recibe a investigarlo todo. «Módulo de generación de contenido: 163,40 USD de 200 USD este mes (81,7 %, umbral 80 %). Revisa su coste por modelo en el registro de costes» dice qué pasa, cuánto y por dónde empezar. Lo mismo vale para las alertas de calidad: la que avisa de que cae la aprobación humana debería decir en qué agente, en qué intención y desde qué versión o modelo.

> **Truco.** Antes de dar de alta una alerta, escribe el mensaje que recibirías y pregúntate qué harías al leerlo. Si la respuesta es «nada» o «depende», no está lista.

### Errores típicos

- Demasiadas alertas o umbrales demasiado sensibles: el equipo se acostumbra a ignorarlas y deja pasar la que importa.
- Alertas sin contexto, que obligan a investigar desde cero.
- Mandarlas a un canal que nadie mira.
- Repetir el mismo aviso cada vez que se comprueba la condición, en vez de una vez por umbral cruzado.

### En FlipyERP

`ConfiguracionModuloIA` (`ai/models.py`) tiene, por módulo, `limite_gasto_mes_usd`, `alerta_gasto_pct` (un porcentaje, 80 por defecto) y tres métodos. `gasto_mes_actual()` suma el coste de `AiCosteLog` de ese módulo desde el día 1 del mes. `pct_limite_usado()` devuelve ese gasto como porcentaje del límite, redondeado a un decimal y sin pasar de 100, o 0 si no hay límite. `limite_alcanzado()` dice si el gasto ya ha llegado al límite. Pero `alerta_gasto_pct` no se usa en ninguna comprobación: el dato está y nadie lo mira. El canal sí existe: `enviar_telegram_ops` y `registrar_alerta` (`core/utils_alertas.py`), que hoy se usan para alertas de operaciones, no de IA.

## Chuleta

**Cambiar un prompt o un modelo con seguridad**

1. Crea una versión nueva, sin tocar la activa.
2. Lanza el mismo conjunto de referencia con las dos versiones, en las mismas condiciones.
3. Revisa los casos que empeoran, uno a uno, antes de mirar la media.
4. Si las diferencias son pequeñas, repite las ejecuciones.
5. Activa la versión nueva.
6. Vigila la señal humana y las alertas durante los días siguientes.
7. Ten preparada la vuelta a la versión anterior.

**Umbrales de alerta razonables** (ilustrativos: ajústalos a lo habitual en cada agente)

| Métrica | Umbral |
|---|---|
| Gasto mensual | 80 % del límite o más |
| Salidas inválidas | Por encima de la tasa habitual (p. ej., más de un 2 %) |
| Errores del proveedor | Tasa de errores en una hora por encima de lo normal |
| Aprobación humana | Cae más de 10 puntos respecto a la semana anterior sin que haya habido cambios |

**Qué se versiona junto**

| Pieza | Por qué |
|---|---|
| Prompt de sistema y plantilla | Definen qué se le pide |
| Modelo | El mismo prompt rinde distinto en otro modelo |
| Temperatura | Cambia la variación entre ejecuciones |
| Máximo de tokens | Puede cortar respuestas y romper el JSON |

## Casos prácticos

### Caso 1 · Cambiar el modelo del agente de soporte

Quieren pasar el agente de soporte a otro modelo. Hacerlo es trivial: basta con cambiar el `modelo` de la `ConfiguracionModuloIA` del módulo `soporte`, sin tocar código. Precisamente por eso es arriesgado: no hay `AiPromptVersion` detrás ni ningún eval previo, y el cambio afecta a todos los borradores desde ese momento.

Empieza por la línea base. Con lo que ya guarda `DraftRespuestaIA`, calcula por intención la tasa de borradores enviados sin cambios y la de rechazados, filtrando por el `modelo_usado` actual y dejando fuera los que se enviaron por autoaprobación, que no son señal humana (lo viste en el tema 2). Es la referencia para el seguimiento posterior, no el eval.

Después, el eval antes del cambio. Arma el conjunto con tickets reales estratificados por intención: editados y rechazados, con la versión buena revisada por una persona, pero también enviados sin cambios, que son los casos que hoy funcionan y los únicos que te avisan si el modelo nuevo rompe algo. Genera ahora las respuestas a esos mismos tickets con el modelo actual y con el nuevo, en las mismas condiciones y sin enviar nada; no compares con los borradores antiguos, que se generaron en otras condiciones. Compáralas con la rúbrica del tema 2 caso a caso, con la tabla de transiciones. Presta atención a los casos delicados, como las devoluciones fuera de plazo.

Si pasa, haz el cambio y apunta qué modelo había antes y cuándo cambiaste: es tu única «versión». Ya con el cambio activo, haz el seguimiento: compara la tasa de enviados sin cambios antes y después filtrando por `modelo_usado`, que es lo que lo hace posible, y hazlo por intención, porque la mezcla de consultas cambia de una semana a otra. Si empeora, volver atrás es poner de nuevo el modelo anterior en la configuración: inmediato y sin desplegar.

### Caso 2 · Un 7 % de JSON inválidos

Un agente nuevo que genera fichas lee la respuesta con `parsear_json_llm`, y en el 7 % de los casos recibe `None`: 70 fichas de 1000 al día. De momento, esas fichas se descartan sin más.

El diagnóstico empieza por las salidas, no por el prompt. Abre una muestra de las 70 en la traza (tema 1); si el agente no guarda la respuesta cruda del modelo, guardarla es el primer paso. Luego clasifícalas: respuestas cortadas por el máximo de tokens, texto antes o después del JSON, campos con otro nombre, tipos equivocados. Cada causa tiene su arreglo, y a veces una sola explica casi todo.

El plan, por capas. Primero, forzar el esquema en la API donde el proveedor lo permita, como hace `batch_processor.py` con `JSON_SCHEMA_FICHA`. Segundo, validar campos y tipos después de leer el JSON, porque `parsear_json_llm` solo dice si hay un objeto, no si está completo. Tercero, un único reintento para las que no pasen: con las cifras del ejemplo, de 70 quedan 14. Cuarto, una cola de revisión para esas 14, el 1,4 %, en lugar de descartarlas. Quinto, contar las dos tasas, la del primer intento y la final, y poner una alerta cuando la del primer intento se salga de lo habitual: es la primera señal de que un cambio de modelo o de prompt ha estropeado el formato.

### Caso 3 · La alerta del 80 % con lo que ya existe

Te piden que FlipyERP avise cuando un módulo se acerque a su límite de gasto. Casi todo está hecho: falta la tarea que lo une.

La tarea es periódica, por ejemplo cada hora. Recorre las `ConfiguracionModuloIA` activas que tienen `limite_gasto_mes_usd`, se salta las que tienen `alerta_gasto_pct` a 0, que según el propio campo significa «sin alerta», y compara `pct_limite_usado()` con `alerta_gasto_pct`. Si lo alcanza, llama a `enviar_telegram_ops`. En el ejemplo del tema, 81,7 frente a 80: avisa.

El mensaje lleva el módulo, el gasto y el límite en USD, el porcentaje y el umbral, los días que quedan de mes, el modelo configurado y dónde mirar: el `AiCosteLog` de ese módulo. Así, quien lo lee puede decidir en un minuto si sube el límite, cambia de modelo o para un proceso.

Para no repetir el aviso cada hora, avisa una sola vez por mes y umbral: guarda que el módulo ya avisó del 80 % este mes y no vuelvas a hacerlo hasta el mes siguiente. `registrar_alerta` ya evita reenviar la misma alerta durante una ventana de horas (24 por defecto), pero eso aún daría un aviso diario durante todo el mes. Si quieres un segundo aviso al llegar al límite, usa `limite_alcanzado()`, porque `pct_limite_usado()` no pasa de 100.

Y un límite de la propia medida: el chat registra su coste sin `modulo`, así que `gasto_mes_actual()` no lo cuenta y ese gasto no entra en ninguna alerta. Para cubrirlo hay que darle al chat su módulo, como se vio en el tema 1.

### Caso 4 · El prompt «mejorado» que nadie probó

Alguien retoca el `system_prompt` de la versión activa de un agente directamente en la base de datos, «para que responda mejor». Nadie lo prueba y nadie crea una versión nueva.

Lo que se pierde es la atribución. Las `AiTarea` antiguas siguen apuntando con `prompt_version` a esa fila, pero el texto que hay ahora no es el que las generó. Ya no puedes reproducirlas, ni compararlas con las nuevas, ni volver a la versión anterior, porque su texto ha desaparecido. Si la calidad o el coste cambian, las gráficas por versión lo mezclan todo en una sola.

Para reconducirlo, recupera el texto original si puedes, por ejemplo de una copia de la base de datos, y déjalo en su versión. Crea con el texto retocado una versión nueva y anota desde qué momento se usó el retoque: las tareas de ese intervalo quedan marcadas como dudosas. Lanza la regresión de las dos sobre el mismo conjunto, lee la tabla de transiciones y activa la nueva solo si no rompe casos críticos. Y deja clara la regla para la próxima vez: la versión activa no se edita.

## Antes de seguir

- Sé qué se versiona junto (prompt de sistema, plantilla, modelo, temperatura y máximo de tokens) y por qué cada ejecución apunta a su versión.
- Sé por qué no se edita la versión activa y qué se pierde si alguien lo hace.
- Sé montar una regresión entre dos versiones y leer su tabla de transiciones.
- Sé por qué la media no basta y por qué hay que repetir cuando la diferencia es pequeña.
- Sé la diferencia entre forzar la salida estructurada en la API y validarla después, y qué debe comprobar la validación.
- Sé calcular el efecto de un reintento sobre las salidas inválidas y qué tasas vigilar.
- Sé qué hace buena a una alerta: pocas, accionables y por el canal habitual.
- Sé montar la alerta de gasto con lo que ya existe en FlipyERP y cómo evitar que se repita.
- Sé el proceso seguro para cambiar un prompt o un modelo, incluida la vuelta atrás.
