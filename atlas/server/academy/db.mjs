// Conexión a PostgreSQL y migraciones de FlipyERP Academy.
//
// Las migraciones son ficheros SQL numerados en ./migrations. Se aplican en
// orden, cada una en su transacción, y quedan anotadas en schema_migrations.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/** Crea un pool de `pg` a partir de DATABASE_URL. */
export async function createPool(databaseUrl) {
  const { default: pg } = await import("pg");
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

/** Aplica las migraciones pendientes. Devuelve los ids aplicados en esta llamada. */
export async function migrate(pool) {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const { rows } = await pool.query("SELECT id FROM schema_migrations");
  const done = new Set(rows.map((r) => r.id));
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const applied = [];
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    if (done.has(id)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
      await client.query("COMMIT");
      applied.push(id);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(`Migración ${id} fallida: ${e.message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}
