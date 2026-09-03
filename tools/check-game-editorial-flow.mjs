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
  publicationReadiness,
  editorFlow,
  mediaIntegrity,
  publicRevalidation,
  performanceService,
  contentValidation,
  contentValidationCore,
  contentForms,
  performanceModel,
  performanceData,
  calibrationHook,
  performanceEstimate,
  compatibilityCard,
  publicPerformanceRoute,
  createRoute,
  coreRoute,
  advancedRoute,
  requirementsRoute,
  performanceRoute,
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
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/lib/admin/game-editor-flow.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-public-revalidation.ts"),
  source("src/lib/admin/game-performance-service.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/admin/content-validation-core.ts"),
  source("src/lib/admin/content-forms.ts"),
  source("src/features/game-finder/performance-model.ts"),
  source("src/features/game-finder/performance-data.ts"),
  source("src/features/game-finder/useGamePerformanceCalibration.ts"),
  source("src/features/game-finder/GamePerformanceEstimate.tsx"),
  source("src/app/juegos/[slug]/GameCompatibilityCard.tsx"),
  source("src/app/api/games/[slug]/performance/route.ts"),
  source("src/app/api/admin/content/games/route.ts"),
  source("src/app/api/admin/content/games/[slug]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/advanced/route.ts"),
  source("src/app/api/admin/content/games/[slug]/requirements/route.ts"),
  source("src/app/api/admin/content/games/[slug]/performance/route.ts"),
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

const completeContentValidation =
  `${contentValidation}\n${contentValidationCore}`;

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
  "Rendimiento",
  "Multimedia",
  "Descargas",
]) {
  assert(
    publicationChanges.includes(section),
    `La comparación previa debe contemplar la sección ${section}.`
  );
}

assert(
  publicationReadiness.includes('section: "rendimiento"') &&
    publicationReadiness.includes("resolvePerformanceProfile") &&
    publicationReadiness.includes('label: "Estimación de FPS"'),
  "El checklist de publicación debe indicar si existe una calibración capaz de estimar FPS."
);

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
  completeContentValidation.includes("performanceCalibrationSchema") &&
    completeContentValidation.includes("performance: performanceCalibrationSchema.optional()") &&
    completeContentValidation.includes("referenceFps") &&
    completeContentValidation.includes("ramGb") &&
    completeContentValidation.includes("fpsCap"),
  "El payload editorial del juego debe validar estrictamente la calibración de rendimiento."
);

assert(
  contentForms.includes("editorialGamePerformanceFormSchema") &&
    contentForms.includes("optionalCalibrationNumber(1_000)") &&
    contentForms.includes("optionalCalibrationNumber(512)") &&
    contentForms.includes("value.referenceFps > value.fpsCap"),
  "El formulario de Rendimiento debe validar rangos, campos parciales y coherencia del límite de FPS."
);

assert(
  performanceService.includes("verifyAdminSession") &&
    performanceService.includes("FOR UPDATE") &&
    performanceService.includes("draft_payload") &&
    performanceService.includes("source_checksum") &&
    performanceService.includes("editorial_revisions") &&
    performanceService.includes("admin_audit_log") &&
    performanceService.includes('section: "performance"') &&
    !/\bDELETE\s+FROM\b/i.test(performanceService),
  "Guardar Rendimiento debe ser transaccional, versionado, auditable y no destructivo."
);

assert(
  publicPerformanceRoute.includes("getPublicGameBySlug") &&
    publicPerformanceRoute.includes("game.performance ?? null") &&
    publicPerformanceRoute.includes('"Cache-Control": "no-store, max-age=0"') &&
    !publicPerformanceRoute.includes("draft_payload"),
  "La calibración consumida por visitantes debe proceder únicamente del juego público visible y nunca del borrador."
);

assert(
  performanceData.includes("resolvePerformanceProfile") &&
    performanceData.includes("return profileMap.get(slug) ?? null") &&
    performanceData.includes("referenceFps: calibration.referenceFps"),
  "El motor debe priorizar la calibración editorial y conservar perfiles históricos sólo como respaldo."
);

