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
  publicSiteConfig,
  publishRoute,
  restoreRoute,
  migration,
] = await Promise.all([
  source("src/lib/admin/publication-service.ts"),
  source("src/lib/site/public-site-config.ts"),
  source("src/app/api/admin/content/configuration/publish/route.ts"),
  source("src/app/api/admin/content/configuration-publications/[publicationId]/restore/route.ts"),
  source("database/migrations/003_editorial_publications.sql"),
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
    !/\bDELETE\s+FROM\b/i.test(publicationService),
  "La publicación debe ser transaccional, auditable, conservar historial y no borrar registros."
);

assert(
  publicSiteConfig.includes("published_payload") &&
    publicSiteConfig.includes("item_type = 'site_config'") &&
    publicSiteConfig.includes("item_key = 'site'") &&
    !publicSiteConfig.includes("draft_payload"),
  "La identidad pública debe leer exclusivamente el snapshot publicado y nunca el borrador."
);

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
  migration.includes("published_payload") &&
    migration.includes("editorial_publications") &&
    migration.includes("'bootstrap'") &&
    !/WHERE\s+item_type\s*=\s*'game'/i.test(migration),
  "La migración de publicaciones debe inicializar snapshots para todos los tipos editoriales, incluida la configuración."
);

if (failures.length > 0) {
  console.error("\nPublicación administrativa: BLOQUEADA\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exitCode = 1;
} else {
  console.log(
    "Publicación administrativa: OK (site_config usa snapshot publicado, transacción, auditoría y restauración sin borrar historial)."
  );
}
