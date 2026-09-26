# Tema 1 · Observar un agente

No se puede mejorar lo que no se ve, ni pagarlo con conocimiento de causa. Un agente no hace una sola llamada al modelo: encadena varias, pide herramientas, recibe resultados y decide el siguiente paso. Este tema trata qué dejar registrado de cada ejecución (pasos, tokens, coste, tiempos, herramientas y errores) y cómo leerlo cuando algo va mal.

## Traza de una ejecución

Una **traza** es el registro ordenado y enlazado de todo lo que ocurre en una ejecución del agente: la entrada de la persona, cada llamada al modelo, cada herramienta que el modelo pide con sus argumentos, lo que esa herramienta devuelve y la respuesta final. «Ordenado» significa que se puede reproducir la secuencia; «enlazado», que cada resultado de herramienta apunta a la petición que lo originó.

La intuición es la caja negra de un avión. Saber que el vuelo acabó mal no sirve de nada; lo que permite entender el accidente es la secuencia completa de decisiones y lecturas de instrumentos, en orden.

### Un ejemplo paso a paso

Alguien escribe en el chat: «¿cuántos pedidos de Amazon hay pendientes de enviar?». El agente necesita tres llamadas al modelo. En la primera, el modelo no responde: pide una herramienta de consulta de pedidos, filtrando por canal Amazon y estado pendiente. En la segunda, ya con ese resultado, pide otra herramienta para afinar (por ejemplo, descartar los pedidos que ya tienen envío creado). En la tercera, con los dos resultados delante, responde.

| Paso | Quién | Qué | Enlace |
|---|---|---|---|
| 1 | Usuario | Hace la pregunta | — |
| 2 | Modelo (llamada 1) | Pide la herramienta de consulta de pedidos con sus argumentos | abre `tool_use_id` A |
| 3 | Herramienta | Devuelve la lista de pedidos pendientes | cierra A |
| 4 | Modelo (llamada 2) | Pide una segunda herramienta para descartar los que ya tienen envío | abre `tool_use_id` B |
| 5 | Herramienta | Devuelve qué pedidos tienen envío | cierra B |
| 6 | Modelo (llamada 3) | Responde con el recuento | — |

Si la respuesta es incorrecta, esta tabla te dice dónde mirar: si los argumentos del paso 2 filtraban mal el canal, el fallo es del modelo o del prompt; si los argumentos eran buenos y el resultado del paso 3 venía incompleto, el fallo es de la herramienta o de los datos. Sin traza solo tendrías la pregunta y un número equivocado.

El enlace por identificador importa más de lo que parece. Los modelos actuales pueden pedir varias herramientas en la misma respuesta; si guardas los resultados sin decir a qué petición contestan, con dos o tres herramientas en paralelo ya no sabes qué salida corresponde a qué entrada.

### Errores típicos

- Guardar solo la pregunta y la respuesta final: se pierde por qué el agente llegó ahí.
- No enlazar cada resultado con la petición que lo pidió: con varias herramientas a la vez la traza se vuelve ilegible.

### En FlipyERP

El chat guarda cada paso como un `AiMensaje` (`ai/models.py`). El campo `rol` distingue el tipo de paso (`user`, `tool_use`, `tool_result` y `assistant`), y los pasos de herramienta llevan `tool_name`, `tool_use_id` y `tool_input`, así que el enlace entre petición y resultado existe. `ChatService` (`ai/services/chat_service.py`) crea estos registros en cada vuelta de su bucle, con un máximo de `MAX_TOOL_ITERATIONS = 10` vueltas por respuesta. El ejemplo anterior quedaría como una fila `user`, dos parejas `tool_use`/`tool_result` y una fila `assistant`.

## Tokens y coste por llamada

Cada llamada al modelo consume **tokens de entrada** (todo lo que le envías: prompt de sistema, definición de herramientas, historial y pregunta) y **tokens de salida** (lo que genera). Tienen precios distintos, y la salida suele ser varias veces más cara por token. El coste de una llamada es, por tanto, los tokens de entrada por el precio de entrada más los tokens de salida por el precio de salida. La API devuelve ambas cifras en cada respuesta; registrarlas **por llamada**, junto con el modelo y el módulo que la hizo, es lo que permite atribuir el gasto.

La intuición es una factura de la luz desglosada por aparato. El total del mes te dice que gastas mucho; el desglose te dice que es el termo, y qué conviene apagar.

### El coste de la conversación del ejemplo

Toma la misma conversación de la traza y unos precios **ilustrativos**: 3 USD por millón de tokens de entrada y 15 USD por millón de tokens de salida.

