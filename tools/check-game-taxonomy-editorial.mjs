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
  return readFile(path.join(root, relativePath), "utf8");
}

const [
  validation,
  migration,
  importer,
  service,
  route,
  page,
  navigation,
  createRoute,
  coreRoute,
  advancedRoute,
  newGamePage,
  newGameForm,
  gameEditorPage,
  taxonomySelector,
  taxonomyEditor,
  taxonomyPresentation,
  taxonomyIcon,
  publicTaxonomy,
  homeClassifications,
  homePage,
  catalogClient,
  gamesPage,
  publicCatalog,
] = await Promise.all([
  source("src/lib/admin/content-validation.ts"),
  source("database/migrations/007_game_taxonomy.sql"),
  source("tools/admin/import-content.ts"),
  source("src/lib/admin/game-taxonomy-service.ts"),
  source("src/app/api/admin/content/catalogs/games/route.ts"),
  source("src/app/admin/(protected)/catalogos/page.tsx"),
  source("src/components/admin/AdminNavigation.tsx"),
  source("src/app/api/admin/content/games/route.ts"),
  source("src/app/api/admin/content/games/[slug]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/advanced/route.ts"),
  source("src/app/admin/(protected)/juegos/nuevo/page.tsx"),
  source("src/components/admin/NewGameForm.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/components/admin/GameTaxonomyMultiSelect.tsx"),
  source("src/components/admin/GameTaxonomyEditor.tsx"),
  source("src/lib/games/taxonomy-presentation.ts"),
  source("src/components/taxonomy/TaxonomyIcon.tsx"),
  source("src/lib/games/public-taxonomy.ts"),
  source("src/components/home/FeaturedCategories.tsx"),
  source("src/app/page.tsx"),
  source("src/components/games/GameCatalogClient.tsx"),
  source("src/app/juegos/page.tsx"),
  source("src/lib/games/catalog.ts"),
]);

assert(
  validation.includes('"game_taxonomy"') &&
    validation.includes("editorialGameTaxonomySchema") &&
    validation.includes("classifications: taxonomyTerms(280)") &&
    validation.includes("legacyGameTaxonomySchema") &&
    validation.includes("mergeLegacyTaxonomyTerms") &&
    validation.includes("tags: taxonomyTerms(500)") &&
    validation.includes("icon: z.enum(taxonomyIconKeys).optional()") &&
    validation.includes("tone: z.enum(taxonomyToneKeys).optional()"),
  "La taxonomía debe validar una sola clasificación, migrar la forma antigua y admitir presentación visual segura."
);

assert(
  migration.includes("'game_taxonomy'") &&
    migration.includes("editorial_items_type_check") &&
    !/\bDELETE\s+FROM\b/i.test(migration),
  "La migración de taxonomía sólo debe ampliar tipos editoriales sin borrar datos."
);

assert(
  importer.includes("ensureGameTaxonomyItem") &&
    importer.includes("buildGameTaxonomy") &&
    importer.includes("classifications: taxonomyTerms") &&
    importer.includes("...(game.genres ?? [])") &&
    importer.includes("public_visible") &&
    importer.includes("false"),
  "El importador debe generar una clasificación única a partir de categoría y géneros históricos sin perder datos."
);

assert(
  service.includes("FOR UPDATE") &&
    service.includes("expectedRevision") &&
    service.includes("preservesUsedGameTerms") &&
    service.includes("editorial_revisions") &&
    service.includes("admin_audit_log") &&
    service.includes("resolveGameTaxonomySelection") &&
    service.includes("taxonomy.classifications") &&
    service.includes("gameClassifications") &&
    service.includes("currentGameKey") &&
    service.includes("term.active") &&
    !/\bDELETE\s+FROM\b/i.test(service),
  "Catálogos debe usar una sola clasificación, concurrencia, historial, auditoría y protección de términos en uso."
);

assert(
  route.includes("authorizeAdminFormRequest") &&
    route.includes("hasExactAdminFormFields") &&
    route.includes("gameTaxonomyFormSchema") &&
    route.includes("saveGameTaxonomyDraft"),
  "La ruta de Catálogos debe exigir sesión/origen, campos exactos y validación estructurada."
);

