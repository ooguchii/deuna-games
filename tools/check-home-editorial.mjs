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
  heroSection,
  heroStyles,
  heroContract,
  heroEditor,
  heroEditorRoute,
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
  source("src/components/home/HeroSection.tsx"),
  source("src/components/home/HeroSection.module.css"),
  source("src/lib/home/hero-contract.ts"),
  source("src/components/admin/HomeHeroEditor.tsx"),
  source("src/app/api/admin/content/home/hero/route.ts"),
]);

assert(
  homeCollections.includes("resolveHomeCollectionGames") &&
    homeCollections.includes("resolved.curation.hero.mode") &&
    homeCollections.includes("resolved.curation.popular.mode") &&
    homeCollections.includes("resolved.curation.lowSpec.mode") &&
    homeCollections.includes("resolved.curation.recommended.mode") &&
    homeCollections.includes("HOME_HERO_MAX_SLIDES") &&
    !homeCollections.includes("getRequiredGame") &&
    !homeCollections.includes("No se encontró el juego editorial requerido"),
  "La Home debe resolver cada colección mediante el modo editorial publicado, usar el contrato compartido del Hero y no depender de slugs obligatorios."
);

assert(
  heroContract.includes("HOME_HERO_MAX_SLIDES = 5") &&
    heroContract.includes("HOME_HERO_VISIBLE_PREVIEWS = 3") &&
    heroContract.includes("HOME_HERO_AUTOPLAY_MS = 6500"),
  "El Hero cinematográfico debe centralizar cantidad de slides, previews visibles y autoplay."
);

assert(
  rankingEngine.includes("scoreHomeGame") &&
    rankingEngine.includes("rankHomeGames") &&
    rankingEngine.includes("resolveHomeCollectionGames") &&
    rankingEngine.includes("reviewScore") &&
    rankingEngine.includes("minimumRamGb") &&
    rankingEngine.includes("homeRankingDay") &&
    rankingEngine.includes("homeRankingProfiles") &&
    rankingEngine.includes("homeRankingDescription") &&
    rankingEngine.includes("components") &&
    rankingEngine.includes('mode === "manual"') &&
    rankingEngine.includes('mode === "automatic"') &&
    rankingEngine.includes("isHomeRankingEligible"),
  "La portada debe conservar un motor compartido, perfilado, explicable, estable por día y determinista para Manual, Automático e Híbrido."
);

