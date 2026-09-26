// Primitivas de seguridad de FlipyERP Academy: contraseñas, tokens, cookies
// y limitación de intentos. Solo node:crypto, sin dependencias.

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const MIN_PASSWORD_LENGTH = 10;
export const SESSION_COOKIE = "academy_session";
export const SESSION_DAYS = 30;

const scryptAsync = (password, salt) =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });

/** Hash de contraseña autodescriptivo: `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Comprueba una contraseña contra su hash en tiempo constante. */
export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64url");
  const key = await new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(saltB64, "base64url"), expected.length, { N: Number(N), r: Number(r), p: Number(p) }, (err, k) =>
      err ? reject(err) : resolve(k),
    );
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Token aleatorio para sesiones e invitaciones (se entrega al cliente). */
export const newToken = () => randomBytes(32).toString("base64url");
/** Lo que se guarda en base de datos: nunca el token en claro. */
export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");
export const newId = () => randomUUID();

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie malformada: se ignora */
    }
  }
  return out;
}

/** Cabecera Set-Cookie de la sesión. `token` null borra la cookie. */
export function sessionCookie(token, { secure }) {
  const attrs = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) attrs.push("Secure");
  if (token === null) return `${SESSION_COOKIE}=; ${attrs.join("; ")}; Max-Age=0`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${attrs.join("; ")}; Max-Age=${SESSION_DAYS * 86400}`;
}

/**
 * Limitador de intentos en memoria (ventana fija). Suficiente para un solo
 * proceso; si algún día hay varias réplicas, pasarlo a la base de datos.
 */
export function createRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  return {
    /** true si la clave aún puede intentarlo (y cuenta el intento). */
    take(key) {
      const t = now();
      const entry = hits.get(key);
      if (!entry || t - entry.start >= windowMs) {
        hits.set(key, { start: t, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

export const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();
export const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
