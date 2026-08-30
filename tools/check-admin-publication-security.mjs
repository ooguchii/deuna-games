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
  publicSiteConfig,
  publicCatalog,
  publicUpdates,
  publishRoute,
  restoreRoute,
  publicationMigration,
  visibilityMigration,
  migrator,
] = await Promise.all([
  source("src/lib/admin/publication-service.ts"),
  source("src/lib/admin/content-create-service.ts"),
  source("src/lib/site/public-site-config.ts"),
  source("src/lib/games/public-catalog.ts"),
  source("src/lib/updates/public-updates.ts"),
  source("src/app/api/admin/content/configuration/publish/route.ts"),
  source("src/app/api/admin/content/configuration-publications/[publicationId]/restore/route.ts"),
  source("database/migrations/003_editorial_publications.sql"),
  source("database/migrations/004_editorial_visibility.sql"),
  source("tools/admin/migrate.ts"),
]);

assert(
  publicationService.includes('| "site_config"') &&
    publicationService.includes(
      'parseEditorialPayload("site_config", payload)'
    ) &&
    publicationService.includes(
      'return getPublicationState("site_config", "site")'
    ) &&
    publicationService.includes(
      'publishEditorialDraft(\n    "site_config",\n    "site"'
    ) &&
    publicationService.includes(
      'restoreEditorialPublication(\n    "site_config"'
    ),
  "site_config debe compartir el mismo servicio de publicación y restauración que el resto del contenido."
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
    !/\bDELETE\s+FROM\b/i.test(creationService),
  "Un juego creado desde el panel debe nacer como borrador oculto, preservar la fuente y rechazar identidades duplicadas sin borrar contenido."
);

for (const [name, content] of [
  ["catálogo", publicCatalog],
  ["actualizaciones", publicUpdates],
  ["configuración", publicSiteConfig],
]) {
  assert(
    content.includes("public_visible = true") &&
      content.includes("published_payload") &&
      !content.includes("draft_payload"),
    `La lectura pública de ${name} debe exigir visibilidad explícita y usar sólo snapshots publicados.`
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
  publicationMigration.includes("published_payload") &&
    publicationMigration.includes("editorial_publications") &&
    publicationMigration.includes("'bootstrap'") &&
    !/WHERE\s+item_type\s*=\s*'game'/i.test(publicationMigration),
  "La migración de publicaciones debe inicializar snapshots para todos los tipos editoriales, incluida la configuración."
);

assert(
  visibilityMigration.includes("public_visible") &&
    visibilityMigration.includes("DEFAULT true") &&
    visibilityMigration.includes("SET public_visible = true"),
  "La migración de visibilidad debe conservar visible todo contenido existente y permitir que las altas nuevas nazcan ocultas."
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
    "Publicación administrativa: OK (altas ocultas, snapshots explícitos, visibilidad controlada, auditoría y restauración sin borrado)."
  );
}
