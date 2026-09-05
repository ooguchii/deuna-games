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
  combinedContentRoute,
  homeContentService,
  homeContentEditor,
  creationService,
  heroSection,
  heroStyles,
  heroContract,
  heroDevices,
  heroLayout,
  heroEditor,
  heroEditorRoute,
  presentationEditor,
  livePreview,
  isolatedPreview,
  adminContext,
  homeAdminSections,
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
  source("src/app/api/admin/content/home/content/route.ts"),
  source("src/lib/admin/home-content-service.ts"),
  source("src/components/admin/HomeContentEditor.tsx"),
  source("src/lib/admin/content-create-service.ts"),
  source("src/components/home/HeroSection.tsx"),
  source("src/components/home/HeroSection.module.css"),
  source("src/lib/home/hero-contract.ts"),
  source("src/lib/home/hero-devices.ts"),
  source("src/lib/home/hero-layout.ts"),
  source("src/components/admin/HomeHeroEditor.tsx"),
  source("src/app/api/admin/content/home/hero/route.ts"),
  source("src/components/admin/HomePresentationEditor.tsx"),
  source("src/components/admin/HomeHeroLivePreview.tsx"),
  source("src/components/admin/IsolatedPublicPreviewFrame.tsx"),
  source("src/components/admin/AdminContextBar.tsx"),
  source("src/lib/admin/home-admin-sections.ts"),
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
  "La Home pública debe entregar al Hero juegos publicados y su contrato visual, no un segundo copy del Hero."
);

assert(
  adminHomePage.includes("resolveHomeAdminSection") &&
    adminHomePage.includes('if (section === "hero")') &&
    adminHomePage.includes('if (section === "contenido")') &&
    adminHomePage.includes("HomeContentEditor") &&
    adminHomePage.includes("key={item.revision}") &&
    !adminHomePage.includes("listPublicationStates") &&
    !adminHomePage.includes("buildHomeGameCollections"),
  "Portada admin debe cargar datos por sección y montar Resto de Inicio como un editor coordinado."
);

assert(
  adminHomePage.includes("publicGames={publicGames}") &&
    adminHomePage.includes("games={curationGames}") &&
    adminHomePage.includes("const publishedSlugs = publicGames.map"),
  "Hero y contenido deben derivar su verdad pública directamente del catálogo publicado."
);

assert(
  homeContentEditor.includes("onSubmitCapture") &&
    homeContentEditor.includes("/api/admin/content/home/content") &&
    homeContentEditor.includes('input[name="curationJson"]') &&
    homeContentEditor.includes('input[name="presentationJson"]') &&
    homeContentEditor.includes("router.refresh()"),
  "Resto de Inicio debe interceptar los dos formularios y guardarlos mediante una única operación."
);

assert(
  combinedContentRoute.includes("hasExactAdminFormFields") &&
    combinedContentRoute.includes("curationJson") &&
    combinedContentRoute.includes("presentationJson") &&
    combinedContentRoute.includes("saveHomeContentDraft"),
  "La ruta conjunta debe validar exactamente ambos slices antes del guardado atómico."
);

assert(
  homeContentService.includes("saveHomeContentDraft") &&
    homeContentService.includes("heroSlugs: current.heroSlugs") &&
    homeContentService.includes("hero: current.curation.hero") &&
    homeContentService.includes("heroPresentation: current.heroPresentation") &&
    homeContentService.includes("hero: current.copy.hero"),
  "Resto de Inicio debe preservar autoritativamente todo el dominio del Hero."
);

assert(
  curationEditor.includes("Manual") &&
    curationEditor.includes("Automático") &&
    curationEditor.includes("Híbrido") &&
    curationEditor.includes("resolveHomeCollectionGames") &&
    curationEditor.includes("new Set(publishedSlugs)") &&
    curationEditor.includes("publishedSet.has(game.slug)") &&
    !curationEditor.includes("publishedSlugs === null") &&
    !curationEditor.includes("? games"),
  "Curaduría debe operar en fail-closed: un borrador nunca puede convertirse en candidato público por falta de estado."
);

assert(
  curationEditor.includes("deuna:home-curation-draft:latest") &&
    curationEditor.includes("beforeunload") &&
    presentationEditor.includes("deuna:home-presentation-draft:latest") &&
    presentationEditor.includes("beforeunload"),
  "Los dos bloques de Resto de Inicio deben conservar cambios locales y advertir antes de abandonar trabajo sin guardar."
);