| Llamada | Entrada | Salida | Coste |
|---|---|---|---|
| 1 (pide herramienta) | 2800 | 120 | 0,0102 USD |
| 2 (pide otra herramienta) | 4420 | 90 | 0,01461 USD |
| 3 (responde) | 5110 | 350 | 0,02058 USD |
| Total | 12 330 | 560 | 0,04539 USD |

Fíjate en cómo crece la entrada. El modelo no recuerda nada entre llamadas: cada una reenvía todo el historial. La primera lleva 2800 tokens, que son el prompt de sistema, las definiciones de herramientas y la pregunta. La segunda suma a eso los 120 tokens de la petición de herramienta que hizo el modelo y los 1500 del resultado: 4420. La tercera añade los 90 de la segunda petición y los 600 de su resultado: 5110.

Desglosado por tipo, la entrada cuesta 0,03699 USD y la salida 0,0084 USD, en total 0,04539 USD, unos 0,045 USD por conversación. La entrada es el 81,5 % del coste, aunque por token sea cinco veces más barata. A 1000 conversaciones así al mes, el chat cuesta 45,39 USD.

> **Idea clave.** En un agente con herramientas manda la entrada, no la salida. Cada vuelta reenvía el historial completo, así que un resultado de herramienta voluminoso se paga en todas las llamadas siguientes. Recortar lo que devuelven las herramientas suele ahorrar más que acortar las respuestas.

### Errores típicos

- Mirar solo la factura mensual del proveedor: no dice qué agente ni qué prompt gasta.
- Calcular con un único precio por token: entrada y salida tienen precios distintos y el error puede ser grande.
- Dar por hecho que todas las llamadas quedan registradas sin comprobar qué caminos del código no lo hacen.

### En FlipyERP

El coste va a `AiCosteLog` (`ai/models.py`), con `modelo_llm`, `modulo`, `tokens_input`, `tokens_output` y `coste_estimado_usd`. El importe lo calcula `AiCosteLog.calcular_coste` con una tabla de precios escrita en el código; si el modelo no aparece en ella, busca su precio en `ModeloIA` y, si tampoco está, aplica el precio de Sonnet.

Hay dos huecos. `AnthropicService.completar` (`ai/services/anthropic_client.py`) solo crea el `AiCosteLog` si recibe `tarea_id`: una llamada sin tarea no deja coste registrado. Y `ChatService` acumula los tokens de todas las vueltas y registra un único `AiCosteLog` por respuesta, con `tarea=None` y sin `modulo`, así que el gasto del chat no se puede atribuir a ningún módulo y tampoco se puede ver cuánto costó cada vuelta por separado.

## Latencia y duración

Hay dos medidas de tiempo distintas. La **latencia** de una llamada es lo que tarda una llamada concreta al modelo o a una herramienta. La **duración** de la ejecución es lo que espera la persona desde que pregunta hasta que tiene la respuesta, con todas las vueltas del bucle dentro. En un agente la duración suma varias latencias, así que hay que guardar las dos para saber qué paso es el lento.

La intuición es la espera en un restaurante. Al cliente no le importa lo que tarda el cocinero en un plato, sino cuánto pasa desde que pide hasta que come; y si la espera es larga, al encargado sí le importa saber si fue la cocina, el camarero o la caja.

### Media, mediana y p95

Estas son las latencias de 20 llamadas al modelo, en segundos: 1,8 · 2,1 · 1,9 · 2,4 · 2,0 · 2,2 · 1,7 · 2,3 · 2,1 · 1,9 · 2,0 · 2,6 · 2,2 · 1,8 · 2,5 · 2,1 · 9,8 · 2,0 · 14,5 · 2,3.

| Medida | Valor |
|---|---|
| Media | 3,11 s |
| Mediana (p50) | 2,10 s |
| p95 | 9,8 s |
| Media sin las dos lentas | 2,11 s |

La media, 3,11 s, no describe ninguna llamada real: las típicas tardan unos 2 s y las dos lentas tardan casi cinco y casi siete veces lo que la mediana. Son dos llamadas las que la arrastran; sin ellas baja a 2,11 s. La **mediana** es el valor central de la lista ordenada y dice cómo es la llamada típica. El **p95** (percentil 95) es el valor por debajo del cual queda el 95 % de las llamadas; aquí, con el método del rango más cercano, es el que ocupa la posición 19 de las 20 ordenadas: 9,8 s. Dice lo que sufre el 5 % más lento, que es justo lo que recuerda quien se queja.

