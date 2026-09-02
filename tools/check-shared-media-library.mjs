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
  videoLibraryEditor,
  videoViewportEditor,
  imageViewportEditor,
  imageLayoutRoute,
  previewUploadRoute,
  previewImportRoute,
  heroSection,
  gameMedia,
  universalCard,
] = await Promise.all([
  source("src/lib/media/editorial-media-library.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
  source("src/components/admin/GameMediaUploadForm.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/components/admin/GameMultimediaEditor.module.css"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.module.css"),
  source("src/components/admin/GameVideoLibraryEditor.tsx"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/components/home/HeroSection.tsx"),
  source("src/components/ui/GameMedia.tsx"),
  source("src/components/ui/UniversalGameCard.tsx"),
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
    libraryRoute.includes("imageMedia") &&
    libraryRoute.includes("saveGameMediaDraft") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn(") &&
    !libraryRoute.includes("writeFile("),
  "Asignar desde biblioteca debe estar autenticado, aceptar sólo recursos ya validados y modificar referencias/metadata sin copiar ni recodificar archivos."
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
    workspace.includes("ContextualMediaDialog") &&
    workspace.includes("ImageViewportEditor") &&
    workspace.includes("GameVideoViewportEditor") &&
    workspace.includes("editingDestination") &&
    workspace.includes("setAddResourceKind") &&
    workspace.includes("libraryOnly") &&
    workspace.includes("GameMediaUploadForm") &&
    workspace.includes("videoEditor") &&
    !workspace.includes("Editor del destino seleccionado") &&
    !workspace.includes("Origen de la Card") &&
    !workspace.includes("Usar recurso propio"),
  "Portada, Hero, Card y Galería deben seleccionar desde una biblioteca única y abrir editores sólo de forma contextual, sin restaurar el editor permanente antiguo."
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
    multimediaEditor.includes("Opciones avanzadas · rutas manuales") &&
    multimediaEditor.includes("Guardar y continuar a Distribución") &&
    !multimediaEditor.includes("GameMultimediaWorkspace\n"),
  "El editor principal debe usar el workspace contextual y conservar las rutas manuales sólo como mantenimiento avanzado."
);

assert(
  multimediaCss.includes(".summaryGrid") &&
    multimediaCss.includes(".libraryGrid") &&
    multimediaCss.includes(".assignmentGrid") &&
    multimediaCss.includes(".helpRail") &&
    multimediaCss.includes("@media (max-width: 680px)") &&
    contextualCss.includes(".pickerFooter") &&
    contextualCss.includes("position: sticky") &&
    contextualCss.includes(".pickerAddButton"),
  "El layout debe separar Resumen/Biblioteca/Asignación/Ayuda y mantener visible la acción de agregar recurso dentro del selector."
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
  imageViewportEditor.includes("image-layout") &&
    imageViewportEditor.includes("viewportX") &&
    imageViewportEditor.includes("viewportY") &&
    imageViewportEditor.includes("viewportZoom") &&
    imageViewportEditor.includes("Restablecer encuadre") &&
    !imageViewportEditor.includes("media-upload") &&
    !imageViewportEditor.includes("storeEditorialWebp"),
  "Editar un destino de imagen debe guardar foco/zoom como metadata y nunca volver a subir ni recodificar la imagen."
);

assert(
  imageLayoutRoute.includes("authorizeAdminFormRequest") &&
    imageLayoutRoute.includes("hasExactAdminFormFields") &&
    imageLayoutRoute.includes("parseGameImageViewport") &&
    imageLayoutRoute.includes("expectedRevision") &&
    imageLayoutRoute.includes("imageMedia") &&
    !imageLayoutRoute.includes("writeFile(") &&
    !imageLayoutRoute.includes("spawn(") &&
    !imageLayoutRoute.includes("storeEditorialWebp"),
  "La ruta de encuadre de imagen debe validar sesión, campos, revisión y límites sin tocar los bytes físicos."
);

assert(
  heroSection.includes("game.imageMedia?.hero") &&
    gameMedia.includes("normalizeGameImageViewport") &&
    gameMedia.includes("--game-image-zoom") &&
    gameMedia.includes("--game-image-position") &&
    universalCard.includes("game.imageMedia?.card ?? game.imageMedia?.cover"),
  "Los encuadres guardados deben llegar al Hero, a GameMedia y a las Cards públicas, con fallback compatible para juegos antiguos."
);

if (failures.length) {
  console.error("\nBiblioteca multimedia contextual: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Biblioteca multimedia contextual: OK (almacén validado → recurso único → asignación por destino → editores contextuales metadata-only → master de video completo reutilizable)."
);
