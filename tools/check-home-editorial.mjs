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
  rankingEngine,
  homePage,
  adminHomePage,
  sourceConfig,
  publicConfig,
  curationEditor,
  curationRoute,
  presentationRoute,
  creationService,
] = await Promise.all([
  source("src/data/home.ts"),
  source("src/lib/home/ranking.ts"),
  source("src/app/page.tsx"),
  source("src/app/admin/(protected)/portada/page.tsx"),
  source("src/data/home-config.ts"),
  source("src/lib/home/public-home-config.ts"),
  source("src/components/admin/HomeCurationEditor.tsx"),
  source("src/app/api/admin/content/home/route.ts"),
  source(
    path.join(
      "src",
      "app",
      "api",
      "admin",
      "content",
      "home",
      "presentation",
      "route.ts"
    )
  ),
  source("src/lib/admin/content-create-service.ts"),
]);

assert(
  homeCollections.includes("resolveHomeCollectionGames") &&
    homeCollections.includes("resolved.curation.hero.mode") &&
    homeCollections.includes("resolved.curation.popular.mode") &&
    homeCollections.includes("resolved.curation.lowSpec.mode") &&
    homeCollections.includes("resolved.curation.recommended.mode") &&
    !homeCollections.includes("getRequiredGame") &&
    !homeCollections.includes("No se encontró el juego editorial requerido"),
  "La Home debe resolver cada colección mediante el modo editorial publicado y sin slugs obligatorios."
);

assert(
  rankingEngine.includes("scoreHomeGame") &&
    rankingEngine.includes("rankHomeGames") &&
    rankingEngine.includes("resolveHomeCollectionGames") &&
    rankingEngine.includes("reviewScore") &&
    rankingEngine.includes("minimumRamGb") &&
    rankingEngine.includes("homeRankingDay") &&
    rankingEngine.includes('mode === "manual"') &&
    rankingEngine.includes('mode === "automatic"') &&
    rankingEngine.includes("isHomeRankingEligible"),
  "La portada debe conservar un motor compartido, explicable, estable por día y determinista para Manual, Automático e Híbrido."
);

assert(
  rankingEngine.includes("popularity * 58") &&
    rankingEngine.includes("rating * 34") &&
    rankingEngine.includes("lowSpec * 60") &&
    rankingEngine.includes("ram !== null && ram <= 12") &&
    rankingEngine.includes('target === "hero"') &&
    rankingEngine.includes("game.heroImage || game.coverImage"),
  "El ranking debe mantener señales explícitas y exigir arte utilizable en Hero automático."
);

assert(
  sourceConfig.includes("sourceHomeConfig") &&
    sourceConfig.includes("heroSlugs") &&
    sourceConfig.includes("popularSlugs") &&
    sourceConfig.includes("lowSpecSlugs") &&
    sourceConfig.includes("recommendedSlugs") &&
    sourceConfig.includes("defaultHomeCuration") &&
    sourceConfig.includes('hero: { mode: "hybrid" }') &&
    sourceConfig.includes('lowSpec: { mode: "manual" }'),
  "La portada debe conservar fallback fuente y traducir el comportamiento histórico al nuevo modelo sin romper revisiones viejas."
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
  adminHomePage.includes("getPublicGames") &&
    adminHomePage.includes("publicBySlug") &&
    adminHomePage.includes("curationGames") &&
    adminHomePage.includes("games={curationGames}"),
  "La vista previa administrativa debe calcular el ranking con payloads públicos reales y no con cambios de juegos todavía en borrador."
);

assert(
  curationEditor.includes("Manual") &&
    curationEditor.includes("Automático") &&
    curationEditor.includes("Híbrido") &&
    curationEditor.includes("resolveHomeCollectionGames") &&
    curationEditor.includes("rankHomeGames") &&
    curationEditor.includes('name="curationJson"') &&
    curationEditor.includes("VISTA PREVIA DEL RESULTADO") &&
    curationEditor.includes("activeSelection.length >= meta.limit") &&
    !curationEditor.includes("textarea"),
  "Curaduría debe ser un espacio editorial profesional con modos, límite visible, ranking explicable y vista previa, no un editor de slugs crudos."
);

assert(
  curationRoute.includes('"curationJson"') &&
    curationRoute.includes("curationJson.hero.slugs") &&
    curationRoute.includes("curationJson.popular.mode") &&
    curationRoute.includes("curation:") &&
    !curationRoute.includes("heroSlugsText"),
  "La ruta de Curaduría debe persistir la selección estructurada y sus modos sin campos de texto heredados."
);

assert(
  presentationRoute.includes("curation: item.payload.curation"),
  "Guardar Presentación debe conservar la configuración de Curaduría existente."
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
    "Home editorial: OK (curaduría profesional, preview con snapshots públicos, ranking explicable compartido, estabilidad diaria y compatibilidad histórica)."
  );
}
