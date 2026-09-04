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
  publishedVideoReferences,
  imageUploadRoute,
  imageUploadForm,
  workspace,
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
  source("src/lib/admin/published-game-video-references.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
  source("src/components/admin/GameMediaUploadForm.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
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
    '"image-delete"',
    '"video-delete"',
    "withoutImageResource",
    "withoutVideoResource",
    "listGameImageReferences",
    "listGameVideoReferences",
    "getPublishedGameImageReferences",
    "getPublishedGameVideoReferences",
    "publishedReferences.includes",
    "markEditorialMediaForDeletion",
    "deleteEditorialMediaResource",
    "saveGameMediaDraft"
  ) &&
    !libraryRoute.includes("spawn(") &&
    !libraryRoute.includes("writeFile(") &&
    !libraryRoute.includes("unlink("),
  "Asignación y eliminación deben estar autenticadas, proteger referencias publicadas y mantener IO físico fuera de la ruta."
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
    libraryRoute,
    'videoMedia.hero?.clip === resource',
    'videoMedia.card?.source === "hero"',
    'videoMedia.card?.source === "independent"',
    "videoMedia.detail?.clip === resource",
    "videoMedia.background?.clip === resource",
    "game.previewClip === resource"
  ),
  "Eliminar un WebM debe limpiar Portada/Hero/Card/Contenedor/Fondo/preview sin dejar referencias colgantes."
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
  "Los WebM todavía publicados deben detectarse antes de permitir el borrado físico."
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
  "Eliminar recurso",
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
    "DeleteResourceForm",
    'value={resource.kind === "image" ? "image-delete" : "video-delete"}',
    "libraryGroups",
    'renderLibraryGroup("IMÁGENES", "image", images)',
    'renderLibraryGroup("VIDEOS", "video", videos)',
    "setPreviewResource(resource)",
    "usageLabels(previewResource)",
    "summary"
  ),
  "Biblioteca debe separar tipos, ampliar por click, eliminar ambos tipos y mostrar previews en el resumen."
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
  "El layout debe separar biblioteca y usar miniaturas más legibles con botón destructivo menos circular."
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
  "Biblioteca multimedia compartida: OK (WebP/WebM seguros · separación visual · preview grande · borrado diferido protegido · recortes independientes)."
);
