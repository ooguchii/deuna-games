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
  detailEditor,
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
  source("src/components/admin/GameDetailMediaEditor.tsx"),
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
    'GAME_DETAIL_VIEWPORT_ASPECT = "source"',
    'const detailMode = resolveGameDestinationMediaMode(game, "detail")',
    "detail.cropReady",
    "const galleryItems = resolveGameGalleryItems(game);",
    "const galleryAssigned = galleryItems.length > 0;",
    "const galleryCropReady = galleryAssigned && galleryItems.every(",
    "(item) => isGameGalleryItemConfirmed(game, item)",
    "background.cropReady",
    "galleryCropReady"
  ),
  "Portada/Hero/Card deben conservar 4:5/16:9/3:2; Contenedor debe ser adaptable; Fondo activado y cada imagen/video de Galería deben exigir recortes confirmados."
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
    "detail?: GameImageViewport",
    "detail?: GameDestinationMediaMode",
    "export type GameDetailVideo",
    "detail?: GameDetailVideo",
    "detailImage?: string",
    "export type GameGalleryItem",
    "galleryMedia?: GameGalleryItem[]",
    "confirmed?: true"
  ),
  "El modelo debe persistir Galería mixta elegible y un Contenedor multimedia independiente sin duplicar archivos físicos."
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
    "detail: fixedImageViewportSchema.optional()",
    "detail: mediaModeSchema.optional()",
    "detail: destinationVideoSchema.optional()",
    "galleryMediaSchema",
    "kind: z.literal(\"video\")",
    "aspectRatio: z.number().min(0.1).max(10).optional()",
    'viewport.aspect === "free" && viewport.aspectRatio === undefined',
    'viewport.aspect !== "free" && viewport.aspectRatio !== undefined'
  ),
  "La validación editorial debe validar la Galería mixta, reservar relaciones libres para imágenes y mantener el Contenedor sobre viewport adaptable fijo."
);

assert(
  has(
    workspace,
    "GAME_IMAGE_CROP_ASPECTS",
    "gameImageCropAspectLabel",
    'import GameDetailMediaEditor from "@/components/admin/GameDetailMediaEditor"',
    "Contenedor · adaptable",
    "Galería obligatoria · relación elegible",
    "16:9, 3:2, 1:1, 4:5, 9:16 o Libre",
    "Libre habilita arrastre por bordes y esquinas",
    "cropStateLabel",
    "Recortes confirmados",
    "RECORTES CONFIRMADOS",
    "const pendingGalleryCrops = screenshots.filter(",
    "imageMedia?.gallery?.[src]?.confirmed !== true",
    "const galleryCropReady = gallerySelectionReady && pendingGalleryCrops.length === 0",
    'title="Recorte de la captura"',
    "<span>F</span><h3>Galería del juego</h3>"
  ) &&
    !workspace.includes("Galería obligatoria · 16:9") &&
    !workspace.includes("Cada captura asignada debe confirmar su encuadre 16:9") &&
    !workspace.includes("REQUISITO CUMPLIDO · RECORTES 16:9 CONFIRMADOS"),
  "El workspace legado debe conservar Contenedor como destino E y la compatibilidad de edición de capturas mientras el administrador mixto toma Galería F."
);

assert(
  has(
    detailEditor,
    "Contenedor de la ficha",
    "Imagen + hover",
    'value="detail-mode"',
    'value={`detail-${kind}`}',
    "Recorte adaptable ·",
    "RECORTE ADAPTABLE CONFIRMADO",
    "RECORTE ADAPTABLE NO CONFIRMADO",
    'target="detail"',
    'source="independent"',
    "ImageViewportEditor",
    "GameVideoViewportEditor"
  ),
  "Contenedor debe usar la misma Biblioteca y adaptadores de recorte, con tres modos y estados de selección/confirmación explícitos."
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
  "Debe existir un único editor de imagen/video; sólo Libre habilita ocho tiradores y los destinos rígidos/adaptables mantienen su relación bloqueada."
);

assert(
  has(
    imageEditor,
    "MediaViewportEditor",
    'target === "gallery"',
    'target === "detail"',
    "GAME_DETAIL_VIEWPORT_ASPECT",
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
    "Confirmar recorte adaptable"
  ) &&
    !imageEditor.includes("resolvePreviewViewportCrop") &&
    !imageEditor.includes("storeEditorialWebp"),
  "Galería y Contenedor deben usar el editor espacial común; sólo Galería persiste relación seleccionable."
);

assert(
  has(
    imageLayoutRoute,
    'const legacyImageTargets = ["cover", "hero", "card", "gallery"] as const',
    'const targetSchema = z.enum([...legacyImageTargets, "detail"])',
    '"viewportAspect"',
    '"viewportAspectRatio"',
    "expectsGalleryResource",
    "parseGameImageViewport(",
    "confirmed: true",
    "saveGameMediaDraft"
  ) &&
    !imageLayoutRoute.includes("storeEditorialWebp") &&
    !imageLayoutRoute.includes("spawn("),
  "La API de imagen debe guardar sólo metadata; relación/aspectRatio continúan reservados para Galería y detail guarda X/Y/zoom confirmado."
);

assert(
  has(
    videoViewportEditor,
    "GAME_DETAIL_VIEWPORT_ASPECT",
    "function targetAspect(target: Target)",
    'target === "detail"',
    "MediaViewportEditor",
    'kind="video"'
  ) &&
    has(
      videoLayoutRoute,
      "GAME_DETAIL_VIEWPORT_ASPECT",
      'target === "detail"',
      "submittedAspect !== requiredAspect",
      "withGameVideoLayout"
    ),
  "Portada/Hero/Card deben conservar relaciones rígidas; Contenedor usa source adaptable y ningún video hereda el modo Libre de Galería."
);

assert(
  has(
    mediaLibraryRoute,
    '"detail-mode"',
    '"detail-image"',
    '"detail-video"',
    '"gallery-image"',
    '"gallery-remove"',
    "detailImage: item.payload.detailImage ?? null",
    'resolveGameDestinationMediaMode(item.payload, "detail")',
    "detailVideo: item.payload.videoMedia?.detail ?? null",
    "DEFAULT_GAME_IMAGE_VIEWPORT",
    "gallery:"
  ),
  "La Biblioteca debe asignar Contenedor y mantener compatibilidad de Galería por referencia y metadata pendiente antes de editar recortes."
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

for (const id of [
  "cover-crop",
  "hero-crop",
  "card-crop",
  "detail-container-media",
  "gallery-minimum",
]) {
  assert(publicationReadiness.includes(`id: "${id}"`), `Publicación debe exigir ${id}.`);
}
assert(
  publicationReadiness.includes("complete: media.detail.cropReady") &&
    publicationReadiness.includes("complete: media.gallery.cropReady") &&
    publicationWorkspace.includes("!readiness.essentialsReady") &&
    has(publishRoute, "evaluateGamePublicationReadiness", "readiness.essentialsReady", "preparacion-incompleta") &&
    has(restoreRoute, "evaluateGamePublicationReadiness", "readiness.essentialsReady", "restauracion-incompleta"),
  "Publicación y restauración deben bloquear Contenedor o Galería incompletos."
);

if (failures.length) {
  console.error("Destinos multimedia: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Destinos multimedia: OK (Portada 4:5 · Hero 16:9 · Card 3:2 · Fondo adaptable · Contenedor adaptable independiente · Galería mixta elegible/Libre)."
);
