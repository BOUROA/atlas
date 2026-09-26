// API multiusuario de FlipyERP Academy.
//
// Mantiene el contrato de persistencia del Atlas original (GET/PUT /api/state
// con `rev` y 409 en conflicto), pero por alumno autenticado. Todo lo demás
// (la SPA y sus assets) solo se sirve con sesión válida: sin sesión, las
// páginas redirigen a /login y la API responde 401.
//
// Públicas:  GET /api/health · GET /login · POST /api/auth/login
//            GET /api/auth/invite?token= · POST /api/auth/accept-invite
// Con sesión: POST /api/auth/logout · POST /api/auth/password · GET /api/me
//            GET/PUT /api/state
// Admin y formador: GET /admin · GET /api/admin/overview
//            POST /api/admin/invitations · PUT /api/admin/users/:id/enrollment
//            PUT /api/admin/users/:id/active
// Solo admin: POST /api/admin/organizations

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EnrollmentError, resolveEnrollment } from "./catalog.mjs";
import {
  MIN_PASSWORD_LENGTH, SESSION_COOKIE, SESSION_DAYS, createRateLimiter, hashPassword, hashToken, isEmail,
  newId, newToken, normalizeEmail, parseCookies, sessionCookie, verifyPassword,
} from "./security.mjs";

const MAX_STATE_BYTES = 25 * 1024 * 1024;
const MAX_FORM_BYTES = 64 * 1024;
const INVITE_DAYS = 14;
const BACKUPS_KEPT = 20;
const DAY_MS = 86_400_000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new HttpError(413, "Cuerpo demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, "JSON no válido"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function sendHtml(res, html) {
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "same-origin");
  res.end(html);
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("location", location);
  res.setHeader("cache-control", "no-store");
  res.end();
}

/**
 * Solo rutas internas relativas: evita redirecciones abiertas con ?next=.
 * @param {unknown} next
 * @returns {string}
 */
export function safeNext(next) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket?.remoteAddress || "?";

const isValidState = (s) => !!s && typeof s === "object" && s.version === 2 && Array.isArray(s.events);

/** Resumen de progreso a partir del estado de Atlas (para el panel del formador). */
export function progressSummary(state) {
  if (!isValidState(state)) return { events: 0, concepts: 0, lastActivity: null, sessions: 0 };
  const concepts = new Set();
  let last = null;
  for (const ev of state.events) {
    if (ev?.conceptId) concepts.add(ev.conceptId);
    if (typeof ev?.at === "string" && (!last || ev.at > last)) last = ev.at;
  }
  return {
    events: state.events.length,
    concepts: concepts.size,
    lastActivity: last,
    sessions: Array.isArray(state.sessions) ? state.sessions.length : 0,
  };
}

