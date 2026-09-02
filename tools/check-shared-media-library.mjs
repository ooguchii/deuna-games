import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

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
  universalCard,
  publicGameDetail,
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
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/app/juegos/[slug]/page.tsx"),
]);

assert(
  library.includes("readdir") &&
    library.includes("lstat") &&
    library.includes("readFile") &&
    library.includes("MEDIA_FILENAME") &&
    library.includes("[a-f0-9]{64}") &&
    library.includes("MAX_EDITORIAL_IMAGE_BYTES") &&
    library.includes("MAX_EDITORIAL_PREVIEW_BYTES") &&
    library.includes("inspectSafeEditorialWebp") &&
    library.includes("inspectSafeEditorialWebm") &&
    library.includes("stats.isSymbolicLink()") &&
    library.includes("MAX_LIBRARY_RESOURCES"),
  "La biblioteca compartida debe enumerar sólo archivos editoriales acotados, hash-nombrados, no simbólicos y volver a validar WebP/WebM antes de exponerlos."
);

assert(
  library.includes("listAssignedBundledImageResources") &&
    library.includes("BUNDLED_IMAGE_PATTERN") &&
    library.includes('origin: "bundled"') &&
    library.includes("isContainedBy") &&
    library.includes("publicRoot") &&
    library.includes("imagesRoot") &&
    library.includes("mergeEditorialMediaResources"),
  "Las imágenes históricas ya asignadas bajo /images deben poder entrar en la biblioteca por referencia segura, sin copiarlas al almacén editorial."
);

