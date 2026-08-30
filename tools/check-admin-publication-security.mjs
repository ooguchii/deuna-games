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
  publicationService,
  creationService,
  visibilityService,
  publicSiteConfig,
  publicHomeConfig,
  publicCatalog,
  publicUpdates,
  publishRoute,
  restoreRoute,
  homePublishRoute,
  homeRestoreRoute,
  hideGameRoute,
  hideUpdateRoute,
  publicationMigration,
  visibilityMigration,
  homeMigration,
  migrator,
] = await Promise.all([
  source("src/lib/admin/publication-service.ts"),
  source("src/lib/admin/content-create-service.ts"),
  source("src/lib/admin/visibility-service.ts"),
  source("src/lib/site/public-site-config.ts"),
  source("src/lib/home/public-home-config.ts"),
  source("src/lib/games/public-catalog.ts"),
  source("src/lib/updates/public-updates.ts"),
  source("src/app/api/admin/content/configuration/publish/route.ts"),
  source("src/app/api/admin/content/configuration-publications/[publicationId]/restore/route.ts"),
  source("src/app/api/admin/content/home/publish/route.ts"),
  source("src/app/api/admin/content/home-publications/[publicationId]/restore/route.ts"),
  source("src/app/api/admin/content/games/[slug]/hide/route.ts"),
  source("src/app/api/admin/content/updates/[id]/hide/route.ts"),
  source("database/migrations/003_editorial_publications.sql"),
  source("database/migrations/004_editorial_visibility.sql"),
  source("database/migrations/005_home_editorial_config.sql"),
  source("tools/admin/migrate.ts"),
]);

assert(
  publicationService.includes('| "site_config"') &&
    publicationService.includes('| "home_config"') &&
    publicationService.includes(
      'parseEditorialPayload("site_config", payload)'
    ) &&
    publicationService.includes(
      'parseEditorialPayload("home_config", payload)'
    ) &&
    publicationService.includes(
      'return getPublicationState("site_config", "site")'
    ) &&
    publicationService.includes(
      'return getPublicationState("home_config", "home")'
    ) &&
    publicationService.includes(
      'publishEditorialDraft(\n    "home_config",\n    "home"'
    ) &&
    publicationService.includes(
      'restoreEditorialPublication(\n    "home_config"'
    ),
  "site_config y home_config deben compartir el mismo servicio de publicación y restauración."
);

assert(
  publicationService.includes("FOR UPDATE") &&
    publicationService.includes("published_payload") &&
    publicationService.includes("published_checksum") &&
    publicationService.includes("editorial_publications") &&
    publicationService.includes("admin_audit_log") &&
    publicationService.includes("public_visible = true") &&
    publicationService.includes("!item.public_visible") &&
    !/\bDELETE\s+FROM\b/i.test(publicationService),
  "La publicación debe ser transaccional, auditable, activar visibilidad explícita, conservar historial y no borrar registros."
);

assert(
  creationService.includes("source_present") &&
    creationService.includes("'modified'") &&
    creationService.includes("public_visible") &&
    creationService.includes("false") &&
    creationService.includes("ON CONFLICT (item_type, item_key)") &&
    creationService.includes("content_created") &&
    creationService.includes("game_update") &&
    !/\bDELETE\s+FROM\b/i.test(creationService),
  "Las altas creadas desde el panel deben nacer como borradores ocultos, preservar la fuente y rechazar identidades duplicadas sin borrar contenido."
);

assert(
  visibilityService.includes("FOR UPDATE") &&
    visibilityService.includes("public_visible = false") &&
    visibilityService.includes("content_hidden") &&
    visibilityService.includes("admin_audit_log") &&
    !visibilityService.includes("published_payload") &&
    !visibilityService.includes("published_checksum") &&
    !/\bDELETE\s+FROM\b/i.test(visibilityService),
  "Ocultar debe ser transaccional y auditable, cambiar sólo visibilidad y nunca tocar snapshots ni borrar contenido."
);

