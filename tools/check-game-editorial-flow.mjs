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
  publicationOverview,
  publicationReview,
  publicationChanges,
  editorFlow,
  mediaIntegrity,
  publicRevalidation,
  createRoute,
  coreRoute,
  advancedRoute,
  requirementsRoute,
  mediaRoute,
  downloadRoute,
  publishRoute,
  hideRoute,
  restoreRoute,
  gamesPage,
  gameEditor,
  formActions,
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
  source("src/lib/admin/publication-overview.ts"),
  source("src/lib/admin/game-publication-review.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("src/lib/admin/game-editor-flow.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-public-revalidation.ts"),
  source("src/app/api/admin/content/games/route.ts"),
  source("src/app/api/admin/content/games/[slug]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/advanced/route.ts"),
  source("src/app/api/admin/content/games/[slug]/requirements/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media/route.ts"),
  source("src/app/api/admin/content/games/[slug]/download/route.ts"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/app/api/admin/content/games/[slug]/hide/route.ts"),
  source("src/app/api/admin/content/publications/[publicationId]/restore/route.ts"),
  source("src/app/admin/(protected)/juegos/page.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/components/admin/GameEditorFormActions.tsx"),
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
  publicationOverview.includes("panel_created") &&
    publicationOverview.includes("ever_published") &&
    publicationOverview.includes("getGamePublicationIdentity") &&
    publicationOverview.includes("item.public_visible") &&
    publicationOverview.includes("has_unpublished_changes") &&
    publicationOverview.includes("revision.revision = 1") &&
    publicationOverview.includes("revision.action = 'draft_saved'") &&
    publicationOverview.includes("publication.action IN ('published', 'rollback')"),
  "El editor y el catálogo deben derivar su estado del origen permanente, la visibilidad pública y la diferencia real entre borrador y snapshot."
);

assert(
  publicationReview.includes("verifyAdminSession") &&
    publicationReview.includes("SELECT published_payload") &&
    publicationReview.includes("getGameDraftPublicationCandidate") &&
    publicationReview.includes("getHistoricalGamePublicationCandidate") &&
    publicationReview.includes("draft_payload") &&
    publicationReview.includes("publication.payload") &&
    publicationReview.includes('parseEditorialPayload(\n      "game"') &&
    !/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(publicationReview),
  "La revisión previa debe leer snapshots y candidatos de publicación de forma autenticada y estrictamente sin mutaciones."
);

for (const section of [
  "Ficha principal",
  "Datos e identidad",
  "Requisitos",
  "Multimedia",
  "Descargas",
]) {
  assert(
    publicationChanges.includes(section),
    `La comparación previa debe contemplar la sección ${section}.`
  );
}

assert(
  mediaIntegrity.includes("lstat") &&
    mediaIntegrity.includes("!stats.isSymbolicLink()") &&
    mediaIntegrity.includes("resolveEditorialMediaDiskPath") &&
    mediaIntegrity.includes("inspectLocalImageReferences") &&
    mediaIntegrity.includes("inspectGameMediaIntegrity") &&
    mediaIntegrity.includes('game.coverImage') &&
    mediaIntegrity.includes('game.heroImage') &&
    mediaIntegrity.includes('game.screenshots'),
  "Guardar o publicar un juego debe verificar que todas las imágenes locales referenciadas existan y no sean enlaces simbólicos."
);

for (const publicPath of [
  'revalidatePath("/")',
  'revalidatePath("/juegos")',
  'revalidatePath("/actualizaciones")',
  'revalidatePath("/requisitos")',
  'revalidatePath(`/juegos/${slug}`)',
  'revalidatePath(`/juegos/${slug}/descargar`)',
]) {
  assert(
    publicRevalidation.includes(publicPath),
    `El refresco público compartido debe incluir ${publicPath}.`
  );
}

assert(
  createRoute.includes("?seccion=datos&estado=creado"),
  "Después de crear un juego, el flujo debe continuar por la siguiente sección editorial."
);

assert(
  editorFlow.includes('ficha: "datos"') &&
    editorFlow.includes('datos: "requisitos"') &&
    editorFlow.includes('requisitos: "multimedia"') &&
    editorFlow.includes('multimedia: "descargas"') &&
    editorFlow.includes('descargas: "publicacion"') &&
    editorFlow.includes('searchParams.get("continuar")') &&
    editorFlow.includes("requested === nextSection[current]"),
  "El avance guiado debe aceptar exclusivamente la siguiente etapa prevista y leer la intención desde la URL, no desde campos de contenido."
);

for (const [name, route, current] of [
  ["ficha", coreRoute, '"ficha"'],
  ["datos", advancedRoute, '"datos"'],
  ["requisitos", requirementsRoute, '"requisitos"'],
  ["multimedia", mediaRoute, '"multimedia"'],
  ["descargas", downloadRoute, '"descargas"'],
]) {
  assert(
    route.includes("requestedGameEditorContinuation") &&
      route.includes("request.nextUrl") &&
      route.includes("gameEditorSuccessTarget") &&
      route.includes(current) &&
      route.includes("hasExactAdminFormFields") &&
      route.includes('result.outcome === "conflict"'),
    `Guardar ${name} debe mantener validación exacta y sólo avanzar tras un guardado sin conflicto.`
  );
}

assert(
  mediaRoute.includes("inspectLocalImageReferences") &&
    !mediaRoute.includes("resolveEditorialMediaDiskPath") &&
    !mediaRoute.includes("lstat"),
  "La edición multimedia debe reutilizar la misma validación de integridad que protege la publicación."
);

assert(
  formActions.includes("formAction") &&
    formActions.includes("?continuar=") &&
    !formActions.includes('name="continuar"'),
  "Guardar y continuar debe conservar los mismos campos del formulario y expresar el destino sólo en la URL de acción."
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
      route.includes("revalidatePublicGameSurfaces"),
    `La acción de ${name} debe conservar seguridad, concurrencia, refresco público compartido y volver a la estación de publicación.`
  );
}

