#!/usr/bin/env node
// Utilidades de línea de comandos de FlipyERP Academy (requiere DATABASE_URL).
//
//   node server/academy/cli.mjs migrate
//   node server/academy/cli.mjs bootstrap --org "Grupo Troviscal" --email tu@correo --name "Tu nombre"
//        Crea la organización (si no existe) y el primer administrador.
//   node server/academy/cli.mjs reset-password --email tu@correo
//
// La contraseña se lee de ACADEMY_PASSWORD o se pide por consola; nunca va
// como argumento (quedaría en el historial de la shell).

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createPool, migrate } from "./db.mjs";
import { MIN_PASSWORD_LENGTH, hashPassword, isEmail, newId, normalizeEmail } from "./security.mjs";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

async function readPassword() {
  if (process.env.ACADEMY_PASSWORD) return process.env.ACADEMY_PASSWORD;
  const rl = createInterface({ input: stdin, output: stdout });
  const pw = await rl.question(`Contraseña (mín. ${MIN_PASSWORD_LENGTH} caracteres): `);
  rl.close();
  return pw;
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
  const pool = await createPool(process.env.DATABASE_URL);
  try {
    const applied = await migrate(pool);
    if (cmd === "migrate") {
      console.log(applied.length ? `Aplicadas: ${applied.join(", ")}` : "Sin migraciones pendientes");
      return;
    }
    if (cmd === "bootstrap") {
      const email = normalizeEmail(a.email);
      if (!a.org || !isEmail(email) || !a.name) throw new Error('Uso: bootstrap --org "Nombre" --email x@y --name "Nombre"');
      const pw = await readPassword();
      if (pw.length < MIN_PASSWORD_LENGTH) throw new Error("Contraseña demasiado corta");
      let org = (await pool.query("SELECT id FROM organizations WHERE name = $1", [a.org])).rows[0];
      if (!org) {
        org = { id: newId() };
        await pool.query("INSERT INTO organizations (id, name) VALUES ($1, $2)", [org.id, a.org]);
      }
      const exists = (await pool.query("SELECT id FROM users WHERE email = $1", [email])).rows[0];
      if (exists) throw new Error("Ya existe un usuario con ese email; usa reset-password");
      await pool.query(
        "INSERT INTO users (id, organization_id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, 'admin', $5)",
        [newId(), org.id, email, a.name, await hashPassword(pw)],
      );
      console.log(`Administrador ${email} creado en «${a.org}».`);
      return;
    }
    if (cmd === "reset-password") {
      const email = normalizeEmail(a.email);
      const pw = await readPassword();
      if (pw.length < MIN_PASSWORD_LENGTH) throw new Error("Contraseña demasiado corta");
      const r = await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [await hashPassword(pw), email]);
      if (r.rowCount === 0) throw new Error("No existe ese usuario");
      await pool.query("DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)", [email]);
      console.log("Contraseña cambiada y sesiones cerradas.");
      return;
    }
    throw new Error("Comandos: migrate | bootstrap | reset-password");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
