import { readFile } from "node:fs/promises";
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
  creationService,
  publicCatalog,
  publicationService,
  createRoute,
  publishRoute,
  hideRoute,
  restoreRoute,
  gamesPage,
  catalog,
  contextBar,
  publicationPage,
  publicationWorkspace,
  previewPage,
  newGamePage,
  newGameForm,
] = await Promise.all([
  source("src/lib/admin/content-create-service.ts"),
  source("src/lib/games/public-catalog.ts"),
  source("src/lib/admin/publication-service.ts"),
  source("src/app/api/admin/content/games/route.ts"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/app/api/admin/content/games/[slug]/hide/route.ts"),
  source("src/app/api/admin/content/publications/[publicationId]/restore/route.ts"),
  source("src/app/admin/(protected)/juegos/page.tsx"),
  source("src/components/admin/AdminGamesCatalog.tsx"),
  source("src/components/admin/AdminContextBar.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/publicacion/page.tsx"),
  source("src/components/admin/GamePublicationWorkspace.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/vista-previa/page.tsx"),
  source("src/app/admin/(protected)/juegos/nuevo/page.tsx"),
  source("src/components/admin/NewGameForm.tsx"),
]);

assert(
  creationService.includes("public_visible") &&
    creationService.includes("false") &&
    creationService.includes("'modified'") &&
    creationService.includes("content_created") &&
    !/\bDELETE\s+FROM\b/i.test(creationService),
  "Un juego creado desde el panel debe nacer como borrador oculto, auditable y sin borrado."
);

assert(
  publicCatalog.includes("public_visible") &&
    publicCatalog.includes("published_payload") &&
    !publicCatalog.includes("draft_payload"),
  "El catálogo público debe seguir leyendo sólo snapshots publicados y visibles."
);

assert(
  publicationService.includes("draft_payload") &&
    publicationService.includes("published_payload = $2::jsonb") &&
    publicationService.includes("published_checksum") &&
    publicationService.includes("public_visible = true") &&
    publicationService.includes("FOR UPDATE") &&
    !/\bDELETE\s+FROM\b/i.test(publicationService),
  "Publicar debe copiar el borrador a un snapshot versionado mediante transacción y nunca borrar historial."
);

assert(
  createRoute.includes("?seccion=datos&estado=creado"),
  "Después de crear un juego, el flujo debe continuar por la siguiente sección editorial."
);

for (const [name, route] of [
  ["publicar", publishRoute],
  ["ocultar", hideRoute],
  ["restaurar", restoreRoute],
]) {
  assert(
    route.includes("/publicacion") &&
      route.includes("authorizeAdminFormRequest") &&
      route.includes("expected") &&
      route.includes("revalidatePath"),
    `La acción de ${name} debe conservar seguridad, concurrencia, revalidación y volver a la estación de publicación.`
  );
}

assert(
  gamesPage.includes('"unpublished"') &&
    gamesPage.includes("neverPublished") &&
    gamesPage.includes("publicationNumber: neverPublished"),
  "La lista de juegos debe distinguir un alta que nunca fue pública de un juego oculto."
);

assert(
  catalog.includes("/publicacion") &&
    catalog.includes("publicationActionLabel") &&
    catalog.includes("Publicar cambios") &&
    catalog.includes("Republicar"),
  "El catálogo debe dar acceso claro a publicar altas, borradores modificados y juegos ocultos."
);

assert(
  contextBar.includes('id: "publicacion"') &&
    contextBar.includes("/publicacion") &&
    contextBar.includes("Publicación"),
  "Publicación debe ser una pestaña principal del workspace del juego."
);

assert(
  publicationPage.includes("getGamePublicationState") &&
    publicationPage.includes("neverPublished") &&
    publicationPage.includes("panelCreated") &&
    publicationPage.includes("GamePublicationWorkspace"),
  "La estación de publicación debe distinguir altas privadas y leer el estado transaccional real."
);

assert(
  publicationWorkspace.includes("Publicar por primera vez") &&
    publicationWorkspace.includes("Publicar cambios") &&
    publicationWorkspace.includes("Volver a publicar") &&
    publicationWorkspace.includes("Vista previa del borrador") &&
    publicationWorkspace.includes("expectedRevision") &&
    publicationWorkspace.includes("expectedPublicationNumber") &&
    publicationWorkspace.includes("Base privada inicial") &&
    !/\bDELETE\b/i.test(publicationWorkspace),
  "La estación debe cubrir primera publicación, republicación, ocultar, restaurar y revisión previa sin acciones destructivas."
);

assert(
  previewPage.includes("/publicacion") &&
    previewPage.includes("Esta vista sirve únicamente para revisar el contenido") &&
    !previewPage.includes("PublicationPanel") &&
    !previewPage.includes('/publish"') &&
    !previewPage.includes('/hide"') &&
    !previewPage.includes("/restore"),
  "La vista previa debe ser de sólo revisión y delegar toda mutación pública a la estación de Publicación."
);

assert(
  newGamePage.includes("NewGameForm") &&
    newGamePage.includes('listEditorialItems("game")') &&
    newGameForm.includes("slugFromTitle") &&
    newGameForm.includes("Crear borrador y continuar") &&
    newGameForm.includes("Crear no publica"),
  "El alta debe ser guiada, reutilizar categorías y generar un slug seguro sin confundir crear con publicar."
);

if (failures.length > 0) {
  console.error("\nFlujo editorial de juegos: REGRESIÓN\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exitCode = 1;
} else {
  console.log(
    "Flujo editorial de juegos: OK (alta privada, edición por borrador, vista previa sin mutaciones, primera publicación, republicación y restauración protegidas)."
  );
}
