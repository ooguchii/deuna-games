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
  policy,
  types,
  validation,
  imageLayout,
  videoLayout,
  mediaLibrary,
  imageEditor,
  videoEditor,
  gate,
  multimediaEditor,
  readiness,
  publishRoute,
  restoreRoute,
] = await Promise.all([
  source("src/lib/media/game-media-readiness.ts"),
  source("src/types/game.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/components/admin/RequiredMediaGate.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/app/api/admin/content/publications/[publicationId]/restore/route.ts"),
]);

assert(
  has(
    policy,
    'cover: "4:5"',
    'hero: "16:9"',
    'card: "4:5"',
    "confirmation.resource === resource",
    "confirmation.aspect === expectedAspect",
    "galleryReady = Boolean(game.screenshots?.length)",
    "pendingCount === 0"
  ),
  "La política debe exigir Portada 4:5, Hero 16:9, Card 4:5 y mínimo una imagen de Galería, invalidando confirmaciones cuando cambia el recurso."
);

assert(
  has(
    types,
    "GameMediaCropConfirmation",
    "GameMediaSetup",
    "mediaSetup?: GameMediaSetup"
  ) &&
    has(
      validation,
      "mediaCropConfirmationSchema",
      "mediaSetupSchema",
      "delete clean.mediaSetup",
      "mediaSetup ? { mediaSetup }"
    ),
  "Las confirmaciones de recorte deben formar parte del contrato editorial validado estrictamente."
);

assert(
  has(
    imageLayout,
    "REQUIRED_GAME_MEDIA_CROPS",
    "mediaCropConfirmation",
    "resolveRequiredGameMediaResource",
    "mediaSetup",
    'target.data === "gallery"'
  ),
  "Guardar un recorte de imagen debe confirmar Portada/Hero/Card sobre el recurso actual sin convertir Galería en un requisito de recorte."
);

assert(
  has(
    videoLayout,
    "REQUIRED_GAME_MEDIA_CROPS",
    "viewport.aspect !== requiredAspect",
    "mediaCropConfirmation",
    "resolveRequiredGameMediaResource",
    "mediaSetup"
  ) &&
    !videoLayout.includes("storeEditorialPreviewVideo"),
  "El recorte de video debe imponer la relación del destino, guardar sólo metadata y nunca recodificar el master."
);

assert(
  has(
    mediaLibrary,
    "evaluateGameMediaReadiness",
    "readiness: evaluateGameMediaReadiness(item.payload)",
    "sameCover",
    "sameHero"
  ),
  "La Biblioteca debe exponer el estado obligatorio y preservar el encuadre cuando se vuelve a elegir exactamente el mismo recurso."
);

assert(
  has(
    imageEditor,
    "Recorte obligatorio",
    "REQUIRED_GAME_MEDIA_CROPS",
    "aspectRatio: cssAspectRatio(target)",
    "Confirmar recorte"
  ) &&
    has(
      videoEditor,
      "REQUIRED_GAME_MEDIA_CROPS",
      "requiredAspect",
      "aspect: requiredAspect",
      "Confirmar recorte"
    ),
  "Los editores deben mostrar y fijar el formato obligatorio de cada destino antes de confirmar."
);

assert(
  has(
    gate,
    "RECORTE PENDIENTE",
    "GALERÍA PENDIENTE",
    "Portada del juego · 4:5",
    "Hero de inicio · 16:9",
    "Card del juego · 4:5",
    "Galería del juego · mínimo 1 imagen",
    "Completa Multimedia para continuar",
    "Continuar a Descargas"
  ),
  "Multimedia debe mostrar claramente cada requisito y bloquear el avance normal mientras haya pendientes."
);

assert(
  has(
    multimediaEditor,
    "destination-assignment-heading",
    "shared-library-heading",
    "order: 1",
    "order: 2",
    "RequiredMediaGate"
  ),
  "Asignación de destinos debe presentarse antes que la Biblioteca compartida, que queda al final."
);

for (const id of [
  "cover-crop",
  "hero-crop",
  "card-crop",
  "gallery-required",
]) {
  assert(
    readiness.includes(`id: "${id}"`) &&
      readiness.includes('priority: "essential"'),
    `El control ${id} debe ser esencial para publicación.`
  );
}

assert(
  has(
    publishRoute,
    "evaluateGamePublicationReadiness",
    "!readiness.essentialsReady",
    "estado=multimedia-incompleta&seccion=multimedia"
  ) &&
    has(
      restoreRoute,
      "evaluateGamePublicationReadiness",
      "!readiness.essentialsReady",
      "estado=multimedia-incompleta&seccion=multimedia"
    ),
  "Publicar y restaurar snapshots deben bloquear cualquier intento de saltarse los requisitos multimedia."
);

if (failures.length) {
  console.error("\nRecortes multimedia obligatorios: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Recortes multimedia obligatorios: OK (Portada 4:5 · Hero 16:9 · Card 4:5 · Galería mínima · avance/publicación bloqueados hasta completar)."
);