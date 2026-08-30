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
] = await Promise.all([
  source("src/lib/admin/content-validation.ts"),
  source("database/migrations/007_game_taxonomy.sql"),
  source("tools/admin/import-content.ts"),
  source("src/lib/admin/game-taxonomy-service.ts"),
  source("src/app/api/admin/content/catalogs/games/route.ts"),
  source("src/app/admin/(protected)/catalogos/page.tsx"),
  source("src/components/admin/AdminNavigation.tsx"),
]);

assert(
  validation.includes('"game_taxonomy"') &&
    validation.includes("editorialGameTaxonomySchema") &&
    validation.includes("categories: taxonomyTerms(80)") &&
    validation.includes("genres: taxonomyTerms(200)") &&
    validation.includes("tags: taxonomyTerms(500)"),
  "La taxonomía debe ser un tipo editorial validado y acotado."
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
    !/\bDELETE\s+FROM\b/i.test(service),
  "Guardar catálogos debe usar concurrencia, historial, auditoría y proteger términos en uso sin borrado SQL."
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

if (failures.length > 0) {
  console.error("\nTaxonomía editorial: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Taxonomía editorial: OK (categorías, géneros y etiquetas privadas, versionadas, auditadas y protegidas frente a borrado de términos en uso)."
  );
}
