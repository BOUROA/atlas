// Punto de entrada del modo academia (multiusuario). Se activa cuando existe
// DATABASE_URL; sin ella, Atlas funciona como siempre (un usuario, fichero local).
//
// Variables de entorno:
//   DATABASE_URL              postgres://usuario:clave@host:5432/academy
//   ACADEMY_PUBLIC_URL        https://academy.flipyerp.com (para los enlaces de invitación)
//   ACADEMY_SECURE_COOKIES    1 en producción (cookies solo por HTTPS)

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAcademyApi } from "./api.mjs";
import { loadCatalogMeta } from "./catalog.mjs";
import { createPool, migrate } from "./db.mjs";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_CONTENT_DIR = join(serverDir, "..", "content");
export const DEFAULT_PUBLIC_DIR = join(serverDir, "public");

export const academyEnabled = () => Boolean(process.env.DATABASE_URL);

export async function createAcademyFromEnv(env = process.env) {
  const pool = await createPool(env.DATABASE_URL);
  const applied = await migrate(pool);
  if (applied.length) console.log(`[academy] migraciones aplicadas: ${applied.join(", ")}`);
  const meta = loadCatalogMeta(env.ACADEMY_CONTENT_DIR ?? DEFAULT_CONTENT_DIR);
  const handler = createAcademyApi({
    pool,
    meta,
    publicDir: DEFAULT_PUBLIC_DIR,
    secureCookies: env.ACADEMY_SECURE_COOKIES === "1",
    publicUrl: env.ACADEMY_PUBLIC_URL || null,
  });
  return { pool, meta, handler };
}
