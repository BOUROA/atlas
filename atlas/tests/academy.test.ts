// Tests de integración del modo academia (multiusuario) sobre pg-mem:
// autenticación, invitaciones, itinerarios, aislamiento del estado entre
// alumnos, permisos de formador/admin y protección CSRF.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";
import { migrate } from "../server/academy/db.mjs";
import { buildCatalogMeta, closeOverPrerequisites, resolveEnrollment, EnrollmentError } from "../server/academy/catalog.mjs";
import { createAcademyApi, progressSummary, safeNext } from "../server/academy/api.mjs";
import { createRateLimiter, hashPassword, verifyPassword, parseCookies } from "../server/academy/security.mjs";

const CONTENT = join(process.cwd(), "content");
const PUBLIC = join(process.cwd(), "server", "public");
const subjects = JSON.parse(readFileSync(join(CONTENT, "subjects.json"), "utf8"));
const itineraries = JSON.parse(readFileSync(join(CONTENT, "itineraries.json"), "utf8"));

let server: http.Server;
let base = "";
let pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

const emptyState = () => ({
  version: 2, createdAt: "2026-09-26T00:00:00.000Z", settings: {}, events: [], sessions: [],
  notes: {}, subjects: {}, achievements: {}, seen: { achievements: [], levelShown: 1 },
});

