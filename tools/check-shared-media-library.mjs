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
  workspace,
  multimediaEditor,
  multimediaCss,
  videoEditor,
] = await Promise.all([
  source("src/lib/media/editorial-media-library.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
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
    library.includes("MAX_LIBRARY_RESOURCES"),
  "La biblioteca compartida debe enumerar sólo archivos editoriales acotados, hash-nombrados, no simbólicos y volver a validar WebP/WebM antes de exponerlos."
);

assert(
  libraryRoute.includes("verifyAdminSession") &&
    libraryRoute.includes("authorizeAdminFormRequest") &&
    libraryRoute.includes("hasExactAdminFormFields") &&
    libraryRoute.includes("findEditorialMediaResource") &&
    libraryRoute.includes('"cover-image"') &&
    libraryRoute.includes('"hero-image"') &&
    libraryRoute.includes('"hero-video"') &&
    libraryRoute.includes('"card-video"') &&
    libraryRoute.includes('"card-match-hero"') &&
    libraryRoute.includes('"gallery-image"') &&
    libraryRoute.includes("saveGameMediaDraft") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn(") &&
    !libraryRoute.includes("writeFile("),
  "Asignar desde biblioteca debe estar autenticado, usar campos exactos y modificar sólo metadata sin copiar ni recodificar archivos."
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

for (const label of [
  "RESUMEN MULTIMEDIA",
  "Biblioteca multimedia compartida",
  "Asignación de destinos",
  "Editor del destino seleccionado",
  "Seleccionar recurso",
  "Igualar al Hero",
  "Todo sale de la biblioteca compartida",
]) {
  assert(workspace.includes(label), `El workspace multimedia debe conservar la jerarquía y acción: ${label}.`);
}

assert(
  workspace.includes("ResourcePicker") &&
    workspace.includes("heroDraftMode") &&
    workspace.includes('target="cover-image"') &&
    workspace.includes('target="card-video"') &&
    workspace.includes('target="card-match-hero"') &&
    workspace.includes("GameMediaUploadForm") &&
    workspace.includes("videoEditor") &&
    !workspace.includes("Origen de la Card") &&
    !workspace.includes("Usar recurso propio"),
  "Portada, Hero y Card deben seleccionar desde una biblioteca única; la Card no debe volver al selector redundante de orígenes."
);

assert(
  workspace.includes('setHeroDraftMode("image")') &&
    workspace.includes('setHeroDraftMode("video")') &&
    workspace.includes('target={heroDraftMode === "video" ? "hero-video" : "hero-image"}') &&
    workspace.includes("Deshabilitado en modo Imagen"),
  "El Hero debe presentar Imagen/Video como modos excluyentes y mantener el editor de video fuera del modo Imagen."
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
  "Biblioteca multimedia compartida: OK (almacén hash validado → una copia física → selección por destino → Hero excluyente → Card compartible → editor focalizado)."
);