assert(
  presentationEditor.includes("type EditableHomeCopy = Omit<HomeCopy, \"hero\">") &&
    presentationEditor.includes("buildPayload") &&
    !presentationEditor.includes("heroPresentation: config.heroPresentation") &&
    !presentationEditor.includes("heroGames:") &&
    !presentationEditor.includes("showHeroStudio"),
  "Presentación debe enviar sólo secciones y copy no-Hero, sin props ni payload fantasma."
);

assert(
  curationRoute.includes("saveHomeCurationDraft") &&
    presentationRoute.includes("saveHomePresentationDraft") &&
    heroEditorRoute.includes("saveHomeHeroDraft") &&
    !curationRoute.includes("saveHomeConfigDraft") &&
    !presentationRoute.includes("saveHomeConfigDraft") &&
    !heroEditorRoute.includes("saveHomeConfigDraft"),
  "Las rutas HTTP de Home deben delegar ensamblado y ownership al servicio de dominio."
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
  heroDevices.includes("HOME_HERO_BREAKPOINTS") &&
    heroDevices.includes("mobileMax: 680") &&
    heroDevices.includes("tabletMax: 1100") &&
    heroDevices.includes("HOME_HERO_VIEWPORT_DEFAULTS") &&
    heroDevices.includes("clampHomeHeroViewport") &&
    livePreview.includes("homeHeroDeviceForWidth") &&
    livePreview.includes("HOME_HERO_VIEWPORT_WIDTH_LIMITS"),
  "La preview debe consumir un contrato único de dispositivos y límites JS."
);

assert(
  heroSection.includes("HOME_HERO_VISUAL_POSITIONS.map") &&
    heroSection.includes("presentation.positions[position]") &&
    heroSection.includes("homeHeroPositionTransform(positionStyle)") &&
    heroSection.includes("homeHeroPositionDisplay") &&
    heroSection.includes("homeHeroSlotCSS") &&
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
  "El Hero público debe obtener su información del juego y no depender de copy paralelo."
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
    heroStyles.includes("@media(max-width:1100px)") &&
    heroStyles.includes("@media(max-width:680px)") &&
    heroStyles.includes("prefers-reduced-motion"),
  "Las transiciones y los breakpoints públicos del Hero deben seguir implementados."
);

assert(
  heroEditor.includes("Editor de Hero") &&
    heroEditor.includes("El contenido del Hero se toma del juego") &&
    heroEditor.includes("homeHeroVisiblePositions") &&
    heroEditor.includes("Aplicar cambios a:") &&
    heroEditor.includes("Transformación 3D") &&
    heroEditor.includes("Tarjetas visibles") &&
    heroEditor.includes("Perspectiva") &&
    heroEditor.includes("Easing") &&
    heroEditor.includes("Cambiar imagen") &&
    heroEditor.includes("Ajustar encuadre") &&
    heroEditor.includes("selectionModes") &&
    heroEditor.includes("HomeHeroLivePreview") &&
    !heroEditor.includes("Título accesible") &&
    !heroEditor.includes("Botón principal") &&
    !heroEditor.includes("Botón secundario"),
  "El editor del Hero debe controlar selección, geometría y comportamiento sin campos de copy fantasma."
);

assert(
  livePreview.includes("<HeroSection") &&
    livePreview.includes('className="main-content"') &&
    livePreview.includes("<PublicPageBackground") &&
    livePreview.includes('previewPathname="/"') &&
    livePreview.includes("IsolatedPublicPreviewFrame") &&
    livePreview.includes("ref={setPreviewEnd}") &&
    isolatedPreview.includes("createPortal") &&
    isolatedPreview.includes("synchronizePreviewStyles") &&
    isolatedPreview.includes("synchronizeRootIdentity") &&
    !heroEditor.includes("previewCopy"),
  "La vista del editor debe usar el renderer público real dentro de infraestructura de preview aislada."
);

assert(
  adminContext.includes("homeAdminSectionContract") &&
    adminContext.includes("homeSections = homeAdminSectionContract.map") &&
    homeAdminSections.includes("resolveHomeAdminSection"),
  "IDs y labels de navegación de Inicio deben tener una única fuente administrativa."
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
    "Home editorial: OK (ownership aislado, guardado atómico, catálogo público fail-closed, preview pública compartida y carga por sección)."
  );
}