> **Error típico.** Vigilar solo la media. Puede subir porque todas las llamadas van algo más lentas o porque unas pocas se han disparado, y son problemas con causas y arreglos distintos. Mira siempre la mediana y el p95 juntos.

### Errores típicos

- Medir solo la media: esconde los casos lentos, que son los que ve el usuario.
- Medir la ejecución completa sin desglose: no sabes si tarda el modelo, una herramienta o la cantidad de vueltas.

### En FlipyERP

`AiTarea` y `AiMensaje` (`ai/models.py`) tienen un campo `duracion_segundos`. `ChatService` calcula la latencia de cada llamada al modelo (`duracion = time.time() - inicio`) pero no la guarda en ningún campo, así que la latencia del chat no queda registrada.

## Auditar lo que hace el agente

**Auditar** las herramientas es registrar de cada llamada a una herramienta qué se hizo, quién lo pidió (usuario y empresa), con qué argumentos, cuánto tardó y si de verdad tuvo éxito. Las herramientas son la parte del agente que actúa: consultan, escriben, lanzan procesos. Una respuesta mala del modelo se lee y se descarta; una escritura mala se queda en la base de datos.

La intuición es el registro de entradas de un edificio. No basta con saber que alguien entró: hay que saber quién, cuándo, a qué planta, con qué autorización y si salió.

### Reconstruir una escritura una semana después

Un gestor le pide al agente que marque como enviado un pedido. El agente llama a una herramienta de escritura que cambia el estado. Una semana después, el cliente reclama porque el pedido nunca salió del almacén, y alguien pregunta quién lo marcó y por qué.

Para responder, el registro de esa llamada tiene que contener: la herramienta usada; el usuario y la empresa en cuyo nombre actuó el agente; los argumentos exactos (qué pedido y qué estado nuevo); el estado anterior, si quieres poder deshacer; el momento y la duración; y si la operación se aplicó de verdad. Si además está enlazado con la traza de la conversación, sabrás también qué pidió la persona con sus palabras, y podrás distinguir si se equivocó el gestor o lo entendió mal el agente.

> **Ojo.** En JSON-RPC, que es el protocolo que usa MCP, un error de la herramienta puede viajar dentro de una respuesta HTTP 200. El transporte ha ido bien y la operación ha fallado. Si decides el éxito por el código HTTP, esos fallos cuentan como aciertos.

### Errores típicos

- Tomar el código HTTP como prueba de éxito.
- No guardar los argumentos: sabes que se llamó a la herramienta, pero no qué hizo.
- Auditar igual lecturas y escrituras: las escrituras necesitan más detalle y control de permisos.

### En FlipyERP

`MCPUsageMiddleware` (`core/mcp_middleware.py`) guarda un `MCPToolUsage` (`core/models.py`) por cada petición MCP, con usuario, empresa, `duration_ms` y `success`. Ese `success` se calcula como `200 <= status_code < 400`, es decir, a partir del código HTTP, y el registro no guarda los argumentos de la llamada.

Las escrituras van aparte. `SystemWriteToolset` (`core/mcp_write.py`) comprueba en `_check_write_permission` que el usuario sea admin o gestor, y `_log_operation` audita cada operación como una `AiTarea` con `agente='mcp_write'` y `duracion_segundos=0`: la escritura queda registrada, pero sin su duración.

## Errores del proveedor, reintentos y fallback

Las APIs de modelos fallan, y no todos los fallos son iguales. Un **429** indica que has superado el límite de uso; un **529**, que el proveedor está sobrecargado; los **5xx** y los cortes de red son fallos transitorios. Todos ellos se reintentan con **espera creciente** (*backoff*): se espera un poco, luego el doble, y así sucesivamente, a ser posible con algo de azar para que los clientes no vuelvan todos a la vez. Un **400**, en cambio, dice que la petición está mal formada y fallará igual cada vez: no se reintenta. Cuando los reintentos se agotan, el **fallback** pasa la tarea a otro modelo o a otro proveedor.

La intuición es la línea que comunica. Si comunica, vuelves a llamar al rato, y cada vez esperas algo más; si sigue sin cogerlo, llamas a otro proveedor. Y apuntas cuántas veces pasó y a quién acabaste llamando.

### Una hora de saturación

