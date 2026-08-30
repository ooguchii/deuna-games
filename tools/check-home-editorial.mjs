import {
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(
    path.join(root, relativePath),
    "utf8"
  );
}

const [
  homeCollections,
  homePage,
  sourceConfig,
  publicConfig,
  creationService,
] = await Promise.all([
  source("src/data/home.ts"),
  source("src/app/page.tsx"),
  source("src/data/home-config.ts"),
  source("src/lib/home/public-home-config.ts"),
  source("src/lib/admin/content-create-service.ts"),
]);

assert(
  homeCollections.includes("pickPreferredGames") &&
    homeCollections.includes("rankGames") &&
    homeCollections.includes("reviewScore") &&
    homeCollections.includes("config.heroSlugs") &&
    homeCollections.includes("config.popularSlugs") &&
    homeCollections.includes("config.lowSpecSlugs") &&
    homeCollections.includes("config.recommendedSlugs") &&
    !homeCollections.includes("getRequiredGame") &&
    !homeCollections.includes("No se encontró el juego editorial requerido"),
  "La Home debe usar configuración inyectada y no depender de slugs obligatorios."
);

assert(
  homeCollections.includes(
    "config.lowSpecSlugs,\n      7,\n      false"
  ),
  "La sección de bajos recursos no debe rellenarse con juegos arbitrarios cuando faltan candidatos configurados."
);

assert(
  sourceConfig.includes("sourceHomeConfig") &&
    sourceConfig.includes("heroSlugs") &&
    sourceConfig.includes("popularSlugs") &&
    sourceConfig.includes("lowSpecSlugs") &&
    sourceConfig.includes("recommendedSlugs"),
  "La portada debe conservar una configuración fuente explícita como fallback."
);

assert(
  publicConfig.includes("published_payload") &&
    publicConfig.includes("item_type = 'home_config'") &&
    publicConfig.includes("item_key = 'home'") &&
    publicConfig.includes("public_visible = true") &&
    !publicConfig.includes("draft_payload"),
  "La configuración pública de portada debe leer sólo el snapshot visible y nunca el borrador."
);

assert(
  homePage.includes("getPublicHomeConfig") &&
    homePage.includes(
      "buildHomeGameCollections(games, homeConfig)"
    ) &&
    homePage.includes(
      "collections.heroGames.length > 0"
    ) &&
    homePage.includes(
      "collections.popularGames.length > 0"
    ) &&
    homePage.includes(
      "collections.recommendedGames.length > 0"
    ),
  "La portada pública debe consumir la configuración publicada y tolerar colecciones vacías."
);

assert(
  creationService.includes(
    "addedAt: new Date().toISOString().slice(0, 10)"
  ),
  "Los juegos creados desde el panel deben recibir una fecha UTC de incorporación para poder aparecer entre los recientes."
);

if (failures.length > 0) {
  console.error("\nHome editorial: BLOQUEADA\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exitCode = 1;
} else {
  console.log(
    "Home editorial: OK (curaduría publicada, fallback fuente, colecciones tolerantes y altas nuevas fechadas)."
  );
}
