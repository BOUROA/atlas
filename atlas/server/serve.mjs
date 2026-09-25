#!/usr/bin/env node
// Servidor de producción: sirve dist/ (build de Vite) y monta la API de
// persistencia (server/api.mjs) sobre userdata/.
//
// Uso: node server/serve.mjs [--port 5173] [--mobile]
//   --port <n>   Puerto de escucha (defecto 5173).
//   --mobile     Además escucha en la primera IPv4 privada disponible
//                (192.168.x.x / 10.x.x.x / 172.16-31.x.x) en el puerto 5175.
//                ATLAS_MOBILE_HOST fuerza esa dirección.

import http from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { createApi } from "./api.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = join(rootDir, "dist");
// ATLAS_DATA_DIR permite usar otra carpeta de datos (pruebas, demostraciones).
const dataDir = process.env.ATLAS_DATA_DIR ? resolve(process.env.ATLAS_DATA_DIR) : join(rootDir, "userdata");
const MOBILE_PORT = 5175;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function parseArgs(argv) {
  const args = { port: 5173, mobile: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") {
      args.port = Number(argv[++i]);
    } else if (arg.startsWith("--port=")) {
      args.port = Number(arg.slice("--port=".length));
    } else if (arg === "--mobile") {
      args.mobile = true;
    }
  }
  return args;
}

function isPrivateIPv4(address) {
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(address)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address)) return true;
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(address);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function findPrivateIPv4() {
  const forced = process.env.ATLAS_MOBILE_HOST;
  if (forced) return forced;
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal && isPrivateIPv4(iface.address)) {
        return iface.address;
      }
    }
  }
  return null;
}

function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("..")) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  const hasExtension = extname(pathname) !== "";
  let filePath = hasExtension ? join(distDir, pathname) : join(distDir, "index.html");

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    if (hasExtension) {
      // Ruta con extensión sin fichero real en disco: 404 real, sin caer a
      // index.html (evita ocultar assets rotos o referencias a chunks
      // obsoletos tras un rebuild con un 200 text/html engañoso).
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    // Fallback SPA: ruta sin extensión y sin fichero real en disco sirve
    // index.html (rutas hash del cliente, recargas en `/asignatura/x`, etc.).
    filePath = join(distDir, "index.html");
  }

  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const type = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("content-type", type);
  res.end(readFileSync(filePath));
}

function createRequestHandler() {
  const api = createApi({ dataDir });
  return (req, res) => {
    api(req, res, () => serveStatic(req, res));
  };
}

function main() {
  if (!existsSync(distDir)) {
    console.error("Ejecuta npm run build");
    process.exit(1);
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const handler = createRequestHandler();

  const server = http.createServer(handler);
  server.listen(args.port, () => {
    console.log(`Atlas listo en http://localhost:${args.port}/`);
  });

  if (args.mobile) {
    const host = findPrivateIPv4();
    if (host) {
      const mobileServer = http.createServer(handler);
      mobileServer.listen(MOBILE_PORT, host, () => {
        console.log(`Atlas (móvil) en http://${host}:${MOBILE_PORT}/`);
      });
    } else {
      console.warn("No se encontró ninguna IPv4 privada; usa ATLAS_MOBILE_HOST para forzarla.");
    }
  }
}

main();
