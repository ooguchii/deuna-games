import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
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
  heroLayout,
  heroEditor,
  heroEditorRoute,
  presentationEditor,
] = await Promise.all([
  source("src/data/home.ts"),
  source("src/lib/home/ranking.ts"),
  source("src/app/page.tsx"),
  source("src/app/admin/(protected)/portada/page.tsx"),
  source("src/data/home-config.ts"),
  source("src/lib/home/public-home-config.ts"),
  source("src/components/admin/HomeCurationEditor.tsx"),
  source("src/app/api/admin/content/home/route.ts"),
  source("src/app/api/admin/content/home/presentation/route.ts"),
  source("src/lib/admin/content-create-service.ts"),
  source("src/components/home/HeroSection.tsx"),
  source("src/components/home/HeroSection.module.css"),
  source("src/lib/home/hero-contract.ts"),
  source("src/lib/home/hero-layout.ts"),
  source("src/components/admin/HomeHeroEditor.tsx"),
  source("src/app/api/admin/content/home/hero/route.ts"),
  source("src/components/admin/HomePresentationEditor.tsx"),
]);

assert(
  homeCollections.includes("resolveHomeCollectionGames") &&
    homeCollections.includes("resolved.curation.hero.mode") &&
    homeCollections.includes("HOME_HERO_MAX_SLIDES"),
  "La Home debe resolver el Hero mediante la curaduría compartida y respetar el límite editorial."
);

assert(
  heroContract.includes("HOME_HERO_MAX_SLIDES = 5") &&
    heroContract.includes("HOME_HERO_AUTOPLAY_MS = 6500"),
  "El contrato del Hero debe centralizar límite y autoplay por defecto."
);

assert(
  rankingEngine.includes("scoreHomeGame") &&
    rankingEngine.includes("resolveHomeCollectionGames") &&
    rankingEngine.includes('mode === "manual"') &&
    rankingEngine.includes('mode === "automatic"') &&
    rankingEngine.includes("isHomeRankingEligible") &&
    rankingEngine.includes('target === "hero"') &&
    rankingEngine.includes("game.heroImage || game.coverImage"),
  "El Hero debe seguir usando el ranking compartido, determinista y con arte publicable."
);

assert(
  sourceConfig.includes("sourceHomeConfig") &&
    sourceConfig.includes("defaultHomeCuration") &&
    sourceConfig.includes("defaultHeroPresentation") &&
    sourceConfig.includes("positions:") &&
    sourceConfig.includes("responsive:"),
  "La configuración fuente debe conservar fallbacks de curaduría y presentación del Hero."
);

assert(
  publicConfig.includes("published_payload") &&
    publicConfig.includes("item_type = 'home_config'") &&
    publicConfig.includes("public_visible = true") &&
    !publicConfig.includes("draft_payload"),
  "La portada pública debe leer sólo el snapshot publicado."
);

assert(
  homePage.includes("getPublicHomeConfig") &&
    homePage.includes("collections.heroGames.length > 0") &&
    homePage.includes("presentation={homeConfig.heroPresentation}") &&
    !homePage.includes("copy={copy.hero}"),
  "La Home pública debe entregar al Hero sólo juegos publicados y su contrato visual, no copy editable."
);

assert(
  adminHomePage.includes("HomeHeroEditor") &&
    adminHomePage.includes("publicGames={heroPreviewCatalog}") &&
    adminHomePage.includes("games={curationGames}"),
  "El editor del Hero debe previsualizar con el catálogo público real y conservar el catálogo editorial para seleccionar."
);

assert(
  heroLayout.includes("HOME_HERO_VISUAL_POSITIONS") &&
    heroLayout.includes('"left2"') &&
    heroLayout.includes('"left1"') &&
    heroLayout.includes('"main"') &&
    heroLayout.includes('"right1"') &&
    heroLayout.includes('"right2"') &&
    heroLayout.includes("homeHeroSlotX") &&
    heroLayout.includes("homeHeroVisiblePositions") &&
    heroLayout.includes("homeHeroPositionTransform"),
  "Editor y frontend deben compartir posiciones, visibilidad, slots y transformaciones del Hero."
);

assert(
  heroSection.includes("HOME_HERO_VISUAL_POSITIONS.map") &&
    heroSection.includes("presentation.positions[position]") &&
    heroSection.includes("homeHeroPositionTransform(positionStyle)") &&
    heroSection.includes("homeHeroPositionDisplay") &&
    heroSection.includes("homeHeroSlotX") &&
    heroSection.includes("--hero-desktop-card-width") &&
    heroSection.includes("--hero-tablet-card-width") &&
    heroSection.includes("--hero-mobile-card-width") &&
    heroSection.includes("--hero-editor-easing") &&
    heroSection.includes("--hero-editor-overlay") &&
    heroSection.includes("--hero-editor-border"),
  "El renderer público debe consumir geometría, responsive, easing, overlay y borde desde HomeHeroPresentation."
);