Imagina una hora en la que el proveedor devuelve 529 a una parte de las peticiones. Si tu código reintenta al instante y sin límite, cada petición fallida se convierte en varias, la carga sobre el proveedor se multiplica y la saturación dura más; es un problema que tú mismo agravas. Con *backoff*, los reintentos se espacian, la mayoría de peticiones acaban entrando en el segundo o tercer intento y el servicio se recupera. Si aun así algunas agotan los reintentos, el fallback las manda a otro modelo; y si ese cambio queda registrado, al revisar la hora sabrás exactamente qué respuestas dio el modelo alternativo, cuánto costaron y si su calidad fue peor.

> **Truco.** Registra cada reintento y cada fallback como un evento más de la traza, con el código de error que lo provocó. Un aumento de reintentos avisa de problemas en el proveedor antes de que lleguen las quejas.

### Errores típicos

- Reintentar cualquier error: un 400 fallará igual cada vez.
- Reintentar sin espera: empeora la saturación que causó el error.
- Hacer fallback sin registrarlo: la respuesta la dio otro modelo y nadie lo sabe.

### En FlipyERP

`LLMRouter` (`ai/services/llm_router.py`) elige proveedor según la configuración y el mapa `ROUTING_TAREAS`, y si el primero falla lo intenta con otro. La cabecera de `ai/services/anthropic_client.py` anuncia «Retry automatico con backoff», pero el fichero no implementa reintentos propios: dependen de los que traiga por defecto el SDK de Anthropic.

## Chuleta

**Qué registrar de cada llamada**

| Dato | Para qué |
|---|---|
| Entrada y salida, o una referencia a ellas | Reconstruir qué pasó |
| Modelo y versión de prompt | Comparar y explicar cambios de comportamiento |
| Tokens de entrada y de salida | Calcular y atribuir el coste |
| Coste | Sumar por módulo, agente o usuario |
| Latencia | Mediana y p95 por paso |
| Herramienta y argumentos | Saber qué hizo el agente |
| Éxito real | Distinguir «la petición llegó» de «la herramienta hizo su trabajo» |
| Usuario y empresa | Saber en nombre de quién actuó |
| Fallback usado | Saber qué modelo respondió de verdad |

**¿Se reintenta?**

| Error | ¿Se reintenta? |
|---|---|
| 429, límite de uso | Sí, con espera |
| 529, sobrecarga | Sí, con espera |
| 5xx y red | Sí, con espera |
| 400, petición mal formada | No |
| 401 y 403, autenticación y permisos | No |

**Huecos actuales de FlipyERP**

| Hueco | Dónde |
|---|---|
| El coste de una llamada sin `tarea_id` no se guarda | `AnthropicService.completar` |
| El coste del chat no lleva `modulo` | `ChatService` |
| La latencia del chat se calcula y no se guarda | `ChatService` |
| El éxito se decide por el código HTTP | `MCPToolUsage.success` |
| No se guardan los argumentos | `MCPToolUsage` |
| Reintentos anunciados en la cabecera y no implementados | `ai/services/anthropic_client.py` |

## Casos prácticos

### Caso 1 · El chat va lento

Un usuario comenta que el chat «tarda muchísimo» en contestar a algunas preguntas.

Primero, localiza la conversación y lee su traza en `AiMensaje`. Como la latencia de cada llamada no se guarda, no puedes saber cuánto tardó cada paso; lo que sí puedes ver es cuántas parejas `tool_use`/`tool_result` hubo y qué herramientas se usaron. Una respuesta que necesitó muchas vueltas, cerca del límite de diez, va a ser lenta aunque cada llamada sea rápida, y eso ya orienta: quizá falta una herramienta que devuelva de golpe lo que el agente reconstruye en varios pasos, o el prompt no le dice cuándo parar.

Segundo, arregla el hueco: guarda la `duracion` que `ChatService` ya calcula en el campo `duracion_segundos`, que existe. Con unos días de datos, mira la mediana y el p95 de las llamadas al modelo y compáralos con los de la duración total. Para tenerla, guárdala también o, mientras tanto, estímala con la diferencia entre el `created_at` del mensaje del usuario y el del mensaje final del asistente en `AiMensaje`. Si la mediana por llamada es normal y la duración total es alta, el problema es el número de vueltas; si el p95 por llamada se dispara, el problema está en el proveedor o en entradas muy largas. No uses la media para decidirlo.

### Caso 2 · La factura sube y los informes no cuadran

La factura del proveedor de este mes es claramente mayor que la suma de `coste_estimado_usd` en `AiCosteLog`.

