import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const has = (text, ...needles) => needles.every((needle) => text.includes(needle));

const [
  packageJson,
  library,
  libraryRoute,
  mediaResourceDeleteRoute,
  publishedVideoReferences,
  imageUploadRoute,
  imageUploadForm,
  workspace,
  utilityRail,
  multimediaEditor,
  multimediaCss,
  contextualCss,
  mediaPreview,
  mediaPreviewCss,
  contextualDialog,
  contextualDialogCss,
  mediaViewportEditor,
  videoViewportEditor,
  imageViewportEditor,
  mediaIntegrity,
] = await Promise.all([
  source("package.json"),
  source("src/lib/media/editorial-media-library.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-resource-delete/route.ts"),
  source("src/lib/admin/published-game-video-references.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
  source("src/components/admin/GameMediaUploadForm.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameMultimediaUtilityRail.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/components/admin/GameMultimediaEditor.module.css"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.module.css"),
  source("src/components/admin/AdminMediaLibraryPreview.tsx"),
  source("src/components/admin/AdminMediaLibraryPreview.module.css"),
  source("src/components/admin/ContextualMediaDialog.tsx"),
  source("src/components/admin/ContextualMediaDialog.module.css"),
  source("src/components/admin/MediaViewportEditor.tsx"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/lib/admin/game-media-integrity.ts"),
]);

assert(
  packageJson.includes("check-shared-media-library.mjs"),
  "El checker de biblioteca compartida debe seguir dentro del pipeline principal."
);

assert(
  has(
    library,
    "MEDIA_FILENAME",
    "DELETE_MARKER",
    "[a-f0-9]{64}",
    "MAX_EDITORIAL_IMAGE_BYTES",
    "MAX_EDITORIAL_PREVIEW_BYTES",
    "inspectSafeEditorialWebp",
    "inspectSafeEditorialWebm",
    "stats.isSymbolicLink()",
    "MAX_LIBRARY_RESOURCES",
    "listAssignedBundledImageResources",
    "mergeEditorialMediaResources"
  ),
  "La biblioteca debe enumerar sólo recursos WebP/WebM seguros, hash-nombrados, acotados y no simbólicos."
);

assert(
  has(
    library,
    "markEditorialMediaForDeletion",
    "deleteEditorialMediaResource",
    "reconcileEditorialMediaDeletions",
    "clearEditorialMediaDeletionMarker",
    "resolveEditorialMediaDiskPath",
    "inspectEditorialResourceFile",
    "inspection.digest !== expectedDigest",
    "unlink(",
    "writeFile(",
    'flag: "wx"'
  ),
  "La eliminación física de imágenes y videos debe revalidar ruta, hash y formato antes de borrar bytes."
);

assert(
  has(
    libraryRoute,
    "verifyAdminSession",
    "authorizeAdminFormRequest",
    "hasExactAdminFormFields",
    "findEditorialMediaResource",
    "resourcesForGame",
    "protectedReferencesForGame",
    "getHistoricalGameMediaReferences",
    "listGameImageReferences",
    "listGameVideoReferences",
    "getPublishedGameImageReferences",
    "getPublishedGameVideoReferences",
    "reconcileEditorialMediaDeletions",
    "saveGameMediaDraft"
  ) &&
    !libraryRoute.includes('"image-delete"') &&
    !libraryRoute.includes('"video-delete"') &&
    !libraryRoute.includes("markEditorialMediaForDeletion") &&
    !libraryRoute.includes("deleteEditorialMediaResource") &&
    !libraryRoute.includes("withoutImageResource") &&
    !libraryRoute.includes("withoutVideoResource") &&
    !libraryRoute.includes("spawn(") &&
    !libraryRoute.includes("writeFile(") &&
    !libraryRoute.includes("unlink("),
  "La ruta legacy de biblioteca debe ser exclusivamente de lectura/asignación, proteger publicación e historial y no conservar ningún camino destructivo."
);

assert(
  has(
    libraryRoute,
    'target.data === "gallery-remove"',
    'withoutGalleryItem(current, "image", resource)',
    "delete gallery[resource]",
    "galleryImageSources(galleryMedia)"
  ),
  "Quitar una captura de Galería debe retirar sólo su asignación y recorte, preservando el master y resincronizando la compatibilidad de imágenes."
);

assert(
  has(
    mediaResourceDeleteRoute,
    "authorizeAdminFormRequest",
    "hasExactAdminFormFields",
    "draftReferences.has(resource)",
    "getHistoricalGameMediaReferences",
    "historicalReferences",
    'redirectPath(slug, "recurso-en-historial")',
    "markEditorialMediaForDeletion",
    "deleteEditorialMediaResource"
  ) &&
    !mediaResourceDeleteRoute.includes("saveGameMediaDraft"),
  "La eliminación destructiva debe vivir sólo en la ruta dedicada, rechazar referencias del borrador/historial y nunca quitar asignaciones implícitamente."
);

assert(
  has(
    publishedVideoReferences,
    "published_payload",
    "public_visible",
    "parseEditorialPayload",
    "listGameVideoReferences",
    "verifyAdminSession"
  ),
  "Los WebM todavía publicados deben seguir siendo detectables por la capa de publicación."
);

assert(
  has(
    mediaIntegrity,
    "listGameImageReferences",
    "listGameVideoReferences",
    "game.cardImage",
    "game.videoMedia?.background?.clip",
    "game.previewClip"
  ),
  "La integridad debe cubrir todas las referencias de imagen y video del juego."
);

assert(
  has(
    imageUploadRoute,
    '"library"',
    "storeEditorialWebp",
    "clearEditorialImageDeletionMarker",
    'kind.data === "library"',
    "recurso-subido"
  ) &&
    has(
      imageUploadForm,
      "libraryOnly?: boolean",
      'name="kind" value="library"',
      "Preparar y guardar en biblioteca"
    ),
  "Subir una imagen a biblioteca debe guardarla una vez sin asignarla automáticamente a un destino."
);

for (const label of [
  "RESUMEN MULTIMEDIA",
  "Asignación de destinos",
  "Biblioteca multimedia compartida",
  "IMÁGENES",
  "VIDEOS",
  "Portada del juego",
  "Hero de inicio",
  "Card del juego",
  "Imagen + hover",
  "Gestionar galería",
]) {
  assert(
    workspace.includes(label),
    `El workspace multimedia debe conservar la jerarquía o acción: ${label}.`
  );
}

assert(
  has(
    workspace,
    "AdminMediaLibraryPreview",
    "libraryGroups",
    'renderLibraryGroup("IMÁGENES", "image", images)',
    'renderLibraryGroup("VIDEOS", "video", videos)',
    "setPreviewResource(resource)",
    "usageLabels(previewResource)",
    "summary"
  ),
  "El workspace de asignación debe conservar previews y agrupación de recursos aunque la biblioteca administrativa principal viva en el rail profesional."
);

assert(
  has(
    utilityRail,
    "Biblioteca multimedia compartida",
    "media-resource-delete",
    'resource.hygiene?.status !== "unused"',
    "Protegido",
    "Historial",
    "Por resolver ·"
  ),
  "La biblioteca visible debe administrar higiene y ofrecer borrado sólo para masters realmente huérfanos mediante la ruta dedicada."
);

assert(
  has(
    mediaPreview,
    "ContextualMediaDialog",
    "VideoPreview",
    "Retroceder 10 segundos",
    "Avanzar 10 segundos",
    "Pantalla completa",
    'type="range"',
    "muted",
    "playsInline",
    'preload="metadata"'
  ) &&
    !mediaPreview.includes("volume") &&
    has(
      mediaPreviewCss,
      ".imageStage",
      ".videoStage",
      ".videoControls",
      "object-fit: contain"
    ),
  "La vista grande debe ampliar imágenes y reproducir videos con controles básicos sin interfaz de audio."
);

assert(
  has(
    contextualCss,
    ".libraryGroups",
    ".libraryPreviewButton",
    ".deleteResourceButton",
    "border-radius: 7px"
  ) &&
    has(
      multimediaCss,
      ".summaryThumb",
      ".summaryMediaSet",
      ".currentThumb",
      ".choiceThumb"
    ),
  "El layout histórico puede conservar estilos de compatibilidad mientras la superficie visible use la biblioteca profesional."
);

assert(
  multimediaEditor.includes("GameMultimediaWorkspaceContextual") &&
    !multimediaEditor.includes("Opciones avanzadas · rutas manuales"),
  "El editor principal debe seguir usando el workspace contextual."
);

assert(
  has(
    contextualDialog,
    "createPortal",
    "document.body",
    'event.key === "Escape"',
    'aria-modal="true"',
    'document.body.style.overflow = "hidden"'
  ) &&
    has(contextualDialogCss, ".dialogWide", "1380px", "100dvh"),
  "Los previews y editores deben reutilizar el overlay accesible existente."
);

assert(
  has(
    mediaViewportEditor,
    'type MediaKind = "image" | "video"',
    "resolvePreviewViewportCrop",
    "Posición X",
    "Posición Y",
    "Zoom",
    "Resultado final",
    'objectFit: "contain"'
  ) &&
    has(imageViewportEditor, "MediaViewportEditor", 'kind="image"', "image-layout") &&
    has(videoViewportEditor, "MediaViewportEditor", 'kind="video"', "preview-layout"),
  "Los recortes de destino deben continuar usando el motor común sin recodificar los masters."
);

if (failures.length > 0) {
  console.error("\nBiblioteca multimedia compartida: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Biblioteca multimedia compartida: OK (WebP/WebM seguros · ruta legacy assignment-only · borrado dedicado con historial protegido · preview grande · recortes independientes)."
);