assert(
  publishRoute.includes("getGameDraftPublicationCandidate") &&
    publishRoute.includes("inspectGameMediaIntegrity") &&
    publishRoute.includes("candidate.revision !== expected.data") &&
    publishRoute.includes("asset-publicacion"),
  "Publicar debe volver a leer la revisión candidata y bloquear el snapshot si alguna multimedia referenciada dejó de existir."
);

assert(
  restoreRoute.includes("getHistoricalGamePublicationCandidate") &&
    restoreRoute.includes("inspectGameMediaIntegrity") &&
    restoreRoute.includes("currentPublicationNumber !== expected.data") &&
    restoreRoute.includes("asset-restauracion"),
  "Restaurar una publicación histórica debe validar su concurrencia y multimedia antes de volverla pública."
);

assert(
  gamesPage.includes('"unpublished"') &&
    gamesPage.includes("neverPublished") &&
    gamesPage.includes("publication?.panelCreated") &&
    gamesPage.includes("!publication.everPublished") &&
    gamesPage.includes("publicationNumber: neverPublished"),
  "La lista de juegos debe distinguir mediante historial real un alta nunca pública de un juego oculto."
);

assert(
  gameEditor.includes("getGamePublicationIdentity") &&
    gameEditor.includes("publicationLabel") &&
    gameEditor.includes("Cambios pendientes") &&
    gameEditor.includes("Publicado · #") &&
    gameEditor.includes("publicationIdentity?.panelCreated") &&
    gameEditor.includes("!item.sourcePresent && !panelCreated") &&
    gameEditor.includes("GameEditorFormActions") &&
    gameEditor.includes('continueTo="publicacion"'),
  "El editor debe mostrar el estado real frente a la web, no confundir altas del panel con fuentes perdidas y guiar el alta hasta Publicación."
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
    publicationPage.includes("getGamePublicationIdentity") &&
    publicationPage.includes("getPublishedGameSnapshot") &&
    publicationPage.includes("publishedGame={publishedGame}") &&
    publicationPage.includes("neverPublished") &&
    publicationPage.includes("panelCreated") &&
    publicationPage.includes("GamePublicationWorkspace"),
  "La estación de publicación debe distinguir altas privadas mediante origen permanente y comparar el borrador con el snapshot transaccional real."
);

assert(
  publicationWorkspace.includes("evaluateGamePublicationChanges") &&
    publicationWorkspace.includes("CAMBIOS QUE SALDRÁN A LA WEB") &&
    publicationWorkspace.includes("Se publicará") &&
    publicationWorkspace.includes("Publicar por primera vez") &&
    publicationWorkspace.includes("Publicar cambios") &&
    publicationWorkspace.includes("Volver a publicar") &&
    publicationWorkspace.includes("Vista previa del borrador") &&
    publicationWorkspace.includes("asset-publicacion") &&
    publicationWorkspace.includes("asset-restauracion") &&
    publicationWorkspace.includes("Abrir Multimedia para corregirlo") &&
    publicationWorkspace.includes("expectedRevision") &&
    publicationWorkspace.includes("expectedPublicationNumber") &&
    publicationWorkspace.includes("Base privada inicial") &&
    !/\bDELETE\b/i.test(publicationWorkspace),
  "La estación debe mostrar el alcance del cambio, explicar bloqueos de integridad y cubrir primera publicación, republicación, ocultar, restaurar y revisión previa sin acciones destructivas."
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
    "Flujo editorial de juegos: OK (alta privada, avance guiado seguro, integridad multimedia al publicar, refresco público uniforme, estados exactos, comparación de cambios, vista previa sin mutaciones, republicación y restauración protegidas)."
  );
}
