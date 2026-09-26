# FlipyERP Academy · contexto para Claude Code

App de formación gamificada del Grupo Troviscal en **academy.flipyerp.com**.
Es un fork de **Atlas** (app de estudio de Hugo: `upstream` = github.com/Hugelidus/atlas),
convertido en academia **multiusuario**. Sirve para formar a Raul mientras
desarrolla FlipyERP y para formar a empleados nuevos con itinerarios por nivel
(desde cero, medio, avanzado o a medida).

## Reglas

- Todo en **español**: UI, comentarios, commits (formato convencional).
- **No tocar el motor de Atlas** (`src/domain/`: FSRS, cola, misiones, gamificación)
  salvo que sea imprescindible: así se pueden seguir trayendo mejoras de `upstream`.
  Los cambios de la academia van en `server/academy/`, `src/state/session.ts`,
  `content/` y en extensiones opcionales de tipos.
- **Tests siempre en verde** antes de commit: `npm test` (hoy 186/186), `npm run check`
  y `node scripts/validate-content.cjs content` (0 errores).
- En este Windows hay **`NODE_ENV=production` global**: instalar con
  `npm ci --include=dev` o los tests y `tsc` no existen.
- **No editar ficheros con `Set-Content`/`Out-File` de PowerShell**: rompe el UTF-8
  (ya pasó con `server/serve.mjs`). Usar el editor.
- Nada de credenciales ni datos reales de clientes en el contenido.

## Arquitectura

- Frontend: React 19 + TypeScript + Vite + Tailwind 4 (el de Atlas).
- Servidor: Node (`server/serve.mjs`). **Modo academia si existe `DATABASE_URL`**;
  sin ella funciona como el Atlas original (un usuario, `userdata/state.json`).
- `server/academy/`:
  - `migrations/*.sql` — organizaciones, usuarios, sesiones, invitaciones,
    enrollments (itinerario asignado), `user_states` (estado por alumno) y copias.
  - `api.mjs` — login, invitaciones, `/api/me`, panel admin y el **mismo contrato
    `GET/PUT /api/state` de Atlas** (rev + 409), pero por alumno. Sin sesión no se
    sirve ni la SPA: redirige a `/login`, la API responde 401.
  - `security.mjs` (scrypt, tokens hasheados, cookies, rate limit), `catalog.mjs`
    (itinerarios + cierre de prerrequisitos), `cli.mjs` (migrate, bootstrap, reset-password).
- `server/public/login.html` y `admin.html`: páginas autónomas (DOM con textContent, sin HTML inyectado).
- Frontend de la academia: `src/state/session.ts`, `applyEnrollment()` en
  `src/state/catalog.ts` (las constelaciones asignadas pasan a `status: "current"`),
  caché local **por usuario** en `src/state/store.ts`, `AccountMenu.tsx`,
  colores desde `content/subjects.json` (`src/ui/subjects.ts`),
  `ResourcesSection` en la ficha de concepto.
- Roles: `admin` (todo), `formador` (solo alumnos de su organización), `alumno`.

## Contenido (`content/`)

- `subjects.json` — constelaciones, con campos extra de la academia:
  `abbr`, `colorLight`, `level` (0-3), `track`, `audience`, `prerequisites`, `description`.
- `itineraries.json` — cero, desarrollo, avanzado.
- `fundamentos.json` — nivel 0, 7 conceptos, recursos de Anthropic Academy.
- `tenancy.json` — «FlipyERP por dentro · Multi-empresa», 12 conceptos sacados del
  código real de FlipyERP. Cada concepto lleva `sources` (rutas relativas a
  `FlipyERP_v1.0.1/`); el validador comprueba que existen con
  `FLIPYERP_ROOT=D:\Claude\Projects\FlipyERP\FlipyERP_v1.0.1`.
- Ids de concepto: `^[a-z]+\.[a-z0-9_]+$`; ≥3 preguntas por concepto si tiene alguna;
  sin `$` sueltos (es KaTeX). Guía de apuntes: `docs/apuntes-guia.md`.

## Despliegue (`deploy/`)

Mismo modelo que FlipyERP (systemd + PostgreSQL local + nginx del host, sin Docker),
como servicio **independiente**: usuario `academy`, BD `academy` (auth peer por
socket, sin contraseña), servicio `flipyerp-academy` en 127.0.0.1:8090,
vhost `academy.flipyerp.com`. Guía paso a paso: `deploy/DESPLIEGUE.md`.
`deploy/deploy.sh` compila y pasa tests antes de tocar el servicio; copia la BD,
migra, health check y rollback.

- Servidor: Hetzner 88.99.212.58 (el de FlipyERP, `/opt/flipyerp`).
- DNS: `academy.flipyerp.com` A → 88.99.212.58 (creado en DonDominio, propagado).

## Estado (2026-09-26)

Hecho: rama `academy/fase1` con el modo multiusuario, contenido inicial, tests y
ficheros de despliegue. Subida a GitHub (`origin` = BOUROA/atlas).

Siguiente, en este orden:

1. Revisar y fusionar `academy/fase1` en `main` (la guía clona `main`).
2. Probar en local contra un PostgreSQL real (Docker Desktop estaba parado;
   los tests usan pg-mem). Con Docker:
   `docker run -d --name academy-pg -e POSTGRES_PASSWORD=dev -p 5433:5432 postgres:16`
   y `DATABASE_URL=postgres://postgres:dev@localhost:5433/postgres npm run dev`.
   Crear admin con `node server/academy/cli.mjs bootstrap ...` y recorrer
   login → invitar → aceptar → estudiar → panel.
3. Instalación en Hetzner siguiendo `deploy/DESPLIEGUE.md`. **Es el servidor de
   producción de FlipyERP: enseñar cada comando a Raul antes de ejecutarlo.**
4. Contenido: Bloque 1 de evals y observabilidad de agentes, apuntes largos por
   tema, constelaciones de herramientas (Git/GitHub, Python/Django) y de
   operaciones (Vendor Central, GPSR, supresión de búsqueda).
5. Después: prueba de nivel inicial, misiones ligadas a PRs de BOUROA/FlipyERP,
   aviso en CI cuando cambian las `sources` de una lección, tutor con Claude.

Pendientes menores: el favicon no carga en `/login` (el estático exige sesión);
los ajustes por defecto de Atlas están pensados para un grado (120 min/día, nota 10).
