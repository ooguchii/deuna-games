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
  workspace,
  workspaceCss,
  imageEditor,
  imageLayoutRoute,
  mediaLibraryRoute,
  videoLayoutRoute,
  videoMedia,
  publicationReadiness,
  types,
] = await Promise.all([
  source("src/lib/media/game-media-requirements.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.module.css"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/types/game.ts"),
]);

assert(
  has(
    requirements,
    'cover: "4:5"',
    'hero: "16:9"',
    'card: "3:2"',
    "viewport?.confirmed === true",
    "game.screenshots?.length",
    "coverCropReady && heroCropReady && cardCropReady && galleryReady"
  ),
  "Los requisitos multimedia deben fijar Portada 4:5, Hero 16:9, Card 3:2 y Galería mínima 1 con confirmación explícita."
);

assert(
  types.includes("confirmed?: true") && types.includes('| "3:2"'),
  "Los tipos deben distinguir un viewport asignado de un recorte confirmado y admitir 3:2 para Card."
);

const assignmentIndex = workspace.indexOf("Asignación de destinos");
const libraryIndex = workspace.indexOf("Biblioteca multimedia compartida");
assert(
  assignmentIndex >= 0 && libraryIndex > assignmentIndex,
  "Asignación de destinos debe aparecer antes que la Biblioteca multimedia compartida."
);

assert(
  has(
    workspace,
    "RECORTE PENDIENTE",
    "RECORTE CONFIRMADO",
    "Recortar 4:5",
    "Recortar 16:9",
    "Recortar 3:2",
    "IMAGEN REQUERIDA · MÍNIMO 1",
    "Continuar a Descargas",
    "allRequirementsReady"
  ),
  "El workspace debe mostrar estados obligatorios y bloquear el avance mientras falte un requisito."
);

assert(
  workspace.includes('heroDraftMode === "hover-video"') &&
    workspace.includes("heroImageCropReady && heroVideoCropReady") &&
    workspace.includes("Recortar imagen 16:9") &&
    workspace.includes("Recortar video 16:9"),
  "Imagen + hover debe exigir recorte 16:9 independiente para la imagen y el video."
);

const galleryRendererStart = workspace.indexOf("function renderGalleryAssignedItems");
const workspaceReturn = workspace.indexOf("\n  return (", galleryRendererStart);
const galleryRenderer = galleryRendererStart >= 0 && workspaceReturn > galleryRendererStart
  ? workspace.slice(galleryRendererStart, workspaceReturn)
  : "";
assert(
  galleryRenderer.includes('value="gallery-remove"') &&
    galleryRenderer.includes("Editar") &&
    !galleryRenderer.includes("DeleteImageResourceForm") &&
    !galleryRenderer.includes('value="image-delete"'),
  "Galería debe permitir sólo Editar/Quitar; la eliminación destructiva no debe renderizarse dentro de sus capturas."
);

assert(
  workspace.includes("<DeleteImageResourceForm") &&
    libraryIndex >= 0 &&
    workspace.indexOf("<DeleteImageResourceForm", libraryIndex) > libraryIndex,
  "La eliminación destructiva debe permanecer disponible en la Biblioteca compartida."
);

assert(
  has(
    mediaLibraryRoute,
    "requiredVideoViewport",
    'REQUIRED_DESTINATION_ASPECTS[target]',
    'target.data === "cover-image"',
    'target.data === "hero-video"',
    'target.data === "card-video"'
  ) &&
    !mediaLibraryRoute.includes("confirmed: true"),
  "Asignar/cambiar un recurso debe crear un viewport pendiente, nunca marcar el recorte como confirmado automáticamente."
);

assert(
  imageLayoutRoute.includes("confirmed: true") &&
    imageLayoutRoute.includes("saveGameMediaDraft") &&
    !imageLayoutRoute.includes("storeEditorialWebp") &&
    !imageLayoutRoute.includes("FFmpeg"),
  "Guardar un recorte de imagen debe confirmar sólo metadata y no modificar/copiar el archivo físico."
);

assert(
  has(
    videoLayoutRoute,
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "submittedAspect !== requiredAspect",
    "withGameVideoLayout"
  ) &&
    !videoLayoutRoute.includes("storeEditorialPreviewVideo") &&
    !videoLayoutRoute.includes("FFmpeg"),
  "Hero/Card video deben validar su relación obligatoria en servidor y guardar el recorte sin recodificar."
);

assert(
  videoMedia.includes("confirmed: true") &&
    videoMedia.includes("withGameVideoLayout") &&
    videoMedia.includes("normalizeGameVideoViewport"),
  "Confirmar un layout de video debe persistir explícitamente su estado de recorte confirmado."
);

assert(
  has(
    imageEditor,
    "RECORTE REQUERIDO",
    "Confirmar recorte",
    'css: "4 / 5"',
    'css: "16 / 9"',
    'css: "3 / 2"'
  ),
  "El editor de imagen debe mostrar el marco real requerido para Portada/Hero/Card."
);

for (const id of ["cover-crop", "hero-crop", "card-crop", "gallery-minimum"]) {
  assert(publicationReadiness.includes(`id: "${id}"`), `Publicación debe exigir ${id}.`);
}
assert(
  publicationReadiness.match(/priority: "essential"/g)?.length >= 5,
  "Los cuatro requisitos multimedia deben ser esenciales junto con la ficha principal."
);

assert(
  has(workspaceCss, ".requirementPending", ".continueGate", ".continueButton"),
  "Los estados pendientes y el bloqueo de avance deben tener estilos explícitos."
);

if (failures.length) {
  console.error("\nDestinos multimedia obligatorios: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Destinos multimedia obligatorios: OK (Portada 4:5 + Hero 16:9 + Card 3:2 + Galería mínima 1 + avance/publicación bloqueados hasta confirmar)."
);