assert(
  heroSection.includes("game.rating") &&
    heroSection.includes("game.developer") &&
    heroSection.includes("game.releaseDate") &&
    heroSection.includes("game.platforms") &&
    heroSection.includes("game.version") &&
    heroSection.includes('const HERO_PRIMARY_ACTION = "Ver juego"') &&
    heroSection.includes('const HERO_SECONDARY_ACTION = "Más información"') &&
    !heroSection.includes("HomeCopy") &&
    !heroSection.includes("copy: HomeCopy"),
  "El Hero público debe obtener su información del juego y mantener acciones funcionales, no textos configurables."
);

assert(
  heroStyles.includes('data-transition="slide"') &&
    heroStyles.includes('data-transition="coverflow"') &&
    heroStyles.includes('data-transition="fade"') &&
    heroStyles.includes('data-transition="3d"') &&
    heroStyles.includes('data-transition="stack"') &&
    heroStyles.includes('data-transition="perspective"') &&
    heroStyles.includes('data-transition="custom"') &&
    heroStyles.includes("var(--hero-editor-duration)") &&
    heroStyles.includes("var(--hero-editor-easing)") &&
    heroStyles.includes("var(--hero-slot-left2)") &&
    heroStyles.includes("var(--hero-slot-right2)") &&
    heroStyles.includes("@media(max-width:1100px)") &&
    heroStyles.includes("@media(max-width:680px)") &&
    heroStyles.includes("prefers-reduced-motion"),
  "Las siete transiciones y los breakpoints del editor deben tener implementación pública real."
);

assert(
  heroEditor.includes("Editor de Hero") &&
    heroEditor.includes("El contenido del Hero se toma del juego") &&
    heroEditor.includes("homeHeroSlotX") &&
    heroEditor.includes("homeHeroVisiblePositions") &&
    heroEditor.includes("homeHeroPositionTransform") &&
    heroEditor.includes("Aplicar cambios a:") &&
    heroEditor.includes("Transformación 3D") &&
    heroEditor.includes("Tarjetas visibles") &&
    heroEditor.includes("Perspectiva") &&
    heroEditor.includes("Easing") &&
    heroEditor.includes("Editar multimedia y recorte del juego activo") &&
    !heroEditor.includes("Título accesible") &&
    !heroEditor.includes("Botón principal") &&
    !heroEditor.includes("Botón secundario"),
  "El editor del Hero debe controlar selección, geometría y comportamiento sin campos de copy del Hero."
);

assert(
  heroEditorRoute.includes("heroSlugs: hero.slugs") &&
    heroEditorRoute.includes("heroPresentation: hero.presentation") &&
    heroEditorRoute.includes("copy: current.copy") &&
    !heroEditorRoute.includes("hero: hero.copy"),
  "Guardar el Hero debe preservar el copy existente y persistir sólo selección, modo y presentación visual."
);

assert(
  !presentationEditor.includes("setHeroOption") &&
    !presentationEditor.includes("Diseño del Hero") &&
    !presentationEditor.includes("<summary>Hero principal</summary>") &&
    presentationEditor.includes("El Hero queda excluido") &&
    presentationEditor.includes("heroPresentation: config.heroPresentation"),
  "Contenido no debe ofrecer un segundo editor de diseño o textos del Hero."
);

assert(
  presentationRoute.includes("const current = resolveHomeConfig(item.payload)") &&
    presentationRoute.includes("heroPresentation: current.heroPresentation") &&
    presentationRoute.includes("hero: current.copy.hero"),
  "La ruta de Contenido debe preservar autoritativamente geometría y copy del Hero."
);

assert(
  curationEditor.includes("Manual") &&
    curationEditor.includes("Automático") &&
    curationEditor.includes("Híbrido") &&
    curationEditor.includes("resolveHomeCollectionGames") &&
    curationRoute.includes('"curationJson"') &&
    curationRoute.includes("curationJson.hero.slugs"),
  "La curaduría profesional debe seguir operativa junto al nuevo renderer."
);

assert(
  creationService.includes("addedAt: new Date().toISOString().slice(0, 10)"),
  "Los juegos nuevos deben conservar fecha UTC de incorporación."
);

if (failures.length > 0) {
  console.error("\nHome editorial: BLOQUEADA\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Home editorial: OK (Hero game-driven, editor/renderer parity, responsive compartido, publicación segura y ownership único)."
  );
}
