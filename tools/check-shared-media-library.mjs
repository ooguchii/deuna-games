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
  uploadRoute,
  uploadForm,
  workspace,
  multimediaEditor,
  multimediaCss,
  videoEditor,
] = await Promise.all([
  source("src/lib/media/editorial-media-library.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
  source("src/components/admin/GameMediaUploadForm.tsx"),
  source("src/components/admin/GameMultimediaWorkspace.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/components/admin/GameMultimediaEditor.module.css"),
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
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
    library.includes("MAX_LIBRARY_RESOURCES") &&
    library.includes("MAX_CACHED_INSPECTIONS") &&
    library.includes("inspectionCache") &&
    library.includes("fileSignature"),
  "La biblioteca compartida debe enumerar sólo archivos editoriales acotados, hash-nombrados y no simbólicos; puede reutilizar inspecciones sólo mientras la identidad física no cambie."
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
    libraryRoute.includes("screenshots.includes(resource)") &&
    libraryRoute.includes("saveGameMediaDraft") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn(") &&
    !libraryRoute.includes("writeFile("),
  "Asignar desde biblioteca debe estar autenticado, aceptar sólo recursos del juego ya validados y modificar metadata sin copiar ni recodificar archivos."
);

assert(
  libraryRoute.includes('source: "hero"') &&
    libraryRoute.includes('source: "independent"') &&
    libraryRoute.includes("current.videoMedia?.hero?.clip === videoResource.src") &&
    libraryRoute.includes("previewClip: hero.clip"),
  "La Card debe poder compartir exactamente el WebM del Hero o referenciar otro WebM ya existente sin duplicar bytes."
);

assert(
  uploadRoute.includes('"library"') &&
    uploadRoute.includes("storeEditorialWebp") &&
    uploadRoute.includes("withoutGameVideoTarget") &&
    uploadRoute.includes('kind.data === "hero"') &&
    uploadRoute.includes("recurso-subido"),
  "Las nuevas imágenes deben quedar físicamente en la biblioteca y asignar una imagen al Hero debe desactivar su video sin borrar el archivo almacenado."
);

assert(
  uploadForm.includes("libraryOnly?: boolean") &&
    uploadForm.includes('name="kind" value="library"') &&
    uploadForm.includes('"recurso-subido"') &&
    uploadForm.includes("Preparar y guardar en biblioteca") &&
    uploadForm.includes("no cambia Portada, Hero ni Galería"),
  "El cargador de la biblioteca debe poder almacenar un WebP sin asignarlo todavía a ningún destino."
);

for (const label of [
  "Resumen multimedia",
  "Biblioteca multimedia compartida",
  "Asignación de destinos",
  "Editor del destino seleccionado",
  "Seleccionar recurso",
  "Igualar al Hero",
  "Todo sale de la biblioteca compartida",
]) {
  assert(
    workspace.includes(label),
    `El workspace multimedia debe conservar la jerarquía y acción: ${label}.`
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
    workspace.includes('target="gallery-remove"') &&
    workspace.includes("libraryOnly") &&
    workspace.includes("IMAGEN EXISTENTE") &&
    workspace.includes("GameMediaUploadForm") &&
    workspace.includes("heroVideoEditor") &&
    workspace.includes("cardVideoEditor") &&
    workspace.includes("libraryOpen &&") &&
    !workspace.includes("Origen de la Card") &&
    !workspace.includes("Usar recurso propio") &&
    !workspace.includes('setSelectedDestination("gallery")'),
  "Portada, Hero y Card deben seleccionar desde una biblioteca única; la galería se gestiona por referencias y cada destino de video abre sólo su editor enfocado."
);

assert(
  workspace.includes('setHeroDraftMode("image")') &&
    workspace.includes('setHeroDraftMode("video")') &&
    workspace.includes('heroDraftMode === "video"') &&
    workspace.includes('"hero-video"') &&
    workspace.includes('"hero-image"') &&
    workspace.includes("Deshabilitado en modo Imagen") &&
    workspace.includes("Selecciona un recurso para aplicar el cambio de modo"),
  "El Hero debe presentar Imagen/Video como modos excluyentes y distinguir el modo guardado de una elección todavía no asignada."
);

assert(
  multimediaEditor.includes("GameMultimediaWorkspace") &&
    multimediaEditor.includes("Opciones avanzadas · rutas manuales") &&
    multimediaEditor.includes("Guardar y continuar a Distribución") &&
    !multimediaEditor.includes("Portada, hero y galería"),
  "El editor principal debe usar el workspace seccionado y conservar las rutas manuales sólo como mantenimiento avanzado."
);

assert(
  multimediaCss.includes(".summaryGrid") &&
    multimediaCss.includes(".libraryGrid") &&
    multimediaCss.includes(".assignmentGrid") &&
    multimediaCss.includes(".focusEditor") &&
    multimediaCss.includes(".helpRail") &&
    multimediaCss.includes("@media (max-width: 680px)"),
  "El nuevo layout debe separar Resumen/Biblioteca/Asignación/Editor/Ayuda y degradar correctamente en pantallas pequeñas."
);

assert(
  videoEditor.includes("0 copias extra") &&
    videoEditor.includes("focusedTarget?: VideoTarget") &&
    videoEditor.includes("Editar encuadre actual") &&
    videoEditor.includes("ENCUADRE SIN RECODIFICAR") &&
    videoEditor.includes("no se recodifica el video") &&
    videoEditor.includes("X-Deuna-Preview-Target"),
  "La biblioteca unificada no debe debilitar el editor de video compartido, su encuadre metadata-only ni el destino explícito del master."
);

if (failures.length) {
  console.error("\nBiblioteca multimedia compartida: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Biblioteca multimedia compartida: OK (almacén hash + recursos históricos → una referencia física → selección por destino → Hero excluyente → Card compartible → Galería reutilizable)."
);
