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
  requirements,
  types,
  imageViewportPolicy,
  previewPolicy,
  workspace,
  mediaViewportEditor,
  imageEditor,
  videoViewportEditor,
  imageLayoutRoute,
  videoLayoutRoute,
  mediaLibraryRoute,
  contentValidation,
  gameMedia,
  gameMediaCss,
  backgroundEditor,
  backgroundViewportEditor,
  publicationReadiness,
  publicationWorkspace,
  publishRoute,
  restoreRoute,
] = await Promise.all([
  source("src/lib/media/game-media-requirements.ts"),
  source("src/types/game.ts"),
  source("src/lib/media/image-viewport.ts"),
  source("src/lib/media/preview-video-policy.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/MediaViewportEditor.tsx"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/components/ui/GameMedia.tsx"),
  source("src/components/ui/GameMedia.module.css"),
  source("src/components/admin/GameBackgroundMediaEditor.tsx"),
  source("src/components/admin/GameBackgroundViewportEditor.tsx"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/components/admin/GamePublicationWorkspace.tsx"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/app/api/admin/content/publications/[publicationId]/restore/route.ts"),
]);

assert(
  has(
    requirements,
    'cover: "4:5"',
    'hero: "16:9"',
    'card: "3:2"',
    "const galleryAssigned = screenshots.length > 0",
    "const galleryCropReady = galleryAssigned && screenshots.every(",
    "isImageCropConfirmed(game.imageMedia?.gallery?.[src])",
    "background.cropReady",
    "galleryCropReady"
  ),
  "Portada/Hero/Card deben conservar 4:5/16:9/3:2; Fondo activado y Galería deben exigir recortes confirmados sin imponer 16:9 a Galería."
);

assert(
  has(
    types,
    "export type GameImageViewportAspect",
    '| "16:9"',
    '| "3:2"',
    '| "1:1"',
    '| "4:5"',
    '| "9:16"',
    '| "free"',
    "aspect?: GameImageViewportAspect",
    "aspectRatio?: number",
    "confirmed?: true"
  ),
  "El modelo de imagen debe persistir relación elegible y relación numérica exacta para recorte Libre."
);

assert(
  has(
    imageViewportPolicy,
    'DEFAULT_GALLERY_IMAGE_ASPECT = "16:9"',
    '"free"',
    "MIN_FREE_IMAGE_ASPECT_RATIO",
    "MAX_FREE_IMAGE_ASPECT_RATIO",
    "parseGameImageViewportAspect",
    "resolveGameImageCropAspectRatio",
    "gameImageCropAspectLabel",
    'aspect === "free"'
  ),
  "La política de imagen debe conservar compatibilidad 16:9 histórica y validar/presentar relaciones libres."
);

assert(
  has(
    previewPolicy,
    '"free"',
    'Libre · arrastra bordes y esquinas',
    "customAspectRatio?: number",
    "MIN_PREVIEW_FREE_ASPECT_RATIO",
    "MAX_PREVIEW_FREE_ASPECT_RATIO",
    'aspect === "free"',
    "customAspectRatio"
  ),
  "El motor espacial debe modelar el modo Libre con una relación exacta y límites seguros."
);

assert(
  has(
    contentValidation,
    "imageViewportAspectSchema",
    '"free"',
    "aspectRatio: z.number().min(0.1).max(10).optional()",
    'viewport.aspect === "free" && viewport.aspectRatio === undefined',
    'viewport.aspect !== "free" && viewport.aspectRatio !== undefined'
  ),
  "La validación editorial debe rechazar recortes libres sin relación y relaciones numéricas fuera del modo Libre."
);

assert(
  has(
    workspace,
    "GAME_IMAGE_CROP_ASPECTS",
    "gameImageCropAspectLabel",
    "Galería obligatoria · relación elegible",
    "16:9, 3:2, 1:1, 4:5, 9:16 o Libre",
    "Libre habilita arrastre por bordes y esquinas",
    "cropStateLabel",
    "Recortes confirmados",
    "RECORTES CONFIRMADOS",
    "const pendingGalleryCrops = screenshots.filter(",
    "imageMedia?.gallery?.[src]?.confirmed !== true",
    "const galleryCropReady = gallerySelectionReady && pendingGalleryCrops.length === 0",
    'title="Recorte de la captura"'
  ) &&
    !workspace.includes("Galería obligatoria · 16:9") &&
    !workspace.includes("Cada captura asignada debe confirmar su encuadre 16:9") &&
    !workspace.includes("REQUISITO CUMPLIDO · RECORTES 16:9 CONFIRMADOS"),
  "El workspace debe mostrar la relación real por captura y no volver a presentar Galería como 16:9 obligatoria."
);

assert(
  has(
    mediaViewportEditor,
    'type MediaKind = "image" | "video"',
    "requiredAspect?",
    "selectableAspects?",
    "const RESIZE_HANDLES",
    "type ResizeHandle = (typeof RESIZE_HANDLES)[number]",
    'const freeResizeEnabled = !aspectLocked && viewportDraft.aspect === "free"',
    "data-resize-handle",
    "isResizeHandle",
    "startResize",
    "moveResize",
    "finishResize",
    "handleResizeKey",
    "Redimensionar recorte desde",
    "cuatro esquinas o de los cuatro bordes",
    "Relación del encuadre · obligatoria",
    "Relación del encuadre",
    "Resultado final",
    "GameMedia"
  ),
  "Debe existir un único editor de imagen/video; sólo Libre habilita ocho tiradores de resize y los destinos rígidos mantienen su relación bloqueada."
);

assert(
  has(
    imageEditor,
    "MediaViewportEditor",
    'target === "gallery"',
    "GALLERY_ASPECT_OPTIONS",
    '"16:9"',
    '"3:2"',
    '"1:1"',
    '"4:5"',
    '"9:16"',
    '"free"',
    "selectableAspects",
    "viewportAspect",
    "viewportAspectRatio",
    "Confirmar recorte"
  ) &&
    !imageEditor.includes("resolvePreviewViewportCrop") &&
    !imageEditor.includes("storeEditorialWebp"),
  "Galería debe usar el editor espacial común y persistir la relación elegida sin crear otro archivo."
);

assert(
  has(
    imageLayoutRoute,
    'const targetSchema = z.enum(["cover", "hero", "card", "gallery"])',
    '"viewportAspect"',
    '"viewportAspectRatio"',
    "expectsGalleryResource",
    "parseGameImageViewport(",
    "confirmed: true",
    "saveGameMediaDraft"
  ) &&
    !imageLayoutRoute.includes("storeEditorialWebp") &&
    !imageLayoutRoute.includes("spawn("),
  "La API de recorte de imagen debe aceptar relación sólo para Galería y guardar exclusivamente metadata confirmada."
);

assert(
  has(
    videoViewportEditor,
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "MediaViewportEditor",
    'kind="video"'
  ) &&
    has(
      videoLayoutRoute,
      "REQUIRED_DESTINATION_ASPECTS[target]",
      "submittedAspect !== requiredAspect",
      "withGameVideoLayout"
    ),
  "Los videos de Portada/Hero/Card deben conservar sus relaciones rígidas y no heredar el modo Libre de Galería."
);

assert(
  has(
    mediaLibraryRoute,
    '"gallery-image"',
    '"gallery-remove"',
    "DEFAULT_GAME_IMAGE_VIEWPORT",
    "gallery:"
  ),
  "La Biblioteca debe seguir asignando capturas por referencia y crear metadata pendiente antes de editar su relación."
);

assert(
  has(
    backgroundEditor,
    "Recorte adaptable ·",
    'complete ? "confirmado" : "no confirmado"',
    "RECORTE ADAPTABLE CONFIRMADO",
    "RECORTE ADAPTABLE NO CONFIRMADO",
    "Usar fondo global"
  ) &&
    !backgroundEditor.includes("Falta ajustar el foco de la imagen") &&
    !backgroundEditor.includes("Foco adaptable de imagen confirmado"),
  "Fondo debe usar la misma terminología de recorte/confirmación que los demás destinos."
);

assert(
  has(
    backgroundViewportEditor,
    "Confirmando el recorte adaptable",
    "Confirmar recorte adaptable",
    'requiredAspect="source"',
    "Un recorte, distintas pantallas"
  ),
  "El Fondo debe conservar su comportamiento adaptable sin volver a llamarlo foco en la acción editorial."
);

assert(
  has(
    gameMedia,
    "resolveGameImageCropAspectRatio",
    "hasEditorialAspect",
    "aspectRatio: String(resolveGameImageCropAspectRatio(viewport))",
    "data-game-image-crop"
  ) &&
    gameMediaCss.includes(':global(figure:has(> [data-game-image-crop]))'),
  "El renderer público debe permitir que una captura de Galería publicada respete la relación persistida, incluida Libre."
);

for (const id of ["cover-crop", "hero-crop", "card-crop", "gallery-minimum"]) {
  assert(publicationReadiness.includes(`id: "${id}"`), `Publicación debe exigir ${id}.`);
}
assert(
  publicationReadiness.includes("complete: media.gallery.cropReady") &&
    publicationWorkspace.includes("!readiness.essentialsReady") &&
    has(publishRoute, "evaluateGamePublicationReadiness", "readiness.essentialsReady", "preparacion-incompleta") &&
    has(restoreRoute, "evaluateGamePublicationReadiness", "readiness.essentialsReady", "restauracion-incompleta"),
  "Publicación y restauración deben seguir bloqueando cualquier recorte de Galería no confirmado, sin importar su relación."
);

if (failures.length) {
  console.error("Destinos multimedia: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Destinos multimedia: OK (Portada 4:5 · Hero 16:9 · Card 3:2 · Fondo adaptable · Galería con relación elegible y recorte Libre redimensionable)."
);
