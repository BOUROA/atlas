// Plugin de Vite que monta el manejador de persistencia en el servidor de
// desarrollo, para que `npm run dev` también persista.
//
// - Sin DATABASE_URL: el Atlas original (un usuario, fichero en userdata/).
// - Con DATABASE_URL: FlipyERP Academy (multiusuario, login, PostgreSQL).

import { resolve } from "node:path";
import { createApi } from "./api.mjs";
import { academyEnabled, createAcademyFromEnv } from "./academy/index.mjs";

export function atlasApi() {
  return {
    name: "atlas-api",
    async configureServer(server) {
      if (academyEnabled()) {
        const { handler } = await createAcademyFromEnv();
        server.middlewares.use((req, res, next) => void handler(req, res, next));
        return;
      }
      // ATLAS_DATA_DIR permite usar otra carpeta de datos (pruebas, demostraciones).
      const dataDir = process.env.ATLAS_DATA_DIR ? resolve(process.env.ATLAS_DATA_DIR) : resolve(process.cwd(), "userdata");
      server.middlewares.use(createApi({ dataDir }));
    },
  };
}
