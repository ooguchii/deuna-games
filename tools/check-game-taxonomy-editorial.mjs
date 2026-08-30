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
  homeCategories,
  homeGenres,
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
  source("src/components/home/FeaturedGenres.tsx"),
  source("src/app/page.tsx"),
  source("src/components/games/GameCatalogClient.tsx"),
  source("src/app/juegos/page.tsx"),
  source("src/lib/games/catalog.ts"),
]);

assert(
  validation.includes('"game_taxonomy"') &&
    validation.includes("editorialGameTaxonomySchema") &&
    validation.includes("categories: taxonomyTerms(80)") &&
    validation.includes("genres: taxonomyTerms(200)") &&
    validation.includes("tags: taxonomyTerms(500)") &&
    validation.includes("icon: z.enum(taxonomyIconKeys).optional()") &&
    validation.includes("tone: z.enum(taxonomyToneKeys).optional()"),
  "La taxonomía debe ser un tipo editorial validado, acotado y admitir presentación visual segura."
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
    importer.includes("public_visible") &&
    importer.includes("false") &&
    importer.includes('parseEditorialPayload(\n      "game_taxonomy"'),
  "El importador debe generar una taxonomía inicial privada a partir de los juegos existentes."
);

assert(
  service.includes("FOR UPDATE") &&
    service.includes("expectedRevision") &&
    service.includes("preservesUsedGameTerms") &&
    service.includes("editorial_revisions") &&
    service.includes("admin_audit_log") &&
    service.includes("resolveGameTaxonomySelection") &&
    service.includes("currentGameKey") &&
    service.includes("term.active") &&
    !/\bDELETE\s+FROM\b/i.test(service),
  "Catálogos debe usar concurrencia, historial y auditoría, proteger términos en uso y validar asignaciones activas sin borrado SQL."
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
    page.includes("GameTaxonomyEditor") &&
    page.includes("EditorialHistory"),
  "Catálogos debe permanecer dentro del área protegida y mostrar editor e historial."
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
  "Crear y editar juegos debe validar categoría, géneros y etiquetas contra la taxonomía maestra también en el servidor."
);

assert(
  newGamePage.includes('getEditorialItem("game_taxonomy", "games")') &&
    newGamePage.includes("term.active") &&
    newGameForm.includes('<select\n              name="category"') &&
    !newGameForm.includes('list="game-category-options"'),
  "Nuevo juego debe consumir sólo categorías activas de Catálogos y no aceptar clasificación libre."
);

assert(
  gameEditorPage.includes('getEditorialItem("game_taxonomy", "games")') &&
    gameEditorPage.includes("GameTaxonomyMultiSelect") &&
    gameEditorPage.includes('name="genresText"') &&
    gameEditorPage.includes('name="tagsText"') &&
    taxonomySelector.includes('type="hidden"') &&
    taxonomySelector.includes("!term.active && !selectedTerm"),
  "El editor de juegos debe seleccionar géneros y etiquetas desde Catálogos conservando términos antiguos inactivos sin reofrecerlos."
);

assert(
  taxonomyEditor.includes("taxonomyIconOptions") &&
    taxonomyEditor.includes("taxonomyToneOptions") &&
    taxonomyEditor.includes("moveTerm") &&
    taxonomyEditor.includes('field: "icon" | "tone"') &&
    taxonomyPresentation.includes("taxonomyIconKeys") &&
    taxonomyPresentation.includes("taxonomyToneKeys") &&
    taxonomyIcon.includes("iconMap"),
  "Catálogos debe gobernar también icono, color y orden con un registro visual reutilizable."
);

assert(
  publicTaxonomy.includes("draft_payload") &&
    publicTaxonomy.includes("ensureVisuals") &&
    homeCategories.includes("getPublicTaxonomyPresentation") &&
    homeCategories.includes("resolveTaxonomyVisual") &&
    homeCategories.includes("orderedCategories") &&
    homeGenres.includes("getPublicTaxonomyPresentation") &&
    homeGenres.includes("resolveTaxonomyVisual") &&
    homeGenres.includes("orderedGenres") &&
    homePage.includes("<FeaturedGenres games={games} />"),
  "Inicio debe reutilizar directamente la identidad visual y el orden de Catálogos para categorías y géneros publicados."
);

assert(
  gamesPage.includes("getPublicTaxonomyPresentation") &&
    gamesPage.includes("categoryTerms={taxonomy.categories}") &&
    catalogClient.includes("categoryTerms: GameTaxonomyTerm[]") &&
    catalogClient.includes("orderedCategoryStats") &&
    catalogClient.includes("resolveTaxonomyVisual") &&
    catalogClient.includes("<TaxonomyIcon") &&
    publicCatalog.includes("classificationText(game)") &&
    publicCatalog.includes("...(game.genres ?? [])") &&
    publicCatalog.includes("...(game.tags ?? [])"),
  "El catálogo público debe reutilizar la misma categoría maestra y mantener búsqueda por categoría, género y etiqueta."
);

if (failures.length > 0) {
  console.error("\nTaxonomía editorial: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Taxonomía editorial: OK (una sola definición controla nombre, icono, color, orden y asignación; Inicio y catálogo reutilizan la misma identidad sin listas visuales duplicadas)."
  );
}
