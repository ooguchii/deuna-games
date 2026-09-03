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
  library,
  libraryRoute,
  imageUploadRoute,
  imageUploadForm,
  workspace,
  multimediaEditor,
  multimediaCss,
  contextualCss,
  contextualDialog,
  videoLibraryEditor,
  videoViewportEditor,
  imageViewportEditor,
  imageLayoutRoute,
  previewUploadRoute,
  previewImportRoute,
  heroSection,
  gameMedia,
  gameCoverMedia,
  universalCard,
  publicGameDetail,
  publicationService,
  mediaIntegrity,
] = await Promise.all([
  source("src/lib/media/editorial-media-library.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
  source("src/components/admin/GameMediaUploadForm.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/components/admin/GameMultimediaEditor.module.css"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.module.css"),
  source("src/components/admin/ContextualMediaDialog.tsx"),
  source("src/components/admin/GameVideoLibraryEditor.tsx"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/components/home/HeroSection.tsx"),
  source("src/components/ui/GameMedia.tsx"),
  source("src/components/ui/GameCoverMedia.tsx"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/app/juegos/[slug]/page.tsx"),
  source("src/lib/admin/publication-service.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
]);

assert(
  has(
    library,
    "readdir",
    "lstat",
    "readFile",
    "MEDIA_FILENAME",
    "[a-f0-9]{64}",
    "MAX_EDITORIAL_IMAGE_BYTES",
    "MAX_EDITORIAL_PREVIEW_BYTES",
    "inspectSafeEditorialWebp",
    "inspectSafeEditorialWebm",
    "stats.isSymbolicLink()",
    "MAX_LIBRARY_RESOURCES"
  ),
  "La biblioteca compartida debe enumerar sólo archivos editoriales acotados, hash-nombrados, no simbólicos y revalidar WebP/WebM antes de exponerlos."
);

assert(
  has(
    library,
    "listAssignedBundledImageResources",
    "BUNDLED_IMAGE_PATTERN",
    'origin: "bundled"',
    "isContainedBy",
    "publicRoot",
    "imagesRoot",
    "mergeEditorialMediaResources"
  ),
  "Las imágenes históricas bajo /images deben poder reutilizarse por referencia segura sin duplicar bytes."
);

assert(
  has(
    library,
    "IMAGE_DELETE_MARKER",
    "markEditorialImageForDeletion",
    "deleteEditorialImageResource",
    "reconcileEditorialImageDeletions",
    "clearEditorialImageDeletionMarker",
    "resolveEditorialMediaDiskPath",
    "inspectEditorialImageFile",
    "inspection.digest !== expectedDigest",
    "stats.isSymbolicLink()",
    "unlink(",
    "writeFile(",
    'flag: "wx"'
  ),
  "La eliminación física debe quedar centralizada, revalidar ruta/hash/WebP y proteger recursos todavía publicados."
);

assert(
  has(
    libraryRoute,
    "verifyAdminSession",
    "authorizeAdminFormRequest",
    "hasExactAdminFormFields",
    "findEditorialMediaResource",
    "resourcesForGame",
    "listAssignedBundledImageResources",
    "mergeEditorialMediaResources",
    '"cover-mode"',
    '"cover-image"',
    '"cover-video"',
    '"hero-mode"',
    '"hero-image"',
    '"hero-video"',
    '"card-mode"',
    '"card-image"',
    '"card-video"',
    '"gallery-image"',
    '"gallery-remove"',
    '"image-delete"',
    "cardImage",
    "mediaModes",
    "saveGameMediaDraft"
  ) &&
    !libraryRoute.includes("card-match-hero") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn(") &&
    !libraryRoute.includes("writeFile("),
  "Asignar modos y recursos debe estar autenticado, validar referencias y mantener la escritura física fuera de la ruta de asignación."
);

assert(
  has(
    libraryRoute,
    'target.data === "gallery-remove"',
    "currentScreenshots.filter",
    "delete gallery[resource]"
  ) &&
    !libraryRoute.includes("unlink(") &&
    !libraryRoute.includes("rm("),
  "Quitar una captura de Galería debe retirar sólo su asignación/encuadre y nunca borrar el recurso físico."
);

assert(
  has(
    libraryRoute,
    'target.data === "image-delete"',
    "withoutImageResource",
    "coverImage",
    "heroImage",
    "cardImage",
    "screenshots",
    "getPublishedGameImageReferences",
    "publishedImageReferences.includes",
    "markEditorialImageForDeletion",
    "deleteEditorialImageResource",
    'imageResource.origin === "bundled"'
  ),
  "Eliminar una imagen debe retirarla de Portada, Hero, Card y Galería, respetando snapshots publicados y assets base."
);

assert(
  has(
    publicationService,
    "getPublishedGameImageReferences",
    "reconcilePublishedGameImageDeletions",
    "reconcileEditorialImageDeletions",
    "publishGameDraft"
  ) &&
    has(mediaIntegrity, "listGameImageReferences", "game.cardImage"),
  "La publicación debe completar de forma segura eliminaciones diferidas e incluir la imagen independiente de Card entre las referencias protegidas."
);

assert(
  has(
    libraryRoute,
    'target.data === "card-video"',
    'source: "independent"',
    "clip: videoResource.src",
    'requiredVideoViewport("card")',
    "previewClip: videoResource.src"
  ) &&
    !libraryRoute.includes('target.data === "card-match-hero"'),
  "Card debe asignar un WebM por referencia independiente; puede elegir el mismo archivo físico que otro destino sin acoplar sus metadatos."
);

assert(
  has(
    imageUploadRoute,
    '"library"',
    "storeEditorialWebp",
    "clearEditorialImageDeletionMarker",
    'kind.data === "library"',
    "cardImage: item.payload.cardImage",
    "recurso-subido"
  ) &&
    !imageUploadRoute.includes("withoutGameVideoTarget"),
  "Subir una imagen a biblioteca debe conservar Card y videos existentes; imagen y video pueden coexistir para Imagen + hover."
);

assert(
  has(
    imageUploadForm,
    "libraryOnly?: boolean",
    'name="kind" value="library"',
    '"recurso-subido"',
    "Preparar y guardar en biblioteca"
  ),
  "El cargador de imágenes debe poder almacenar un WebP sin asignarlo automáticamente a ningún destino."
);

for (const label of [
  "RESUMEN MULTIMEDIA",
  "Asignación de destinos",
  "Biblioteca multimedia compartida",
  "Portada del juego",
  "Hero de inicio",
  "Card del juego",
  "Imagen + hover",
  "Seleccionar recurso",
  "Agregar nuevo recurso",
  "Gestionar galería",
  "Quitar",
  "Eliminar recurso",
]) {
  assert(
    workspace.includes(label),
    `El workspace multimedia contextual debe conservar la jerarquía o acción: ${label}.`
  );
}

assert(
  has(
    workspace,
    "MODE_OPTIONS",
    '{ value: "image", label: "Imagen" }',
    '{ value: "video", label: "Video" }',
    '{ value: "hover-video", label: "Imagen + hover" }',
    "ModeSwitch",
    'target="cover"',
    'target="hero"',
    'target="card"',
    'state?.assignments.coverMode ?? "video"',
    'state?.assignments.heroMode ?? "hover-video"',
    'state?.assignments.cardMode ?? "hover-video"',
    "Recurso independiente",
    "Reutilizar sin acoplar",
    'target={`${destination}-image`}',
    'target={`${destination}-video`}'
  ) &&
    !workspace.includes("Igualar al Hero") &&
    !workspace.includes("card-match-hero"),
  "Portada, Hero y Card deben compartir los tres modos con defaults Video / Imagen+hover / Imagen+hover y asignaciones independientes."
);

assert(
  has(
    workspace,
    "ResourcePicker",
    "DeleteImageResourceForm",
    "window.confirm",
    'value="image-delete"',
    "deleteResourceButton",
    'value="gallery-remove"',
    "ContextualMediaDialog",
    "ImageViewportEditor",
    "GameVideoViewportEditor",
    "editingDestination",
    "editingLayer",
    "libraryOnly",
    "GameMediaUploadForm",
    "videoEditor"
  ),
  "Portada, Hero, Card y Galería deben compartir biblioteca/editores y distinguir Quitar de la eliminación destructiva."
);

assert(
  multimediaEditor.includes("GameMultimediaWorkspaceContextual") &&
    !multimediaEditor.includes("Opciones avanzadas · rutas manuales") &&
    !multimediaEditor.includes("Ruta de portada") &&
    !multimediaEditor.includes("screenshotsText") &&
    !multimediaEditor.includes("GameEditorFormActions"),
  "El editor principal debe usar sólo el workspace contextual, sin revivir rutas manuales obsoletas."
);

assert(
  has(multimediaCss, ".summaryGrid", ".libraryGrid", ".assignmentGrid", ".helpRail") &&
    has(contextualCss, ".pickerFooter", "position: sticky", ".pickerAddButton", ".galleryManageGrid", ".galleryRemoveButton", ".deleteResourceButton", ".deletableArtwork"),
  "El layout debe conservar resumen, destinos, biblioteca, ayuda, gestión de Galería y eliminación explícita."
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
    !contextualDialog.includes("showModal()") &&
    !contextualDialog.includes("<dialog"),
  "Los editores contextuales deben usar un overlay React robusto con Escape y bloqueo de scroll."
);

assert(
  has(
    videoLibraryEditor,
    '"X-Deuna-Preview-Target": "library"',
    'target: "library"',
    "PREVIEW_HERO_QUALITY_OPTIONS",
    "preview-direct",
    "preview-provider",
    "preview-source-upload",
    "DEFAULT_PREVIEW_VIEWPORT",
    "el fotograma completo"
  ) &&
    !videoLibraryEditor.includes("card-match-hero") &&
    !videoLibraryEditor.includes("preview-remove"),
  "Crear un video de biblioteca debe elegir fuente/tramo/calidad una vez y no administrar destinos."
);

for (const route of [previewUploadRoute, previewImportRoute]) {
  assert(
    has(
      route,
      'GameVideoTarget | "library"',
      'normalized === "cover"',
      'normalized === "library"',
      'target === "card" ? "card" : "hero"',
      "recurso-subido",
      "withSavedGameVideoClip"
    ),
    "Las rutas local y remota deben aceptar Portada y library sin asignar library automáticamente a un destino."
  );
}

assert(
  has(
    videoViewportEditor,
    'type Target = "cover" | "hero" | "card"',
    "layoutOnly",
    "preview-layout",
    "Confirmar recorte",
    "REQUIRED_DESTINATION_ASPECTS[target]"
  ) &&
    !videoViewportEditor.includes("Usar imagen estática") &&
    !videoViewportEditor.includes("preview-remove") &&
    !videoViewportEditor.includes("preview-upload") &&
    !videoViewportEditor.includes("preview-import"),
  "Editar video debe modificar sólo metadata de encuadre para Portada/Hero/Card; el cambio de modo vive en Asignación de destinos."
);

assert(
  has(
    imageViewportEditor,
    '"gallery"',
    "resource?: string",
    "image-layout",
    "viewportX",
    "viewportY",
    "viewportZoom",
    "Restablecer encuadre"
  ) &&
    !imageViewportEditor.includes("media-upload") &&
    !imageViewportEditor.includes("storeEditorialWebp"),
  "El editor de imagen debe servir a Portada/Hero/Card/Galería y guardar sólo foco/zoom como metadata."
);

assert(
  has(
    imageLayoutRoute,
    '"cover", "hero", "card", "gallery"',
    "game.cardImage",
    "galleryFields",
    "authorizeAdminFormRequest",
    "hasExactAdminFormFields",
    "parseGameImageViewport",
    "expectedRevision",
    "imageMedia"
  ) &&
    !imageLayoutRoute.includes("writeFile(") &&
    !imageLayoutRoute.includes("spawn(") &&
    !imageLayoutRoute.includes("storeEditorialWebp"),
  "La ruta de encuadre debe reconocer la imagen propia de Card y guardar sólo metadata validada."
);

assert(
  has(
    heroSection,
    "resolveGameDestinationMediaMode",
    'resolveGameDestinationMediaMode(game, "hero")',
    "game.imageMedia?.hero"
  ) &&
    has(
      gameCoverMedia,
      'resolveGameDestinationMediaMode(game, "cover")',
      "resolveGameCoverVideo",
      'mode === "video"',
      'mode === "hover-video"',
      "game.imageMedia?.cover"
    ) &&
    publicGameDetail.includes("GameCoverMedia") &&
    has(
      universalCard,
      'resolveGameDestinationMediaMode(game, "card")',
      "game.cardImage ?? game.coverImage",
      "game.imageMedia?.card"
    ) &&
    has(gameMedia, "normalizeGameImageViewport", "--game-image-zoom", "--game-image-position"),
  "La web pública debe respetar los modos independientes de Portada, Hero y Card, manteniendo fallback histórico sólo para lecturas antiguas."
);

assert(
  has(
    mediaIntegrity,
    "game.coverImage",
    "game.heroImage",
    "game.cardImage",
    "game.videoMedia?.cover?.clip",
    "game.videoMedia?.hero?.clip",
    'game.videoMedia?.card?.source === "independent"'
  ),
  "La integridad física debe incluir las imágenes y videos independientes de los tres destinos."
);

if (failures.length) {
  console.error("\nBiblioteca multimedia contextual: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Biblioteca multimedia contextual: OK (biblioteca segura → destinos independientes → modos Imagen/Video/Imagen+hover → recortes por destino → publicación y consumo público coherentes)."
);