Parte de lo que sabes: `AnthropicService.completar` no registra nada si no recibe `tarea_id`, así que toda llamada hecha por ese camino sin tarea es gasto invisible. Para localizarlo, compara la factura y `AiCosteLog` agrupando por modelo y por día. Si la diferencia se concentra en un modelo concreto o empieza un día concreto, busca qué código llama a `AnthropicService.completar` con ese modelo y sin `tarea_id`, y qué se desplegó ese día.

Hay un segundo problema que no crea diferencia, pero sí confusión: el chat registra su coste con `tarea=None` y sin `modulo`. Esas filas sí suman, pero no se pueden atribuir, y si alguien hace el informe por módulo el chat desaparece. La solución completa pasa por registrar siempre el coste, con o sin tarea, y darle al chat su propio módulo.

### Caso 3 · Una herramienta falla pero figura como éxito

Un usuario dice que el agente le confirmó un cambio que no se aplicó. En `MCPToolUsage` la llamada figura con `success` verdadero.

La explicación está en cómo se calcula: `success` sale del código HTTP. En MCP el transporte es JSON-RPC, y un error de la herramienta puede ir dentro del cuerpo de una respuesta con código 200. Para el middleware la petición salió bien; para el usuario, no. Además, como `MCPToolUsage` no guarda argumentos, tampoco puedes ver qué intentaba cambiar la llamada.

Para decidir el éxito real hay que mirar el cuerpo de la respuesta: si trae un error de JSON-RPC o si el resultado de la herramienta viene marcado como error, la llamada fracasó aunque el HTTP diga 200. En las escrituras, mejor aún, que la propia herramienta informe de si aplicó el cambio. Y guarda los argumentos, al menos en las escrituras.

### Caso 4 · Un fallback silencioso

Durante una mañana las respuestas de un agente empeoran: más vagas y con algún error de formato. No hay errores en los registros.

La causa probable es que el proveedor principal falló y `LLMRouter` pasó la tarea a otro, que respondió sin error pero con otra calidad. Si no se registra qué modelo respondió cada vez, no hay forma de confirmarlo ni de saber a cuántas respuestas afectó. `AiCosteLog` guarda `modelo_llm`, pero solo cuando la llamada deja registro de coste, y en ningún caso indica que ese modelo entró como alternativa.

El dato que falta en la traza es, por cada llamada, el modelo y el proveedor que respondieron, si fue un fallback y qué error lo provocó. Con eso, esa mañana se explica en minutos y se puede avisar cuando la proporción de fallbacks suba.

### Caso 5 · Diseñar la traza completa del chat

Te piden proponer qué debería guardar cada paso del chat para poder responder siempre a cuatro preguntas: qué pasó, cuánto costó, cuánto tardó y quién lo pidió.

Parte de lo que ya hay y añade lo que falta:

| Campo por paso | Pregunta que responde | ¿Existe ya? |
|---|---|---|
| `rol` y contenido | Qué pasó | Sí, en `AiMensaje` |
| `tool_name`, `tool_use_id`, `tool_input` | Qué pasó | Sí, en `AiMensaje` |
| Éxito real de la herramienta | Qué pasó | No |
| Modelo que respondió y si fue fallback | Qué pasó | No por paso; el chat usa un modelo fijo |
| Tokens de entrada y salida por llamada | Cuánto costó | Solo el total, en el mensaje final |
| Coste con `modulo` | Cuánto costó | Un `AiCosteLog` por respuesta, sin `modulo` |
| Latencia de cada llamada | Cuánto tardó | Se calcula y no se guarda |
| Usuario y empresa | Quién lo pidió | A través de la conversación |

Con esta tabla, la propuesta se reduce a tres cambios: guardar tokens y latencia por llamada, en lugar de solo el total; dar módulo al coste del chat; y añadir a cada paso de herramienta su éxito real, y a cada llamada al modelo qué modelo respondió.

## Antes de seguir

- Sé qué es una traza, qué pasos recoge y por qué cada resultado de herramienta tiene que enlazarse con su petición.
- Sé calcular el coste de una llamada a partir de sus tokens de entrada y de salida y de sus precios.
- Sé explicar por qué en un agente con herramientas la entrada domina el coste.
- Sé por qué la mediana describe la llamada típica mejor que la media y qué indica el p95.
- Sé qué hay que auditar de cada llamada a una herramienta, sobre todo si escribe.
- Sé por qué un código HTTP 200 no basta para dar una herramienta por buena.
- Sé qué errores del proveedor se reintentan, cuáles no y por qué hace falta esperar entre intentos.
- Sé por qué un fallback tiene que quedar registrado.
- Sé cuáles son los huecos de observabilidad actuales de FlipyERP y dónde están.
