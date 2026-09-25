# Atlas

App personal de estudio con estética de cielo nocturno. Cada concepto es una estrella que se enciende cuando lo dominas y se apaga si dejas de repasarlo, y cada asignatura es una constelación. Atlas propone qué estudiar cada día, programa los repasos (FSRS), lleva notas y exámenes y añade gamificación: niveles, misiones y racha.

Este repo trae **solo el código** y una asignatura de ejemplo (Probabilidad) para que arranque. El contenido real es cosa tuya: catálogo de conceptos, pruebas y apuntes.

## Arrancar

Requisito: [Node.js 22](https://nodejs.org/) o posterior.

- **Windows:** doble clic en `Iniciar Atlas.cmd`. La primera vez instala y compila; después abre <http://localhost:5173/>.
- **Cualquier sistema:**

  ```bash
  cd atlas
  npm ci
  npm run dev      # desarrollo en http://localhost:5173
  ```

Los datos del usuario se guardan en `atlas/userdata/state.json`, en local y fuera de git. `node scripts/demo-state.mjs <carpeta>` genera un estado de demostración; úsalo con `ATLAS_DATA_DIR=<carpeta> npm run dev`.

## Arquitectura

SPA de React 19 + TypeScript + Vite + Tailwind 4, con un servidor Node mínimo que guarda el estado en un JSON local. No hay base de datos ni cuentas.

```
atlas/
├─ content/        catálogo empaquetado con la app (JSON + Markdown)
│  ├─ subjects.json          asignaturas
│  ├─ <asignatura>.json      temas, conceptos y relaciones «requiere»
│  ├─ trials/                pruebas (controles, parciales, finales) con solución y rúbrica
│  ├─ apuntes/               apuntes por tema en Markdown + KaTeX
│  └─ expeditions/legends/profiles.json   misiones y «estrellas guía» (vacíos aquí)
├─ src/
│  ├─ domain/      lógica pura y testeada: grafo de conceptos, tutor FSRS, cola del día,
│  │               plan diario, rumbo a exámenes, notas, gamificación
│  ├─ state/       store, derivados incrementales, acciones, rutas por hash, sincronización
│  ├─ ui/          sistema de diseño «Observatorio» (primitivas, iconos, Markdown/KaTeX)
│  └─ features/    pantallas: hoy, sesión, asignaturas, mapa, misiones, prueba, apuntes, progreso, ajustes
├─ server/         sirve dist/ y una API mínima de lectura/escritura del estado
├─ scripts/        validadores de contenido y estado de demostración
├─ tests/          node:test sobre el dominio (npm test)
└─ docs/
   ├─ diseno-visual.md       tokens, tipografía, iconos y reglas de densidad
   └─ maquetas/              maquetas HTML elegidas y descartadas (ver su README)
```

**Flujo de datos:**

1. El catálogo (`content/`) es inmutable y se empaqueta en la build.
2. El estado del usuario es una lista de eventos (repasos, clases, pruebas…) más ajustes.
3. `src/state/derive-core.ts` calcula a partir de ambos el progreso de cada concepto y todo lo que pintan las pantallas.
4. Las pantallas leen derivados y emiten acciones que añaden eventos.

**Para adaptarlo a tus asignaturas:**

1. Cambia `content/`; el ejemplo de Probabilidad sirve de plantilla.
2. Ejecuta `npm run validate`.
3. Los colores e identidad de cada asignatura están en `src/ui/subjects.ts` y `src/styles/tokens.css` (`--s-<id>`).

## Comandos

```bash
npm run dev        # desarrollo
npm test           # tests del dominio
npm run check      # tipos
npm run validate   # valida content/
npm run build      # build de producción en dist/
npm start          # sirve dist/ + API en http://localhost:5173
```

## Licencia

MIT. Ver [LICENSE](LICENSE).