/** Cliente HTTP mínimo con su propia cookie de sesión. */
function client() {
  let cookie = "";
  return {
    async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const res = await fetch(base + path, {
        method,
        redirect: "manual",
        headers: {
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* html */
      }
      return { status: res.status, json, text, location: res.headers.get("location") };
    },
  };
}

async function login(email: string, password: string) {
  const c = client();
  const r = await c.req("POST", "/api/auth/login", { email, password });
  assert.equal(r.status, 200, `login de ${email}: ${JSON.stringify(r.json)}`);
  return c;
}

before(async () => {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  pool = new Pool();
  await migrate(pool);
  await pool.query("INSERT INTO organizations (id, name) VALUES ('org-g', 'Grupo'), ('org-b', 'Otra sociedad')");
  const pw = await hashPassword("admin-clave-segura");
  await pool.query(
    "INSERT INTO users (id, organization_id, email, name, role, password_hash) VALUES ('u-admin', 'org-g', 'admin@grupo.es', 'Admin', 'admin', $1)",
    [pw],
  );
  const fpw = await hashPassword("formador-clave-1");
  await pool.query(
    "INSERT INTO users (id, organization_id, email, name, role, password_hash) VALUES ('u-form', 'org-b', 'form@otra.es', 'Formadora', 'formador', $1)",
    [fpw],
  );
  const handler = createAcademyApi({ pool, meta: buildCatalogMeta(subjects, itineraries), publicDir: PUBLIC });
  server = http.createServer((req, res) => {
    void handler(req, res, () => {
      res.statusCode = 200;
      res.setHeader("content-type", "text/html");
      res.end("<!doctype html><title>SPA</title>");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  server?.close();
});

test("sin sesión: la app redirige al login y la API responde 401", async () => {
  const c = client();
  const page = await c.req("GET", "/hoy?x=1");
  assert.equal(page.status, 302);
  assert.equal(page.location, "/login?next=%2Fhoy%3Fx%3D1");
  assert.equal((await c.req("GET", "/api/me")).status, 401);
  assert.equal((await c.req("GET", "/api/state")).status, 401);
  assert.equal((await c.req("GET", "/assets/index.js")).status, 401);
  assert.equal((await c.req("GET", "/api/health")).status, 200);
  const loginPage = await c.req("GET", "/login");
  assert.equal(loginPage.status, 200);
  assert.match(loginPage.text, /FlipyERP Academy/);
});

test("login: credenciales erróneas, sesión válida y cierre de sesión", async () => {
  const bad = await client().req("POST", "/api/auth/login", { email: "admin@grupo.es", password: "mala" });
  assert.equal(bad.status, 401);
  const unknown = await client().req("POST", "/api/auth/login", { email: "nadie@grupo.es", password: "x" });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.json.error, bad.json.error, "el error no revela si el email existe");

  const c = await login("ADMIN@grupo.es ", "admin-clave-segura");
  const me = await c.req("GET", "/api/me");
  assert.equal(me.status, 200);
  assert.equal(me.json.user.role, "admin");
  assert.deepEqual(me.json.enrollment.subjectIds, subjects.map((s: { id: string }) => s.id), "sin itinerario: todas");
  assert.equal((await c.req("GET", "/")).status, 200, "con sesión se sirve la SPA");

  assert.equal((await c.req("POST", "/api/auth/logout", {})).status, 200);
  assert.equal((await c.req("GET", "/api/me")).status, 401);
});

test("CSRF: las mutaciones exigen JSON y mismo origen", async () => {
  const noJson = await client().req("POST", "/api/auth/login", undefined, { "content-type": "application/x-www-form-urlencoded" });
  assert.equal(noJson.status, 415);
  const foreign = await client().req("POST", "/api/auth/login", { email: "a@b.es", password: "x" }, { origin: "https://evil.example" });
  assert.equal(foreign.status, 403);
});

test("invitación: el alumno entra con su itinerario y el enlace no se reutiliza", async () => {
  const admin = await login("admin@grupo.es", "admin-clave-segura");
  const inv = await admin.req("POST", "/api/admin/invitations", {
    email: "nuevo@grupo.es", name: "Nuevo", role: "alumno", organizationId: "org-g", itineraryId: "cero", subjectIds: [],
  });
  assert.equal(inv.status, 201, JSON.stringify(inv.json));
  const token = new URL(inv.json.url).searchParams.get("invite")!;
  assert.ok(token);

  const guest = client();
  const info = await guest.req("GET", `/api/auth/invite?token=${encodeURIComponent(token)}`);
  assert.equal(info.json.email, "nuevo@grupo.es");
  const short = await guest.req("POST", "/api/auth/accept-invite", { token, name: "Nuevo", password: "corta" });
  assert.equal(short.status, 400);
  const ok = await guest.req("POST", "/api/auth/accept-invite", { token, name: "Nuevo Empleado", password: "una-frase-larga-1" });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));

  const me = await guest.req("GET", "/api/me");
  assert.equal(me.json.user.role, "alumno");
  assert.deepEqual(me.json.enrollment, { itineraryId: "cero", subjectIds: ["fundamentos"] });

  const again = await client().req("POST", "/api/auth/accept-invite", { token, name: "Otro", password: "una-frase-larga-2" });
  assert.equal(again.status, 404);
  const dup = await admin.req("POST", "/api/admin/invitations", { email: "nuevo@grupo.es", itineraryId: "cero" });
  assert.equal(dup.status, 409);
});

test("estado: contrato de Atlas (rev y 409) y aislamiento entre alumnos", async () => {
  const admin = await login("admin@grupo.es", "admin-clave-segura");
  const alumno = await login("nuevo@grupo.es", "una-frase-larga-1");

  assert.deepEqual((await alumno.req("GET", "/api/state")).json, { rev: 0, state: null });
  const s1 = { ...emptyState(), events: [{ id: "e1", at: "2026-09-26T10:00:00.000Z", conceptId: "fund.llm", kind: "seen", source: "concept" }] };
  const put1 = await alumno.req("PUT", "/api/state", { baseRev: 0, state: s1 });
  assert.deepEqual(put1.json, { rev: 1 });

  const conflict = await alumno.req("PUT", "/api/state", { baseRev: 0, state: emptyState() });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.json.rev, 1);
  assert.equal(conflict.json.state.events.length, 1, "el 409 devuelve el estado guardado para fusionar");

  const put2 = await alumno.req("PUT", "/api/state", { baseRev: 1, state: s1 });
  assert.deepEqual(put2.json, { rev: 2 });
  assert.equal((await alumno.req("PUT", "/api/state", { baseRev: 2, state: { version: 1 } })).status, 400);

  assert.deepEqual((await admin.req("GET", "/api/state")).json, { rev: 0, state: null }, "el admin no ve el estado del alumno");
  const mine = await alumno.req("GET", "/api/state");
  assert.equal(mine.json.rev, 2);
  assert.equal(mine.json.state.events[0].conceptId, "fund.llm");
});

test("permisos: un alumno no entra al panel ni a la API de administración", async () => {
  const alumno = await login("nuevo@grupo.es", "una-frase-larga-1");
  assert.equal((await alumno.req("GET", "/api/admin/overview")).status, 403);
  const page = await alumno.req("GET", "/admin");
  assert.equal(page.status, 302);
  assert.equal(page.location, "/");
});

test("formador: solo gestiona alumnos de su organización", async () => {
  const form = await login("form@otra.es", "formador-clave-1");
  const asFormador = await form.req("POST", "/api/admin/invitations", { email: "x@otra.es", role: "formador", itineraryId: "cero" });
  assert.equal(asFormador.status, 403);
  const inv = await form.req("POST", "/api/admin/invitations", {
    email: "alumna@otra.es", role: "alumno", organizationId: "org-g", itineraryId: null, subjectIds: ["tenancy"],
  });
  assert.equal(inv.status, 201);
  const token = new URL(inv.json.url).searchParams.get("invite")!;
  const alumna = client();
  await alumna.req("POST", "/api/auth/accept-invite", { token, name: "Alumna", password: "otra-frase-larga" });
  const me = await alumna.req("GET", "/api/me");
  assert.equal(me.json.organization.id, "org-b", "la organización la fija el formador, no el cuerpo de la petición");
  assert.deepEqual(me.json.enrollment, { itineraryId: null, subjectIds: ["tenancy"] });

  const overview = await form.req("GET", "/api/admin/overview");
  const emails = overview.json.users.map((u: { email: string }) => u.email).sort();
  assert.deepEqual(emails, ["alumna@otra.es", "form@otra.es"], "no ve usuarios de otras organizaciones");

  const other = (await pool.query("SELECT id FROM users WHERE email = 'nuevo@grupo.es'")).rows[0].id as string;
  assert.equal((await form.req("PUT", `/api/admin/users/${other}/enrollment`, { itineraryId: "avanzado" })).status, 403);

  const mineId = me.json.user.id as string;
  const upd = await form.req("PUT", `/api/admin/users/${mineId}/enrollment`, { itineraryId: "desarrollo", subjectIds: [] });
  assert.deepEqual(upd.json.enrollment.subjectIds, ["fundamentos", "tenancy", "evals"]);
  assert.deepEqual((await alumna.req("GET", "/api/me")).json.enrollment.itineraryId, "desarrollo");
  assert.equal((await form.req("PUT", `/api/admin/users/${mineId}/enrollment`, { itineraryId: "no-existe" })).status, 400);
});

test("desactivar a una persona cierra sus sesiones y conserva su progreso", async () => {
  const admin = await login("admin@grupo.es", "admin-clave-segura");
  const alumno = await login("nuevo@grupo.es", "una-frase-larga-1");
  const id = (await alumno.req("GET", "/api/me")).json.user.id as string;
  const overview = await admin.req("GET", "/api/admin/overview");
  const row = overview.json.users.find((u: { id: string }) => u.id === id);
  assert.equal(row.progress.concepts, 1);
  assert.equal(row.state, undefined, "el panel no expone el estado completo");

  assert.equal((await admin.req("PUT", `/api/admin/users/${id}/active`, { active: false })).status, 200);
  assert.equal((await alumno.req("GET", "/api/me")).status, 401);
  assert.equal((await client().req("POST", "/api/auth/login", { email: "nuevo@grupo.es", password: "una-frase-larga-1" })).status, 401);
  assert.equal((await admin.req("PUT", `/api/admin/users/u-admin/active`, { active: false })).status, 400, "nadie se desactiva a sí mismo");
  await admin.req("PUT", `/api/admin/users/${id}/active`, { active: true });
  const back = await login("nuevo@grupo.es", "una-frase-larga-1");
  assert.equal((await back.req("GET", "/api/state")).json.rev, 2);
});

test("unidades: prerrequisitos, redirecciones seguras, contraseñas y límites", async () => {
  const meta = buildCatalogMeta(
    [{ id: "a" }, { id: "b", prerequisites: ["a"] }, { id: "c", prerequisites: ["b"] }],
    [{ id: "it", subjects: ["c"] }],
  );
  assert.deepEqual(closeOverPrerequisites(meta, ["c"]), ["a", "b", "c"]);
  assert.deepEqual(resolveEnrollment(meta, { itineraryId: "it" }).subjectIds, ["a", "b", "c"]);
  assert.throws(() => resolveEnrollment(meta, { subjectIds: ["zzz"] }), EnrollmentError);
  assert.throws(() => resolveEnrollment(meta, { subjectIds: [] }), EnrollmentError);

  assert.equal(safeNext("/hoy"), "/hoy");
  for (const evil of ["//evil.example", "https://evil.example", "/\\evil.example", null]) assert.equal(safeNext(evil), "/");

  const h = await hashPassword("clave-de-prueba");
  assert.ok(await verifyPassword("clave-de-prueba", h));
  assert.ok(!(await verifyPassword("otra", h)));
  assert.ok(!(await verifyPassword("x", "basura")));

  let t = 0;
  const rl = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
  assert.ok(rl.take("k") && rl.take("k"));
  assert.ok(!rl.take("k"));
  t = 1000;
  assert.ok(rl.take("k"));

  assert.deepEqual(parseCookies("a=1; academy_session=x%2By; mal"), { a: "1", academy_session: "x+y" });
  assert.deepEqual(progressSummary(null), { events: 0, concepts: 0, lastActivity: null, sessions: 0 });
});

test("login: límite de intentos por IP y email", async () => {
  const c = client();
  let last = 0;
  for (let i = 0; i < 11; i++) {
    last = (await c.req("POST", "/api/auth/login", { email: "form@otra.es", password: "mala" })).status;
  }
  assert.equal(last, 429);
});
