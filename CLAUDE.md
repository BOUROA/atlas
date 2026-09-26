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
- **Tests siempre en verde** antes de commit: `npm test` (hoy 194/194), `npm run check`
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
- `evals.json` — «Evals y observabilidad de agentes» (EVO, nivel 2, itinerarios
  desarrollo y avanzado), 15 conceptos en 3 temas: observar, evaluar, cerrar el
  bucle. Enfoque mixto: idea general y, cuando existe, cómo está en FlipyERP
  (con `sources`, incluidos los huecos actuales). Diseño y plan en
  `atlas/docs/superpowers/`; `tests/evals-content.test.ts` fija su estructura.
- Ids de concepto: `^[a-z]+\.[a-z0-9_]+$`; ≥3 preguntas por concepto si tiene alguna;
  sin `$` sueltos (es KaTeX). Apuntes largos por tema en
  `content/apuntes/<asignatura>/<unidad>.md` según `docs/apuntes-guia.md` (adaptada a la
  academia: sin código, `Chuleta`, `Casos prácticos`, `Antes de seguir`), validados con
  `node scripts/validate-notes.cjs` (0 errores, 0 avisos). Hechos: los 3 temas de evals.

## Despliegue (`deploy/`)

Mismo modelo que FlipyERP (systemd + PostgreSQL local + nginx del host, sin Docker),
como servicio **independiente**: usuario `academy`, BD `academy` (auth peer por
socket, sin contraseña), servicio `flipyerp-academy` en 127.0.0.1:8090,
vhost `academy.flipyerp.com`. Guía paso a paso: `deploy/DESPLIEGUE.md`.
`deploy/deploy.sh` compila y pasa tests antes de tocar el servicio; copia la BD,
migra, health check y rollback.

- Servidor: Hetzner 88.99.212.58 (el de FlipyERP, `/opt/flipyerp`), Ubuntu 24.04,
  nginx 1.24 (sin `http2 on;`). **Root deshabilitado y fail2ban activo**: entrar
  como `flipy@88.99.212.58` (o el alias `flipy` de `~/.ssh/config`;
  unos pocos intentos fallidos banean la IP). La clave `id_ed25519` tiene
  passphrase y está en el ssh-agent de Windows: usar
  `/c/Windows/System32/OpenSSH/ssh.exe`, no el ssh de Git Bash.
- Node 22 aislado en `/opt/node22` (tarball oficial): el Node 18 de Ubuntu del
  sistema tiene paquetes `node-*` que dependen de él y no se toca.
- `academy` no puede leer `/opt/flipyerp` (750, secretos del ERP): las `sources`
  se validan en local, no en el servidor.
- DNS: `academy.flipyerp.com` A → 88.99.212.58 (creado en DonDominio, propagado).

## Estado (2026-09-26)

Hecho:

- Modo multiusuario, contenido inicial, tests y ficheros de despliegue, en `main`
  (GitHub `origin` = BOUROA/atlas).
- Probado en local contra PostgreSQL 16 real (login → invitar «cero» → aceptar →
  estudiar → panel).
- **En producción desde el 2026-09-26** en https://academy.flipyerp.com: servicio
  `flipyerp-academy` activo, certificado Let's Encrypt (renovación automática por
  el plugin nginx), admin de Raul creado. Despliegues siguientes:
  `ssh -t flipy@88.99.212.58 "sudo -iu academy bash /opt/academy/deploy/deploy.sh"`.

Probar en local (el 5433 y el 5434 los usan los Postgres de FlipyERP y Odoo):
`docker run -d --name academy-pg -e POSTGRES_PASSWORD=dev -p 127.0.0.1:5435:5432 postgres:16`
y, desde `atlas/`, `DATABASE_URL=postgres://postgres:dev@127.0.0.1:5435/postgres npm run dev`.
Admin con `ACADEMY_PASSWORD=... node server/academy/cli.mjs bootstrap --org ... --email ... --name ...`.

Cualquier cambio en el servidor: **es la producción de FlipyERP**; enseñar los
comandos a Raul antes de ejecutarlos salvo que diga lo contrario, y `nginx -t`
antes de cada recarga.

Las matrículas guardan la lista de constelaciones resuelta al guardarlas
(`enrollments.subject_ids`, también las invitaciones pendientes): si se añade
una constelación a un itinerario, los alumnos ya matriculados no la ven hasta
volver a guardar su matrícula desde `/admin` (y las invitaciones pendientes hay
que reenviarlas). Al añadir `evals` (2026-09-26) en producción solo existía el
admin, así que no hubo que migrar a nadie.

Siguiente, en este orden:

1. Contenido: apuntes largos de Fundamentos y Multi-empresa (los de evals están
   hechos, pendientes de desplegar), constelaciones de herramientas
   (Git/GitHub, Python/Django) y de operaciones (Vendor Central, GPSR,
   supresión de búsqueda). Bloque 1 de evals hecho y desplegado en producción (2026-09-26, c694b36).
2. Después: prueba de nivel inicial, misiones ligadas a PRs de BOUROA/FlipyERP,
   aviso en CI cuando cambian las `sources` de una lección, tutor con Claude.

Pendientes menores: el favicon no carga en `/login` (el estático exige sesión);
los ajustes por defecto de Atlas están pensados para un grado (120 min/día, nota 10,
«Faltan N días para el inicio · primer cuatrimestre» en Hoy); el título de la
pestaña sigue diciendo «Hoy · Atlas» / «Sesión · Atlas»;
`X-Frame-Options` sale duplicada (app + nginx); aviso de `proxy_headers_hash` en
`nginx -t` (configuración general del servidor, no de la academia).
