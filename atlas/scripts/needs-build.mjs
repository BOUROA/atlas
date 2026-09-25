// Sale con código 1 si hay que compilar (no existe dist/index.html o algún fuente es más reciente).
// Lo usan los lanzadores .cmd para compilar solo cuando hace falta.
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = join(root, "dist", "index.html");
if (!existsSync(built)) process.exit(1);
const builtAt = statSync(built).mtimeMs;

function newest(path) {
  if (!existsSync(path)) return 0;
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  return Math.max(0, ...readdirSync(path).map((f) => newest(join(path, f))));
}
const sources = ["src", "content", "index.html", "package.json", "vite.config.ts", "public"].map((p) => join(root, p));
process.exit(sources.some((p) => newest(p) > builtAt) ? 1 : 0);
