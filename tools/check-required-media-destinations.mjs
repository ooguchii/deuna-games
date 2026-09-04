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
    'hero: "3:1"',
    'card: "3:2"',
    "LEGACY_DESTINATION_IMAGE_ASPECTS",
    'hero: "16:9"',
    "const effectiveAspect = viewport.aspect ?? legacyAspect",
    "effectiveAspect === requiredAspect",
    'GAME_DETAIL_VIEWPORT_ASPECT = "source"',
    "detail.cropReady",
    "background.cropReady",
    "galleryCropReady"
  ),
  "El contrato central debe exigir Portada 4:5, Hero 3:1 y Card 3:2, y detectar Hero 16:9 histórico como obsoleto."
);

assert(
  has(
    types,
    "export type GameImageViewportAspect",
    '| "3:1"',
    "aspect?: GameImageViewportAspect",
    "aspectRatio?: number",
    "export type GameVideoViewportAspect",
    "detail?: GameImageViewport",
    "galleryMedia?: GameGalleryItem[]",
    "confirmed?: true"
  ),
  "El modelo debe persistir 3:1 y conservar metadata independiente de Contenedor y Galería."
);

assert(
  has(
    imageViewportPolicy,
    '"3:1"',
    '"3:1": 3',
    'DEFAULT_GALLERY_IMAGE_ASPECT = "16:9"',
    '"free"',
    "resolveGameImageCropAspectRatio"
  ),
  "La política de imagen debe conocer 3:1 sin romper el fallback histórico de Galería ni el modo Libre."
);

assert(
  has(
    previewPolicy,
    '"3:1"',
    '3:1 · Hero panorámico',
    'Libre · arrastra bordes y esquinas',
    "customAspectRatio?: number"
  ),
  "El motor de encuadre de video debe conocer Hero 3:1 y conservar Libre para los flujos compatibles."
);

assert(
  has(
    contentValidation,
    "imageViewportAspectSchema",
    "fixedImageAspectSchema",
    '"3:1"',
    "aspect: fixedImageAspectSchema.optional()",
    "galleryMediaSchema",
    "aspectRatio: z.number().min(0.1).max(10).optional()"
  ),
  "La validación editorial debe aceptar 3:1 en destinos rígidos y seguir validando Galería mixta/Libre."
);

assert(
  has(
    workspace,
    "isImageCropConfirmed",
    "isVideoCropConfirmed",
    "LEGACY_DESTINATION_IMAGE_ASPECTS",
    "Hero · 3:1",
    "Recorte obligatorio · 3:1",
    "COMPLETA LOS RECURSOS Y RECORTES · 3:1",
    "frameAspect={3}",
    "Contenedor · adaptable",
    "Galería obligatoria · relación elegible",
    "16:9, 3:1, 3:2, 1:1, 4:5, 9:16 o Libre",
    "!isImageCropConfirmed(imageMedia?.gallery?.[src])",
    'title="Recorte de la captura"'
  ) &&
    !workspace.includes("Hero · 16:9") &&
    !workspace.includes("Recorte 16:9 del Hero") &&
    !workspace.includes("Recorte obligatorio · 16:9"),
  "Multimedia debe mostrar y validar Hero 3:1 en todos sus estados sin mensajes 16:9 obsoletos."
);

assert(
  has(
    detailEditor,
    "Contenedor de la ficha",
    "Imagen + hover",
    "Recorte adaptable ·",
    "RECORTE ADAPTABLE CONFIRMADO",
    'target="detail"',
    "ImageViewportEditor",
    "GameVideoViewportEditor"
  ),
  "Contenedor debe conservar sus tres modos y el recorte adaptable independiente."
);

assert(
  has(
    mediaViewportEditor,
    'type MediaKind = "image" | "video"',
    "requiredAspect?",
    "selectableAspects?",
    "const RESIZE_HANDLES",
    'const freeResizeEnabled = !aspectLocked && viewportDraft.aspect === "free"',
    "startResize",
    "finishResize",
    "Relación del encuadre · obligatoria",
    "Resultado final",
    "GameMedia"
  ),
  "El editor espacial común debe conservar relaciones bloqueadas y edición Libre con resultado final exacto."
);

