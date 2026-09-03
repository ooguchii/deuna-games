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
  types,
  validation,
  requirements,
  integrity,
  readiness,
  api,
  admin,
  viewport,
  publicBackground,
  publicLayout,
  multimediaEditor,
] = await Promise.all([
  source("src/types/game.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/media/game-media-requirements.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/app/api/admin/content/games/[slug]/background-media/route.ts"),
  source("src/components/admin/GameBackgroundMediaEditor.tsx"),
  source("src/components/admin/GameBackgroundViewportEditor.tsx"),
  source("src/components/games/GameDetailBackground.tsx"),
  source("src/app/juegos/[slug]/layout.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
]);

assert(
  has(
    types,
    "backgroundImage?: string",
    "background?: GameImageViewport",
    "background?: GameDestinationMediaMode",
    "export type GameBackgroundVideo",
    "background?: GameBackgroundVideo"
  ),
  "Game debe modelar imagen, modo, video y foco de Fondo sin crear un tipo de archivo paralelo."
);

assert(
  has(
    validation,
    "background: imageViewportSchema.optional()",
    "background: mediaModeSchema.optional()",
    "background: destinationVideoSchema.optional()",
    "const backgroundImage",
    "inferredOptionalMode",
    "backgroundMode"
  ),
  "La validación editorial debe preservar el Fondo opcional y mantener compatibilidad con juegos históricos."
);

assert(
  has(
    requirements,
    'GAME_BACKGROUND_VIEWPORT_ASPECT = "source"',
    "resolveGameBackgroundMediaMode",
    "backgroundMode !== null",
    "game.backgroundImage",
    "game.imageMedia?.background",
    "game.videoMedia?.background?.clip",
    "background.cropReady"
  ),
  "Fondo debe ser opcional en global, pero obligatorio de completar cuando se activa."
);

assert(
  has(
    integrity,
    "game.backgroundImage",
    "game.videoMedia?.background?.clip"
  ),
  "La integridad física debe incluir los bytes referenciados por Fondo."
);

assert(
  has(
    readiness,
    'id: "background-media"',
    "media.background.active",
    "complete: media.background.cropReady",
    'priority: "essential"'
  ),
  "Publicación debe bloquear únicamente un Fondo activo que esté incompleto."
);

assert(
  has(
    api,
    '"mode"',
    '"global"',
    '"select-image"',
    '"select-video"',
    '"layout-image"',
    '"layout-video"',
    "listEditorialMediaLibrary",
    "mergeEditorialMediaResources",
    "backgroundImage: match.src",
    "DEFAULT_GAME_IMAGE_VIEWPORT",
    "aspect: GAME_BACKGROUND_VIEWPORT_ASPECT",
    "confirmed: true",
    "clearBackgroundUpdate"
  ) &&
    !api.includes("storeEditorialWebp") &&
    !api.includes("storeEditorialPreviewVideo") &&
    !api.includes("spawn("),
  "La API de Fondo debe guardar sólo referencias/metadata y nunca copiar o recodificar al asignar destinos."
);

assert(
  has(
    admin,
    "FONDO DEL JUEGO · ADAPTABLE",
    'Imagen + hover',
    "Usar fondo global",
    "Falta seleccionar imagen",
    "Falta seleccionar video",
    "Falta ajustar el foco de la imagen",
    "Falta ajustar el foco del video",
    "Imagen base seleccionada",
    "Video hover seleccionado",
    "GameBackgroundViewportEditor"
  ),
  "El Admin debe exponer tres modos, fallback global y estados rojo/verde por capa."
);

assert(
  has(
    viewport,
    "MediaViewportEditor",
    'requiredAspect="source"',
    "PREVISUALIZACIÓN ADAPTABLE",
    "Escritorio",
    "Móvil",
    "GameMedia",
    'action: kind === "image" ? "layout-image" : "layout-video"'
  ),
  "Fondo debe reutilizar el mismo motor espacial y añadir sólo previews adaptables de salida."
);

assert(
  has(
    publicBackground,
    "resolveGameBackgroundMediaMode",
    "FINE_POINTER_MEDIA",
    "REDUCED_MOTION_MEDIA",
    "motionCapable",
    "mode === \"hover-video\"",
    "game.backgroundImage",
    "game.videoMedia?.background",
    "objectPosition",
    "autoPlay",
    "failedVideo"
  ),
  "El runtime público debe usar imagen/video por referencia, hover fino, fallback de movimiento reducido y foco adaptable."
);

assert(
  has(
    publicLayout,
    "GameDetailBackground",
    "getPublicGameBySlug",
    "children"
  ),
  "El override de Fondo debe limitarse al layout de la ficha /juegos/[slug]."
);

assert(
  multimediaEditor.includes("GameBackgroundMediaEditor") &&
    multimediaEditor.includes("<GameBackgroundMediaEditor slug={slug} />"),
  "Multimedia debe presentar el módulo Fondo junto al workspace de destinos existentes."
);

if (failures.length) {
  console.error("\nGame background media: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Game background media: OK (override opcional, bytes compartidos, foco adaptable, modos imagen/video/hover y fallback global/móvil)."
);