assert(
  libraryRoute.includes("verifyAdminSession") &&
    libraryRoute.includes("authorizeAdminFormRequest") &&
    libraryRoute.includes("hasExactAdminFormFields") &&
    libraryRoute.includes("findEditorialMediaResource") &&
    libraryRoute.includes("resourcesForGame") &&
    libraryRoute.includes("listAssignedBundledImageResources") &&
    libraryRoute.includes("mergeEditorialMediaResources") &&
    libraryRoute.includes('"cover-image"') &&
    libraryRoute.includes('"hero-image"') &&
    libraryRoute.includes('"hero-video"') &&
    libraryRoute.includes('"card-video"') &&
    libraryRoute.includes('"card-match-hero"') &&
    libraryRoute.includes('"gallery-image"') &&
    libraryRoute.includes('"gallery-remove"') &&
    libraryRoute.includes("imageMedia") &&
    libraryRoute.includes("saveGameMediaDraft") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn(") &&
    !libraryRoute.includes("writeFile("),
  "Asignar o quitar desde biblioteca debe estar autenticado, aceptar sólo referencias válidas y modificar metadata sin copiar ni recodificar archivos."
);

assert(
  libraryRoute.includes('target.data === "gallery-remove"') &&
    libraryRoute.includes("currentScreenshots.filter") &&
    libraryRoute.includes("delete gallery[resource]") &&
    !libraryRoute.includes("unlink(") &&
    !libraryRoute.includes("rm("),
  "Quitar una captura de Galería debe eliminar sólo su asignación/encuadre y nunca borrar el recurso físico de la biblioteca."
);

assert(
  libraryRoute.includes('source: "hero"') &&
    libraryRoute.includes('source: "independent"') &&
    libraryRoute.includes("current.videoMedia?.hero?.clip === videoResource.src") &&
    libraryRoute.includes("previewClip: hero.clip"),
  "La Card debe poder compartir exactamente el WebM del Hero o referenciar otro WebM existente sin duplicar bytes."
);

assert(
  imageUploadRoute.includes('"library"') &&
    imageUploadRoute.includes("storeEditorialWebp") &&
    imageUploadRoute.includes("withoutGameVideoTarget") &&
    imageUploadRoute.includes('kind.data === "hero"') &&
    imageUploadRoute.includes("recurso-subido"),
  "Las nuevas imágenes deben quedar físicamente en la biblioteca y asignar una imagen al Hero debe desactivar su video sin borrar el archivo almacenado."
);

assert(
  imageUploadForm.includes("libraryOnly?: boolean") &&
    imageUploadForm.includes('name="kind" value="library"') &&
    imageUploadForm.includes('"recurso-subido"') &&
    imageUploadForm.includes("Preparar y guardar en biblioteca") &&
    imageUploadForm.includes("no cambia Portada, Hero ni Galería"),
  "El cargador de imágenes debe poder almacenar un WebP sin asignarlo todavía a ningún destino."
);

for (const label of [
  "RESUMEN MULTIMEDIA",
  "Biblioteca multimedia compartida",
  "Asignación de destinos",
  "Seleccionar recurso",
  "Editar destino",
  "Igualar al Hero",
  "Agregar nuevo recurso",
  "Gestionar galería",
  "Quitar",
]) {
  assert(
    workspace.includes(label),
    `El workspace multimedia contextual debe conservar la jerarquía y acción: ${label}.`
  );
}

assert(
  workspace.includes("ResourcePicker") &&
    workspace.includes("heroDraftMode") &&
    workspace.includes("currentHeroMode") &&
    workspace.includes("heroModePending") &&
    workspace.includes('target="cover-image"') &&
    workspace.includes('target="card-video"') &&
    workspace.includes('target="card-match-hero"') &&
    workspace.includes('target="gallery-image"') &&
    workspace.includes('value="gallery-remove"') &&
    workspace.includes("editingGalleryImage") &&
    workspace.includes("galleryManagerOpen") &&
    workspace.includes('target="gallery"') &&
    workspace.includes("ContextualMediaDialog") &&
    workspace.includes("ImageViewportEditor") &&
    workspace.includes("GameVideoViewportEditor") &&
    workspace.includes("editingDestination") &&
    workspace.includes("libraryOnly") &&
    workspace.includes("GameMediaUploadForm") &&
    workspace.includes("videoEditor") &&
    !workspace.includes("Editor del destino seleccionado") &&
    !workspace.includes("Origen de la Card") &&
    !workspace.includes("Usar recurso propio"),
  "Portada, Hero, Card y Galería deben seleccionar desde una biblioteca única y abrir editores sólo de forma contextual, con gestión real de capturas."
);

assert(
  workspace.includes('setHeroDraftMode("image")') &&
    workspace.includes('setHeroDraftMode("video")') &&
    workspace.includes('heroDraftMode === "video"') &&
    workspace.includes('"hero-video"') &&
    workspace.includes('"hero-image"'),
  "El Hero debe conservar Imagen/Video como modos excluyentes y aplicar el cambio al seleccionar un recurso."
);

assert(
  multimediaEditor.includes("GameMultimediaWorkspaceContextual") &&
    !multimediaEditor.includes("Opciones avanzadas · rutas manuales") &&
    !multimediaEditor.includes("Ruta de portada") &&
    !multimediaEditor.includes("screenshotsText") &&
    !multimediaEditor.includes("GameEditorFormActions"),
  "El editor principal debe usar sólo el workspace contextual; las rutas manuales y su barra de guardado ya no deben formar parte de Multimedia."
);

assert(
  multimediaCss.includes(".summaryGrid") &&
    multimediaCss.includes(".libraryGrid") &&
    multimediaCss.includes(".assignmentGrid") &&
    multimediaCss.includes(".helpRail") &&
    multimediaCss.includes("@media (max-width: 680px)") &&
    !multimediaCss.includes(".advancedForm") &&
    !multimediaCss.includes(".advancedDetails") &&
    !multimediaCss.includes(".advancedFields") &&
    contextualCss.includes(".pickerFooter") &&
    contextualCss.includes("position: sticky") &&
    contextualCss.includes(".pickerAddButton") &&
    contextualCss.includes(".galleryManageGrid") &&
    contextualCss.includes(".galleryRemoveButton"),
  "El layout debe separar Biblioteca/Asignación/Ayuda, quitar CSS manual obsoleto y soportar gestión contextual de Galería."
);

assert(
  contextualDialog.includes("createPortal") &&
    contextualDialog.includes("document.body") &&
    contextualDialog.includes('event.key === "Escape"') &&
    contextualDialog.includes('aria-modal="true"') &&
    contextualDialog.includes('document.body.style.overflow = "hidden"') &&
    !contextualDialog.includes("showModal()") &&
    !contextualDialog.includes("<dialog"),
  "Editar destino debe usar un overlay React robusto con Escape, foco y bloqueo de scroll, sin depender del <dialog> nativo."
);

assert(
  videoLibraryEditor.includes('"X-Deuna-Preview-Target": "library"') &&
    videoLibraryEditor.includes('target: "library"') &&
    videoLibraryEditor.includes("PREVIEW_HERO_QUALITY_OPTIONS") &&
    videoLibraryEditor.includes("preview-direct") &&
    videoLibraryEditor.includes("preview-provider") &&
    videoLibraryEditor.includes("preview-source-upload") &&
    videoLibraryEditor.includes("DEFAULT_PREVIEW_VIEWPORT") &&
    videoLibraryEditor.includes("el fotograma completo") &&
    !videoLibraryEditor.includes("card-match-hero") &&
    !videoLibraryEditor.includes("preview-remove"),
  "Crear un video de biblioteca debe elegir fuente/tramo/calidad una vez, conservar el fotograma completo y no administrar destinos."
);

assert(
  previewUploadRoute.includes('GameVideoTarget | "library"') &&
    previewUploadRoute.includes('normalized === "library"') &&
    previewUploadRoute.includes('target === "library" ? "hero" : target') &&
    previewUploadRoute.includes("recurso-subido") &&
    previewImportRoute.includes('GameVideoTarget | "library"') &&
    previewImportRoute.includes('normalized === "library"') &&
    previewImportRoute.includes('target === "library" ? "hero" : target') &&
    previewImportRoute.includes("recurso-subido"),
  "Las rutas local y remota deben aceptar library como destino de almacenamiento sin asignar automáticamente Hero o Card."
);

assert(
  videoViewportEditor.includes("layoutOnly") &&
    videoViewportEditor.includes("preview-layout") &&
    videoViewportEditor.includes("Guardar encuadre") &&
    videoViewportEditor.includes("Usar imagen estática") &&
    videoViewportEditor.includes("preview-remove") &&
    !videoViewportEditor.includes("preview-upload") &&
    !videoViewportEditor.includes("preview-import"),
  "Editar un destino de video debe modificar sólo metadata de encuadre; la Card puede volver a imagen sin borrar el WebM de biblioteca."
);

assert(
  imageViewportEditor.includes('"gallery"') &&
    imageViewportEditor.includes("resource?: string") &&
    imageViewportEditor.includes("image-layout") &&
    imageViewportEditor.includes("viewportX") &&
    imageViewportEditor.includes("viewportY") &&
    imageViewportEditor.includes("viewportZoom") &&
    imageViewportEditor.includes("Restablecer encuadre") &&
    !imageViewportEditor.includes("media-upload") &&
    !imageViewportEditor.includes("storeEditorialWebp"),
  "El mismo editor de imagen debe servir a Portada/Hero/Card/Galería y guardar sólo foco/zoom como metadata."
);

assert(
  imageLayoutRoute.includes('"gallery"') &&
    imageLayoutRoute.includes("galleryFields") &&
    imageLayoutRoute.includes("authorizeAdminFormRequest") &&
    imageLayoutRoute.includes("hasExactAdminFormFields") &&
    imageLayoutRoute.includes("parseGameImageViewport") &&
    imageLayoutRoute.includes("expectedRevision") &&
    imageLayoutRoute.includes("imageMedia") &&
    imageLayoutRoute.includes("screenshots") &&
    !imageLayoutRoute.includes("writeFile(") &&
    !imageLayoutRoute.includes("spawn(") &&
    !imageLayoutRoute.includes("storeEditorialWebp"),
  "La ruta de encuadre debe validar sesión, campos, revisión y pertenencia de la captura sin tocar bytes físicos."
);

assert(
  heroSection.includes("game.imageMedia?.hero") &&
    gameMedia.includes("normalizeGameImageViewport") &&
    gameMedia.includes("--game-image-zoom") &&
    gameMedia.includes("--game-image-position") &&
    universalCard.includes("game.imageMedia?.card ?? game.imageMedia?.cover") &&
    publicGameDetail.includes("game.imageMedia?.cover") &&
    publicGameDetail.includes("game.imageMedia?.gallery?.[image]"),
  "Los encuadres guardados deben llegar al Hero, Portada, Cards y Galería públicas, con fallback compatible para juegos antiguos."
);

if (failures.length) {
  console.error("\nBiblioteca multimedia contextual: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Biblioteca multimedia contextual: OK (biblioteca única → asignación segura → editores contextuales robustos → Galería editable/quitable sin borrar archivos → framing público)."
);