for (const [name, content] of [
  ["catálogo", publicCatalog],
  ["actualizaciones", publicUpdates],
]) {
  assert(
    content.includes("public_visible") &&
      content.includes("published_payload") &&
      content.includes("!editorial.public_visible") &&
      !content.includes("draft_payload"),
    `La lectura pública de ${name} debe considerar filas ocultas para suprimir contenido fuente y usar sólo snapshots publicados.`
  );
}

assert(
  publicSiteConfig.includes("public_visible = true") &&
    publicSiteConfig.includes("published_payload") &&
    !publicSiteConfig.includes("draft_payload"),
  "La configuración pública debe exigir visibilidad explícita y usar sólo el snapshot publicado."
);

assert(
  publicHomeConfig.includes("public_visible = true") &&
    publicHomeConfig.includes("published_payload") &&
    publicHomeConfig.includes("item_type = 'home_config'") &&
    !publicHomeConfig.includes("draft_payload"),
  "La portada pública debe exigir visibilidad explícita y usar sólo el snapshot publicado."
);

for (const [name, route] of [
  ["juego", hideGameRoute],
  ["actualización", hideUpdateRoute],
]) {
  assert(
    route.includes("authorizeAdminFormRequest") &&
      route.includes("expectedPublicationNumber") &&
      route.includes("hasExactAdminFormFields") &&
      route.includes("revalidatePath"),
    `Ocultar ${name} debe exigir sesión/origen, control de concurrencia y revalidación pública.`
  );
}

assert(
  publishRoute.includes("authorizeAdminFormRequest") &&
    publishRoute.includes("publishSiteConfigDraft") &&
    publishRoute.includes('revalidatePath("/", "layout")'),
  "Publicar configuración debe exigir sesión/origen y revalidar la identidad pública."
);

assert(
  restoreRoute.includes("authorizeAdminFormRequest") &&
    restoreRoute.includes("restoreSiteConfigPublication") &&
    restoreRoute.includes("expectedPublicationNumber"),
  "Restaurar configuración debe exigir sesión/origen y control de concurrencia por número de publicación."
);

assert(
  homePublishRoute.includes("authorizeAdminFormRequest") &&
    homePublishRoute.includes("publishHomeConfigDraft") &&
    homePublishRoute.includes('revalidatePath("/")'),
  "Publicar portada debe exigir sesión/origen y revalidar Inicio."
);

assert(
  homeRestoreRoute.includes("authorizeAdminFormRequest") &&
    homeRestoreRoute.includes("restoreHomeConfigPublication") &&
    homeRestoreRoute.includes("expectedPublicationNumber") &&
    homeRestoreRoute.includes('revalidatePath("/")'),
  "Restaurar portada debe exigir sesión/origen, concurrencia y revalidación de Inicio."
);

assert(
  publicationMigration.includes("published_payload") &&
    publicationMigration.includes("editorial_publications") &&
    publicationMigration.includes("'bootstrap'") &&
    !/WHERE\s+item_type\s*=\s*'game'/i.test(publicationMigration),
  "La migración de publicaciones debe inicializar snapshots para todos los tipos editoriales."
);

assert(
  visibilityMigration.includes("public_visible") &&
    visibilityMigration.includes("DEFAULT true") &&
    visibilityMigration.includes("SET public_visible = true"),
  "La migración de visibilidad debe conservar visible todo contenido existente y permitir que las altas nuevas nazcan ocultas."
);

assert(
  homeMigration.includes("home_config") &&
    homeMigration.includes("editorial_items_type_check") &&
    !/\bDELETE\s+FROM\b/i.test(homeMigration),
  "La migración de portada debe ampliar únicamente los tipos editoriales sin borrar contenido."
);

assert(
  migrator.includes("GRANT INSERT (\n        id,\n        item_type,\n        item_key") &&
    migrator.includes("public_visible") &&
    !/GRANT[\s\S]{0,300}\bDELETE\b/i.test(migrator),
  "El runtime debe recibir INSERT editorial sólo por columnas y nunca permisos de borrado."
);

if (failures.length > 0) {
  console.error("\nPublicación administrativa: BLOQUEADA\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exitCode = 1;
} else {
  console.log(
    "Publicación administrativa: OK (juegos, actualizaciones, identidad y portada usan snapshots, auditoría y restauración sin borrado)."
  );
}
