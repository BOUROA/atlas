import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { createApi } from "../server/api.mjs";

async function withServer(fn: (url: string, dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "atlas-"));
  const handler = createApi({ dataDir: dir });
  const server = http.createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as { port: number };
  try { await fn(`http://127.0.0.1:${port}`, dir); } finally { server.close(); }
}
const state = (n: number) => ({ version: 2, createdAt: "2026-09-24T10:00:00.000Z", events: new Array(n).fill(0).map((_, i) => ({ id: `e${i}` })) });

test("GET sin datos devuelve rev 0 y state null", () => withServer(async (url) => {
  const r = await fetch(`${url}/api/state`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { rev: 0, state: null });
}));

test("PUT guarda, incrementa rev y crea copias", () => withServer(async (url, dir) => {
  const r = await fetch(`${url}/api/state`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseRev: 0, state: state(1) }) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { rev: 1 });
  const saved = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert.equal(saved.rev, 1);
  assert.equal(saved.state.events.length, 1);
  assert.ok(existsSync(join(dir, "backups")));
  assert.ok(readdirSync(join(dir, "backups")).some((f) => f.startsWith("state-")));
  const g = await (await fetch(`${url}/api/state`)).json();
  assert.equal(g.rev, 1);
}));

test("PUT con baseRev antiguo devuelve 409 con el estado actual", () => withServer(async (url) => {
  const put = (baseRev: number, n: number) => fetch(`${url}/api/state`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseRev, state: state(n) }) });
  await put(0, 1);
  const r = await put(0, 5);
  assert.equal(r.status, 409);
  const body = await r.json();
  assert.equal(body.rev, 1);
  assert.equal(body.state.events.length, 1);
}));

test("PUT con cuerpo no válido devuelve 400", () => withServer(async (url) => {
  const r = await fetch(`${url}/api/state`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseRev: 0, state: { version: 1 } }) });
  assert.equal(r.status, 400);
}));

test("rutas ajenas pasan a next()", () => withServer(async (url) => {
  const r = await fetch(`${url}/otra`);
  assert.equal(r.status, 404);
}));
