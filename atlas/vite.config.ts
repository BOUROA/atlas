import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { atlasApi } from "./server/vite-plugin.mjs";

export default defineConfig({
  plugins: [react(), tailwindcss(), atlasApi()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "dist", chunkSizeWarningLimit: 4000 },
});