assert(
  has(
    imageEditor,
    "MediaViewportEditor",
    "VISTA REAL DEL DESTINO",
    "destinationPreview",
    '"3:1"',
    "GALLERY_ASPECT_OPTIONS",
    "viewportAspect",
    "viewportAspectRatio",
    "Confirmar recorte adaptable"
  ) &&
    !imageEditor.includes("storeEditorialWebp"),
  "El editor de imagen debe mostrar la vista real grande del destino y persistir la relación fija confirmada."
);

assert(
  has(
    imageLayoutRoute,
    'const fixedImageTargets = ["cover", "hero", "card"] as const',
    'const legacyImageTargets = [...fixedImageTargets, "gallery"] as const',
    "expectsFixedAspect",
    "REQUIRED_DESTINATION_ASPECTS[target.data]",
    "viewport.aspect !== REQUIRED_DESTINATION_ASPECTS[target.data]",
    "confirmed: true",
    "saveGameMediaDraft"
  ) &&
    !imageLayoutRoute.includes("storeEditorialWebp") &&
    !imageLayoutRoute.includes("spawn("),
  "La API de imagen debe guardar sólo metadata y rechazar una relación distinta de la exigida por el destino rígido."
);

assert(
  has(
    videoViewportEditor,
    "GAME_DETAIL_VIEWPORT_ASPECT",
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "MediaViewportEditor",
    'kind="video"'
  ) &&
    has(
      videoLayoutRoute,
      "GAME_DETAIL_VIEWPORT_ASPECT",
      "REQUIRED_DESTINATION_ASPECTS[target]",
      "submittedAspect !== requiredAspect",
      "withGameVideoLayout"
    ),
  "Video debe heredar Hero 3:1 del contrato central y rechazar relaciones incorrectas."
);

assert(
  has(
    mediaLibraryRoute,
    '"detail-mode"',
    '"detail-image"',
    '"detail-video"',
    '"gallery-image"',
    '"gallery-remove"',
    "DEFAULT_GAME_IMAGE_VIEWPORT",
    "gallery:"
  ),
  "Biblioteca debe conservar asignaciones por referencia y metadata pendiente antes de editar recortes."
);

assert(
  has(
    backgroundEditor,
    "Recorte adaptable ·",
    "RECORTE ADAPTABLE CONFIRMADO",
    "RECORTE ADAPTABLE NO CONFIRMADO",
    "Usar fondo global"
  ) &&
    has(
      backgroundViewportEditor,
      "Confirmando el recorte adaptable",
      "Confirmar recorte adaptable",
      'requiredAspect="source"'
    ),
  "Fondo debe seguir siendo adaptable y opcional."
);

assert(
  has(
    gameMedia,
    "resolveGameImageCropAspectRatio",
    "hasEditorialAspect",
    "data-game-image-crop"
  ) &&
    gameMediaCss.includes(':global(figure:has(> [data-game-image-crop]))'),
  "El renderer público debe respetar la relación persistida de las imágenes editoriales."
);

for (const id of [
  "cover-crop",
  "hero-crop",
  "card-crop",
  "detail-container-media",
  "gallery-minimum",
]) {
  assert(
    publicationReadiness.includes(`id: "${id}"`),
    `Publicación debe exigir ${id}.`
  );
}

assert(
  publicationReadiness.includes("complete: media.detail.cropReady") &&
    publicationReadiness.includes("complete: media.gallery.cropReady") &&
    publicationWorkspace.includes("!readiness.essentialsReady") &&
    has(
      publishRoute,
      "evaluateGamePublicationReadiness",
      "readiness.essentialsReady",
      "preparacion-incompleta"
    ) &&
    has(
      restoreRoute,
      "evaluateGamePublicationReadiness",
      "readiness.essentialsReady",
      "restauracion-incompleta"
    ),
  "Publicación y restauración deben seguir bloqueando destinos multimedia esenciales incompletos."
);

if (failures.length) {
  console.error("Destinos multimedia: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Destinos multimedia: OK (Portada 4:5 · Hero 3:1 · Card 3:2 · Fondo adaptable · Contenedor adaptable · Galería mixta/Libre)."
);