assert(
  page.includes("verifyAdminSession") &&
    page.includes('getEditorialItem("game_taxonomy", "games")') &&
    page.includes("classifications") &&
    page.includes("GameTaxonomyEditor") &&
    page.includes("EditorialHistory"),
  "Catálogos debe permanecer protegido y presentar una sola lista de clasificaciones."
);

assert(
  navigation.includes('href: "/admin/catalogos"') &&
    navigation.includes('label: "Catálogos"'),
  "Catálogos debe ser accesible desde la navegación administrativa principal."
);

assert(
  createRoute.includes("resolveGameTaxonomySelection") &&
    createRoute.includes("classification.category") &&
    coreRoute.includes("resolveGameTaxonomySelection") &&
    coreRoute.includes("currentGameKey: slug") &&
    advancedRoute.includes("resolveGameTaxonomySelection") &&
    advancedRoute.includes("genres: classification.genres") &&
    advancedRoute.includes("tags: classification.tags"),
  "Crear y editar juegos debe validar clasificación principal, adicionales y etiquetas en el servidor."
);

assert(
  newGamePage.includes('getEditorialItem("game_taxonomy", "games")') &&
    newGamePage.includes("payload.classifications") &&
    newGamePage.includes("term.active") &&
    newGameForm.includes("Clasificación principal") &&
    newGameForm.includes("classifications.map") &&
    !newGameForm.includes('list="game-category-options"'),
  "Nuevo juego debe consumir sólo clasificaciones activas de la única lista maestra."
);

assert(
  gameEditorPage.includes('getEditorialItem("game_taxonomy", "games")') &&
    gameEditorPage.includes("taxonomy?.classifications.filter") &&
    gameEditorPage.includes('label="Clasificaciones adicionales"') &&
    gameEditorPage.includes('name="genresText"') &&
    gameEditorPage.includes('name="tagsText"') &&
    taxonomySelector.includes('type="hidden"') &&
    taxonomySelector.includes("!term.active && !selectedTerm"),
  "El editor debe usar la misma lista maestra para clasificación principal y adicionales, conservando compatibilidad interna."
);

assert(
  taxonomyEditor.includes('kind: "classifications"') &&
    !taxonomyEditor.includes('kind: "genres"') &&
    taxonomyEditor.includes("taxonomyIconOptions") &&
    taxonomyEditor.includes("taxonomyToneOptions") &&
    taxonomyEditor.includes("moveTerm") &&
    taxonomyEditor.includes('field: "icon" | "tone"') &&
    taxonomyPresentation.includes("taxonomyIconKeys") &&
    taxonomyPresentation.includes("taxonomyToneKeys") &&
    taxonomyIcon.includes("iconMap"),
  "Catálogos debe gobernar una sola clasificación con icono, color y orden reutilizables."
);

assert(
  publicTaxonomy.includes("draft_payload") &&
    publicTaxonomy.includes("taxonomy.classifications") &&
    publicTaxonomy.includes("ensureVisuals") &&
    homeClassifications.includes("getPublicTaxonomyPresentation") &&
    homeClassifications.includes("taxonomy.classifications") &&
    homeClassifications.includes("getCategoryStats") &&
    homeClassifications.includes("CLASIFICACIONES") &&
    !homePage.includes("FeaturedGenres") &&
    !homePage.includes("Explora por género"),
  "Inicio debe mostrar una sola superficie de clasificación, sin bloque de géneros duplicado."
);

assert(
  gamesPage.includes("getPublicTaxonomyPresentation") &&
    gamesPage.includes("categoryTerms={taxonomy.classifications}") &&
    catalogClient.includes("categoryTerms: GameTaxonomyTerm[]") &&
    catalogClient.includes("orderedCategoryStats") &&
    catalogClient.includes("resolveTaxonomyVisual") &&
    catalogClient.includes("<TaxonomyIcon") &&
    publicCatalog.includes("gameClassifications") &&
    publicCatalog.includes("getCategoryStats") &&
    publicCatalog.includes("hasClassification") &&
    publicCatalog.includes("seen.has(normalized)"),
  "El catálogo público debe contar y filtrar una clasificación única, deduplicando cada juego dentro de cada término."
);

if (failures.length > 0) {
  console.error("\nTaxonomía editorial: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Taxonomía editorial: OK (categorías y géneros unificados en una sola clasificación; contador único por juego, identidad visual compartida y sin bloque público duplicado)."
  );
}
