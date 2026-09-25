// Manejador HTTP compartido de persistencia local, usado por el plugin de Vite
// (desarrollo, server/vite-plugin.mjs) y por el servidor de producción
// (server/serve.mjs).
//
// GET  /api/state  -> { rev, state }               (state === null si no hay datos aún)
// PUT  /api/state  -> { baseRev, state } en el cuerpo -> { rev } | 409 { rev, state } | 400 { error }
// GET  /api/health -> { ok: true }
// cualquier otra ruta -> next()

import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB
const RECENT_BACKUPS_LIMIT = 10;

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(payload);
}

function isValidState(state) {
  return (
    !!state &&
    typeof state === "object" &&
    state.version === 2 &&
    Array.isArray(state.events)
  );
}

function dayStamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function createApi({ dataDir }) {
  mkdirSync(dataDir, { recursive: true });
  const stateFile = join(dataDir, "state.json");
  const backupsDir = join(dataDir, "backups");
  const recentDir = join(backupsDir, "recent");

  function loadRecord() {
    if (!existsSync(stateFile)) return { rev: 0, savedAt: null, state: null };
    try {
      const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
      return { rev: parsed.rev ?? 0, savedAt: parsed.savedAt ?? null, state: parsed.state ?? null };
    } catch {
      return { rev: 0, savedAt: null, state: null };
    }
  }

  function writeAtomic(filePath, contents) {
    const tmpPath = `${filePath}.tmp`;
    writeFileSync(tmpPath, contents);
    renameSync(tmpPath, filePath);
  }

  function pruneRecentBackups() {
    const files = readdirSync(recentDir)
      .filter((f) => f.startsWith("state-") && f.endsWith(".json"))
      .map((f) => ({ name: f, rev: Number(f.slice("state-".length, -".json".length)) }))
      .filter((f) => Number.isFinite(f.rev))
      .sort((a, b) => b.rev - a.rev);
    for (const extra of files.slice(RECENT_BACKUPS_LIMIT)) {
      try { unlinkSync(join(recentDir, extra.name)); } catch { /* best effort */ }
    }
  }

  function saveRecord(record) {
    const contents = JSON.stringify(record);
    mkdirSync(dataDir, { recursive: true });
    writeAtomic(stateFile, contents);

    mkdirSync(backupsDir, { recursive: true });
    mkdirSync(recentDir, { recursive: true });

    const now = new Date();
    writeFileSync(join(backupsDir, `state-${dayStamp(now)}.json`), contents);
    writeFileSync(join(recentDir, `state-${record.rev}.json`), contents);
    pruneRecentBackups();
  }

  return async function handler(req, res, next) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/api/health" && req.method === "GET") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/state" && req.method === "GET") {
      const { rev, state } = loadRecord();
      sendJson(res, 200, { rev, state });
      return;
    }

    if (pathname === "/api/state" && req.method === "PUT") {
      let body;
      try {
        body = await readJsonBody(req, MAX_BODY_BYTES);
      } catch {
        sendJson(res, 400, { error: "invalid body" });
        return;
      }
      if (!body || typeof body !== "object" || !isValidState(body.state) || typeof body.baseRev !== "number") {
        sendJson(res, 400, { error: "invalid state" });
        return;
      }

      const current = loadRecord();
      if (body.baseRev !== current.rev) {
        sendJson(res, 409, { rev: current.rev, state: current.state });
        return;
      }

      const nextRev = current.rev + 1;
      const record = { rev: nextRev, savedAt: new Date().toISOString(), state: body.state };
      saveRecord(record);
      sendJson(res, 200, { rev: nextRev });
      return;
    }

    next();
  };
}
