// Plugin de Vite que monta el manejador de persistencia (server/api.mjs) en el
// servidor de desarrollo, para que `npm run dev` también persista en fichero.

import { resolve } from "node:path";
import { createApi } from "./api.mjs";

export function atlasApi() {
  return {
    name: "atlas-api",
    configureServer(server) {
      // ATLAS_DATA_DIR permite usar otra carpeta de datos (pruebas, demostraciones).
      const dataDir = process.env.ATLAS_DATA_DIR ? resolve(process.env.ATLAS_DATA_DIR) : resolve(process.cwd(), "userdata");
      server.middlewares.use(createApi({ dataDir }));
    },
  };
}
