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
  creationService,
] = await Promise.all([
  source("src/data/home.ts"),
  source("src/app/page.tsx"),
  source("src/lib/admin/content-create-service.ts"),
]);

assert(
  homeCollections.includes("pickPreferredGames") &&
    homeCollections.includes("rankGames") &&
    homeCollections.includes("reviewScore") &&
    !homeCollections.includes("getRequiredGame") &&
    !homeCollections.includes("No se encontró el juego editorial requerido"),
  "La Home no debe depender de slugs obligatorios: debe poder rellenar colecciones con el catálogo público disponible."
);

assert(
  homeCollections.includes(
    "lowSpecSlugs,\n      7,\n      false"
  ),
  "La sección de bajos recursos no debe rellenarse con juegos arbitrarios cuando faltan candidatos conocidos."
);

assert(
  homePage.includes(
    "collections.heroGames.length > 0"
  ) &&
    homePage.includes(
      "collections.popularGames.length > 0"
    ) &&
    homePage.includes(
      "collections.recommendedGames.length > 0"
    ),
  "La portada debe montar las secciones de juegos sólo cuando sus colecciones contienen elementos."
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
    "Home editorial: OK (colecciones tolerantes a ocultado, catálogo vacío seguro y altas nuevas fechadas)."
  );
}