export function createAcademyApi({ pool, meta, publicDir, secureCookies = false, publicUrl = null }) {
  const loginLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60_000 });
  const inviteLimiter = createRateLimiter({ max: 30, windowMs: 15 * 60_000 });
  const page = (name) => readFileSync(join(publicDir, name), "utf8");
  let dummyHash = null; // para igualar tiempos cuando el email no existe

  const q = (sql, params) => pool.query(sql, params);

  const baseUrl = (req) => {
    if (publicUrl) return publicUrl.replace(/\/$/, "");
    const proto = String(req.headers["x-forwarded-proto"] ?? (secureCookies ? "https" : "http")).split(",")[0];
    return `${proto}://${req.headers["x-forwarded-host"] ?? req.headers.host}`;
  };

  async function createSession(res, userId) {
    const token = newToken();
    const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await q("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [hashToken(token), userId, expires]);
    await q("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
    res.setHeader("set-cookie", sessionCookie(token, { secure: secureCookies }));
  }

  async function currentUser(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const { rows } = await q(
      `SELECT u.id, u.email, u.name, u.role, u.organization_id, o.name AS organization_name, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN organizations o ON o.id = u.organization_id
        WHERE s.token_hash = $1 AND u.active = true`,
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
    return { ...row, tokenHash: hashToken(token) };
  }

  async function enrollmentOf(userId) {
    const { rows } = await q("SELECT itinerary_id, subject_ids FROM enrollments WHERE user_id = $1", [userId]);
    const known = (ids) => ids.filter((id) => meta.subjectById.has(id));
    if (!rows[0]) return { itineraryId: null, subjectIds: meta.subjects.map((s) => s.id) };
    return { itineraryId: rows[0].itinerary_id, subjectIds: known(rows[0].subject_ids ?? []) };
  }

  /** Comprueba que `actor` puede gestionar a `target` (admin: todos; formador: alumnos de su organización). */
  function canManage(actor, target) {
    if (actor.role === "admin") return true;
    return actor.role === "formador" && target.organization_id === actor.organization_id && target.role === "alumno";
  }

  // ───────── Rutas públicas ─────────

  async function login(req, res) {
    const body = await readJsonBody(req, MAX_FORM_BYTES);
    const email = normalizeEmail(body.email);
    if (!loginLimiter.take(`${clientIp(req)}|${email}`)) {
      throw new HttpError(429, "Demasiados intentos. Espera unos minutos.");
    }
    const { rows } = await q("SELECT id, password_hash FROM users WHERE email = $1 AND active = true", [email]);
    const user = rows[0];
    dummyHash ??= await hashPassword("contraseña-que-nunca-coincide");
    const ok = await verifyPassword(String(body.password ?? ""), user?.password_hash ?? dummyHash);
    if (!user || !ok) throw new HttpError(401, "Email o contraseña incorrectos");
    loginLimiter.reset(`${clientIp(req)}|${email}`);
    await q("DELETE FROM sessions WHERE expires_at < now()");
    await createSession(res, user.id);
    sendJson(res, 200, { ok: true });
  }

  async function findInvitation(token) {
    const { rows } = await q(
      `SELECT i.*, o.name AS organization_name FROM invitations i
         JOIN organizations o ON o.id = i.organization_id
        WHERE i.token_hash = $1 AND i.accepted_at IS NULL`,
      [hashToken(token)],
    );
    const inv = rows[0];
    if (!inv || new Date(inv.expires_at).getTime() <= Date.now()) return null;
    return inv;
  }

  async function inviteInfo(req, res, url) {
    if (!inviteLimiter.take(clientIp(req))) throw new HttpError(429, "Demasiados intentos");
    const inv = await findInvitation(url.searchParams.get("token") ?? "");
    if (!inv) throw new HttpError(404, "La invitación no existe, ya se usó o ha caducado");
    sendJson(res, 200, { email: inv.email, name: inv.name ?? "", organization: inv.organization_name });
  }

  async function acceptInvite(req, res) {
    if (!inviteLimiter.take(clientIp(req))) throw new HttpError(429, "Demasiados intentos");
    const body = await readJsonBody(req, MAX_FORM_BYTES);
    const inv = await findInvitation(String(body.token ?? ""));
    if (!inv) throw new HttpError(404, "La invitación no existe, ya se usó o ha caducado");
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    if (!name) throw new HttpError(400, "Indica tu nombre");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }
    const existing = await q("SELECT id FROM users WHERE email = $1", [inv.email]);
    if (existing.rows[0]) throw new HttpError(409, "Ya existe una cuenta con ese email");

    const userId = newId();
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO users (id, organization_id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)",
        [userId, inv.organization_id, inv.email, name, inv.role, passwordHash],
      );
      await client.query(
        "INSERT INTO enrollments (user_id, itinerary_id, subject_ids, updated_by) VALUES ($1, $2, $3, $4)",
        [userId, inv.itinerary_id, JSON.stringify(inv.subject_ids), inv.created_by],
      );
      await client.query("UPDATE invitations SET accepted_at = now() WHERE token_hash = $1", [inv.token_hash]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    await createSession(res, userId);
    sendJson(res, 200, { ok: true });
  }

  // ───────── Rutas con sesión ─────────

  async function logout(req, res, user) {
    await q("DELETE FROM sessions WHERE token_hash = $1", [user.tokenHash]);
    sendJson(res, 200, { ok: true }, { "set-cookie": sessionCookie(null, { secure: secureCookies }) });
  }

  async function changePassword(req, res, user) {
    const body = await readJsonBody(req, MAX_FORM_BYTES);
    const { rows } = await q("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    if (!(await verifyPassword(String(body.current ?? ""), rows[0]?.password_hash))) {
      throw new HttpError(403, "La contraseña actual no es correcta");
    }
    const next = String(body.next ?? "");
    if (next.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
    await q("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(next), user.id]);
    // Cierra las demás sesiones del usuario.
    await q("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [user.id, user.tokenHash]);
    sendJson(res, 200, { ok: true });
  }

  async function me(req, res, user) {
    sendJson(res, 200, {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      organization: { id: user.organization_id, name: user.organization_name },
      enrollment: await enrollmentOf(user.id),
    });
  }

  async function getState(req, res, user) {
    const { rows } = await q("SELECT rev, state FROM user_states WHERE user_id = $1", [user.id]);
    sendJson(res, 200, rows[0] ? { rev: rows[0].rev, state: rows[0].state } : { rev: 0, state: null });
  }

  async function putState(req, res, user) {
    const body = await readJsonBody(req, MAX_STATE_BYTES);
    if (!isValidState(body.state) || typeof body.baseRev !== "number") throw new HttpError(400, "invalid state");
    const json = JSON.stringify(body.state);
    let newRev = null;
    if (body.baseRev === 0) {
      try {
        await q("INSERT INTO user_states (user_id, rev, state) VALUES ($1, 1, $2)", [user.id, json]);
        newRev = 1;
      } catch {
        newRev = null; // ya existía: otro dispositivo guardó antes → 409
      }
    } else {
      const upd = await q(
        "UPDATE user_states SET rev = rev + 1, state = $1, saved_at = now() WHERE user_id = $2 AND rev = $3 RETURNING rev",
        [json, user.id, body.baseRev],
      );
      newRev = upd.rows[0]?.rev ?? null;
    }
    if (newRev === null) {
      const cur = await q("SELECT rev, state FROM user_states WHERE user_id = $1", [user.id]);
      sendJson(res, 409, cur.rows[0] ? { rev: cur.rows[0].rev, state: cur.rows[0].state } : { rev: 0, state: null });
      return;
    }
    await q("INSERT INTO user_state_backups (user_id, rev, state) VALUES ($1, $2, $3)", [user.id, newRev, json]);
    await q("DELETE FROM user_state_backups WHERE user_id = $1 AND rev <= $2", [user.id, newRev - BACKUPS_KEPT]);
    sendJson(res, 200, { rev: newRev });
  }

  // ───────── Administración ─────────

  async function overview(req, res, actor) {
    const isAdmin = actor.role === "admin";
    const orgs = isAdmin
      ? (await q("SELECT id, name FROM organizations ORDER BY name")).rows
      : (await q("SELECT id, name FROM organizations WHERE id = $1", [actor.organization_id])).rows;
    const users = (
      await q(
        `SELECT u.id, u.email, u.name, u.role, u.active, u.organization_id, u.created_at, u.last_login_at,
                e.itinerary_id, e.subject_ids, s.state, s.saved_at
           FROM users u
           LEFT JOIN enrollments e ON e.user_id = u.id
           LEFT JOIN user_states s ON s.user_id = u.id
          ORDER BY u.name`,
      )
    ).rows
      .filter((u) => isAdmin || u.organization_id === actor.organization_id)
      .map(({ state, ...u }) => ({ ...u, progress: progressSummary(state) }));
    const invitations = (
      await q(
        `SELECT email, name, role, organization_id, itinerary_id, subject_ids, created_at, expires_at
           FROM invitations WHERE accepted_at IS NULL ORDER BY created_at DESC`,
      )
    ).rows.filter((i) => (isAdmin || i.organization_id === actor.organization_id) && new Date(i.expires_at).getTime() > Date.now());
    sendJson(res, 200, {
      actor: { id: actor.id, role: actor.role, organizationId: actor.organization_id },
      organizations: orgs,
      users,
      invitations,
      catalog: {
        subjects: meta.subjects.map(({ id, name, level, track, audience, prerequisites, description }) => ({
          id, name, level, track, audience, prerequisites: prerequisites ?? [], description,
        })),
        itineraries: meta.itineraries,
      },
    });
  }

  async function createOrganization(req, res, actor) {
    if (actor.role !== "admin") throw new HttpError(403, "Solo un administrador puede crear organizaciones");
    const body = await readJsonBody(req, MAX_FORM_BYTES);
    const name = String(body.name ?? "").trim();
    if (!name) throw new HttpError(400, "Falta el nombre");
    const exists = await q("SELECT id FROM organizations WHERE name = $1", [name]);
    if (exists.rows[0]) throw new HttpError(409, "Ya existe una organización con ese nombre");
    const id = newId();
    await q("INSERT INTO organizations (id, name) VALUES ($1, $2)", [id, name]);
    sendJson(res, 201, { id, name });
  }

  async function createInvitation(req, res, actor) {
    const body = await readJsonBody(req, MAX_FORM_BYTES);
    const email = normalizeEmail(body.email);
    if (!isEmail(email)) throw new HttpError(400, "Email no válido");
    const role = body.role ?? "alumno";
    if (!["admin", "formador", "alumno"].includes(role)) throw new HttpError(400, "Rol no válido");
    const organizationId = actor.role === "admin" ? String(body.organizationId ?? actor.organization_id) : actor.organization_id;
    if (actor.role !== "admin" && role !== "alumno") throw new HttpError(403, "Un formador solo puede invitar alumnos");
    const org = await q("SELECT id FROM organizations WHERE id = $1", [organizationId]);
    if (!org.rows[0]) throw new HttpError(400, "Organización desconocida");
    const taken = await q("SELECT id FROM users WHERE email = $1", [email]);
    if (taken.rows[0]) throw new HttpError(409, "Ya existe una cuenta con ese email");
    const enrollment = resolveEnrollment(meta, { itineraryId: body.itineraryId ?? null, subjectIds: body.subjectIds ?? [] });

    const token = newToken();
    const expires = new Date(Date.now() + INVITE_DAYS * DAY_MS);
    await q(
      `INSERT INTO invitations (token_hash, organization_id, email, name, role, itinerary_id, subject_ids, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [hashToken(token), organizationId, email, String(body.name ?? "").trim() || null, role,
        enrollment.itineraryId, JSON.stringify(enrollment.subjectIds), actor.id, expires],
    );
    sendJson(res, 201, {
      url: `${baseUrl(req)}/login?invite=${encodeURIComponent(token)}`,
      expiresAt: expires.toISOString(),
      enrollment,
    });
  }

  async function targetUser(actor, id) {
    const { rows } = await q("SELECT id, role, organization_id FROM users WHERE id = $1", [id]);
    const target = rows[0];
    if (!target) throw new HttpError(404, "Usuario no encontrado");
    if (!canManage(actor, target)) throw new HttpError(403, "No puedes gestionar a este usuario");
    return target;
  }

  async function setEnrollment(req, res, actor, userId) {
    const target = await targetUser(actor, userId);
    const body = await readJsonBody(req, MAX_FORM_BYTES);
    const enrollment = resolveEnrollment(meta, { itineraryId: body.itineraryId ?? null, subjectIds: body.subjectIds ?? [] });
    const upd = await q(
      "UPDATE enrollments SET itinerary_id = $1, subject_ids = $2, updated_at = now(), updated_by = $3 WHERE user_id = $4",
      [enrollment.itineraryId, JSON.stringify(enrollment.subjectIds), actor.id, target.id],
    );
    if (upd.rowCount === 0) {
      await q("INSERT INTO enrollments (user_id, itinerary_id, subject_ids, updated_by) VALUES ($1, $2, $3, $4)", [
        target.id, enrollment.itineraryId, JSON.stringify(enrollment.subjectIds), actor.id,
      ]);
    }
    sendJson(res, 200, { enrollment });
  }

  async function setActive(req, res, actor, userId) {
    const target = await targetUser(actor, userId);
    if (target.id === actor.id) throw new HttpError(400, "No puedes desactivarte a ti mismo");
    const body = await readJsonBody(req, MAX_FORM_BYTES);
    const active = body.active === true;
    await q("UPDATE users SET active = $1 WHERE id = $2", [active, target.id]);
    if (!active) await q("DELETE FROM sessions WHERE user_id = $1", [target.id]);
    sendJson(res, 200, { active });
  }

  // ───────── Enrutado ─────────

  /** Las peticiones que cambian algo han de ser JSON y del mismo origen (CSRF). */
  function checkMutation(req) {
    const type = String(req.headers["content-type"] ?? "");
    if (!type.includes("application/json")) throw new HttpError(415, "Se espera application/json");
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers["x-forwarded-host"] ?? req.headers.host;
      let originHost = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        /* origen malformado */
      }
      if (originHost !== host) throw new HttpError(403, "Origen no permitido");
    }
  }

  async function route(req, res, next) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";
    const isApi = path.startsWith("/api/");
    if (isApi && method !== "GET" && method !== "HEAD") checkMutation(req);

    if (path === "/api/health" && method === "GET") return sendJson(res, 200, { ok: true });
    if (path === "/api/auth/login" && method === "POST") return login(req, res);
    if (path === "/api/auth/invite" && method === "GET") return inviteInfo(req, res, url);
    if (path === "/api/auth/accept-invite" && method === "POST") return acceptInvite(req, res);

    const user = await currentUser(req);

    if (path === "/login" || path === "/login.html") {
      if (user && !url.searchParams.get("invite")) return redirect(res, safeNext(url.searchParams.get("next")));
      return sendHtml(res, page("login.html"));
    }

    if (!user) {
      if (isApi) throw new HttpError(401, "Sesión no iniciada");
      if (method === "GET" && !/\.[a-z0-9]+$/i.test(path)) {
        return redirect(res, `/login?next=${encodeURIComponent(path + url.search)}`);
      }
      throw new HttpError(401, "Sesión no iniciada");
    }

    if (path === "/api/auth/logout" && method === "POST") return logout(req, res, user);
    if (path === "/api/auth/password" && method === "POST") return changePassword(req, res, user);
    if (path === "/api/me" && method === "GET") return me(req, res, user);
    if (path === "/api/state" && method === "GET") return getState(req, res, user);
    if (path === "/api/state" && method === "PUT") return putState(req, res, user);

    const staff = user.role === "admin" || user.role === "formador";
    if (path === "/admin" || path === "/admin.html") {
      if (!staff) return redirect(res, "/");
      return sendHtml(res, page("admin.html"));
    }
    if (path.startsWith("/api/admin/")) {
      if (!staff) throw new HttpError(403, "Solo formadores y administradores");
      if (path === "/api/admin/overview" && method === "GET") return overview(req, res, user);
      if (path === "/api/admin/organizations" && method === "POST") return createOrganization(req, res, user);
      if (path === "/api/admin/invitations" && method === "POST") return createInvitation(req, res, user);
      const m = /^\/api\/admin\/users\/([^/]+)\/(enrollment|active)$/.exec(path);
      if (m && method === "PUT") {
        return m[2] === "enrollment" ? setEnrollment(req, res, user, m[1]) : setActive(req, res, user, m[1]);
      }
      throw new HttpError(404, "No encontrado");
    }
    if (isApi) throw new HttpError(404, "No encontrado");
    return next();
  }

  return async function handler(req, res, next) {
    try {
      await route(req, res, next);
    } catch (e) {
      if (res.headersSent) return;
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
      if (e instanceof EnrollmentError) return sendJson(res, 400, { error: e.message });
      console.error("[academy]", e);
      sendJson(res, 500, { error: "Error interno" });
    }
  };
}