assert(
  performanceModel.includes("resolvePerformanceProfile") &&
    performanceModel.includes("if (!profile)") &&
    performanceModel.includes("canEstimate: false") &&
    performanceModel.includes("todavía no tiene una calibración de rendimiento publicada"),
  "Un slug nuevo sin calibración debe degradar a estado no estimable sin lanzar una excepción."
);

assert(
  calibrationHook.includes("resolved = new Map") &&
    calibrationHook.includes("pending = new Map") &&
    calibrationHook.includes("/performance") &&
    calibrationHook.includes("parsePublishedCalibration") &&
    calibrationHook.includes('cache: "no-store"'),
  "Los bloques públicos de rendimiento deben compartir una lectura validada y deduplicada de la calibración publicada."
);

for (const [name, component] of [
  ["FPS estimados", performanceEstimate],
  ["compatibilidad", compatibilityCard],
]) {
  assert(
    component.includes("useGamePerformanceCalibration") &&
      component.includes("estimateGamePerformance") &&
      component.includes("calibration ?? undefined"),
    `El bloque público de ${name} debe usar la misma calibración publicada.`
  );
}

assert(
  createRoute.includes("?seccion=datos&estado=creado"),
  "Después de crear un juego, el flujo debe continuar por la siguiente sección editorial."
);

assert(
  editorFlow.includes('ficha: "datos"') &&
    editorFlow.includes('datos: "requisitos"') &&
    editorFlow.includes('requisitos: "rendimiento"') &&
    editorFlow.includes('rendimiento: "multimedia"') &&
    editorFlow.includes('multimedia: "descargas"') &&
    editorFlow.includes('descargas: "publicacion"') &&
    editorFlow.includes('searchParams.get("continuar")') &&
    editorFlow.includes("requested === nextSection[current]"),
  "El avance guiado debe pasar por Rendimiento y aceptar exclusivamente la siguiente etapa prevista desde la URL."
);

for (const [name, route, current] of [
  ["ficha", coreRoute, '"ficha"'],
  ["datos", advancedRoute, '"datos"'],
  ["requisitos", requirementsRoute, '"requisitos"'],
  ["rendimiento", performanceRoute, '"rendimiento"'],
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
  performanceRoute.includes("editorialGamePerformanceFormSchema") &&
    performanceRoute.includes("saveGamePerformanceDraft") &&
    performanceRoute.includes('"referenceFps"') &&
    performanceRoute.includes('"ramGb"') &&
    performanceRoute.includes('"fpsCap"'),
  "La ruta administrativa de Rendimiento debe aceptar únicamente los campos esperados y usar el servicio versionado."
);

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
    gameEditor.includes("GamePerformanceEditor") &&
    gameEditor.includes('section === "rendimiento"') &&
    gameEditor.includes('continueTo="rendimiento"') &&
    gameEditor.includes('continueTo="publicacion"'),
  "El editor debe mostrar el estado real, integrar Rendimiento y guiar el alta completa hasta Publicación."
);

assert(
  catalog.includes("/publicacion") &&
    catalog.includes("publicationActionLabel") &&
    catalog.includes("Publicar cambios") &&
    catalog.includes("Republicar"),
  "El catálogo debe dar acceso claro a publicar altas, borradores modificados y juegos ocultos."
);

assert(
  contextBar.includes('key: "compatibilidad"') &&
    contextBar.includes('key: "rendimiento"') &&
    contextBar.includes('label: "Rendimiento"') &&
    contextBar.includes('href: `${gamePath}?seccion=rendimiento`') &&
    contextBar.includes('key: "publicacion"') &&
    contextBar.includes('href: `${gamePath}/publicacion`') &&
    contextBar.includes("Publicación"),
  "Rendimiento debe permanecer accesible dentro de Compatibilidad y Publicación como estación principal del workspace del juego."
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
    "Flujo editorial de juegos: OK (alta privada, Rendimiento versionado, FPS públicos compartidos, avance guiado seguro, integridad multimedia, refresco uniforme, comparación de cambios, vista previa, publicación y restauración protegidas)."
  );
}