assert(
  rankingEngine.includes("popularity: 58") &&
    rankingEngine.includes("rating: 34") &&
    rankingEngine.includes("lowSpec: 60") &&
    rankingEngine.includes("HOME_LOW_SPEC_MAX_RAM_GB") &&
    rankingEngine.includes('target === "hero"') &&
    rankingEngine.includes("game.heroImage || game.coverImage"),
  "El ranking debe mantener perfiles explícitos y exigir arte utilizable en Hero automático."
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

const publicHomeUsesPublishedConfig =
  homePage.includes("getPublicHomeConfig") &&
  /buildHomeGameCollections\(\s*games,\s*homeConfig,/.test(homePage);
const publicHomeUsesOptionalPersonalization =
  homePage.includes("getAccountPersonalization") &&
  homePage.includes("preferences: personalization.preferences") &&
  homePage.includes("hardware: personalization.hardware") &&
  homePage.includes(": undefined");
const publicHomeToleratesEmptyCollections =
  homePage.includes("collections.heroGames.length > 0") &&
  homePage.includes("collections.popularGames.length > 0") &&
  homePage.includes("collections.recommendedGames.length > 0");

assert(
  publicHomeUsesPublishedConfig &&
    publicHomeUsesOptionalPersonalization &&
    publicHomeToleratesEmptyCollections,
  "La portada pública debe consumir la configuración publicada, aplicar sólo personalización opcional de cuenta y tolerar colecciones vacías."
);

assert(
  adminHomePage.includes("getPublicGames") &&
    adminHomePage.includes("publicBySlug") &&
    adminHomePage.includes("curationGames") &&
    adminHomePage.includes("publishedSlugSet") &&
    adminHomePage.includes("heroPreviewCatalog") &&
    adminHomePage.includes("publishedSlugSet.has(game.slug)") &&
    adminHomePage.includes("HomeHeroEditor") &&
    adminHomePage.includes("publicGames={heroPreviewCatalog}") &&
    adminHomePage.includes("games={curationGames}"),
  "La vista previa administrativa debe calcular Hero y ranking con payloads públicos reales, filtrar juegos no publicados y conservar el catálogo editorial completo para edición."
);

assert(
  heroEditor.includes("EDITOR ÚNICO DEL HERO") &&
    heroEditor.includes('name="heroJson"') &&
    heroEditor.includes("resolveHomeCollectionGames") &&
    heroEditor.includes("Editar imagen y recorte") &&
    heroEditor.includes("Guardar Hero") &&
    heroEditorRoute.includes("homeHeroEditorFormSchema") &&
    heroEditorRoute.includes("heroSlugs: hero.slugs") &&
    heroEditorRoute.includes("heroPresentation: hero.presentation") &&
    heroEditorRoute.includes("hero: hero.copy"),
  "El panel debe ofrecer un único editor de Hero con selección, orden, vista previa, diseño, textos y guardado atómico."
);

assert(
  curationEditor.includes("Manual") &&
    curationEditor.includes("Automático") &&
    curationEditor.includes("Híbrido") &&
    curationEditor.includes("resolveHomeCollectionGames") &&
    curationEditor.includes("rankHomeGames") &&
    curationEditor.includes("homeRankingDescription") &&
    curationEditor.includes('name="curationJson"') &&
    curationEditor.includes("VISTA PREVIA DEL RESULTADO") &&
    curationEditor.includes("activeSelection.length >= meta.limit") &&
    !curationEditor.includes("Popularidad 38%") &&
    !curationEditor.includes("Volumen de reseñas 58%") &&
    !curationEditor.includes("textarea"),
  "Curaduría debe reutilizar la definición real del ranking, respetar el límite visible y evitar fórmulas duplicadas o slugs crudos."
);

assert(
  heroSection.includes("HOME_HERO_VISIBLE_PREVIEWS") &&
    heroSection.includes("HOME_HERO_AUTOPLAY_MS") &&
    heroSection.includes("function PreviewCard") &&
    heroSection.includes("function PreviewArtwork") &&
    heroSection.includes("const src = game.coverImage") &&
    heroSection.includes("previewEntries") &&
    heroSection.includes("positionCounter") &&
    heroSection.includes("segments") &&
    heroSection.includes("heroFacts") &&
    heroSection.includes("classificationLine") &&
    heroStyles.includes(".cinematicStage") &&
    heroStyles.includes(".previewRail") &&
    heroStyles.includes(".previewCard") &&
    heroStyles.includes("aspect-ratio: 4 / 5") &&
    heroStyles.includes("aspect-ratio: 3 / 1") &&
    heroStyles.includes("grid-template-columns") &&
    heroStyles.includes("perspective") &&
    heroStyles.includes("rotateY") &&
    heroSection.includes("heroTitleParts") &&
    heroSection.includes("GameMedia") &&
    heroStyles.includes("@media (prefers-reduced-motion: reduce)") &&
    !heroSection.includes("function NextArtwork") &&
    !heroStyles.includes(".nextCard"),
  "El Hero público debe conservar la composición editorial: recorte Hero 3:1 compartido, escenario estable, pila vertical alimentada por Portada, navegación segmentada y transición con profundidad."
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
    "Home editorial: OK (curaduría profesional, Hero cinematográfico de referencia + pila vertical, snapshots públicos, personalización opcional, ranking explicable y estabilidad diaria)."
  );
}
