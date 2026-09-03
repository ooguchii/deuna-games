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
  mediaLibraryRoute,
  admin,
  viewport,
  publicBackground,
  publicBackgroundCss,
  publicLayout,
  multimediaEditor,
  multimediaWorkspace,
] = await Promise.all([
  source("src/types/game.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/media/game-media-requirements.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/app/api/admin/content/games/[slug]/background-media/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/GameBackgroundMediaEditor.tsx"),
  source("src/components/admin/GameBackgroundViewportEditor.tsx"),
  source("src/components/games/GameDetailBackground.tsx"),
  source("src/components/games/GameDetailBackground.module.css"),
  source("src/app/juegos/[slug]/layout.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
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
  "Game debe modelar imagen, modo, video y recorte adaptable de Fondo sin crear un tipo de archivo paralelo."
);

assert(
  has(
    validation,
    "background: fixedImageViewportSchema.optional()",
    "gallery: galleryImageMediaSchema.optional()",
    "background: mediaModeSchema.optional()",
    "background: destinationVideoSchema.optional()",
    "const backgroundImage",
    "inferredOptionalMode",
    "backgroundMode"
  ),
  "La validación editorial debe preservar el Fondo opcional con viewport fijo y reservar relaciones seleccionables para Galería."
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
    "clearBackgroundUpdate",
    "Recorte adaptable de imagen inválido",
    "Recorte adaptable de video inválido"
  ) &&
    !api.includes("storeEditorialWebp") &&
    !api.includes("storeEditorialPreviewVideo") &&
    !api.includes("spawn("),
  "La API de Fondo debe guardar sólo referencias/metadata y nunca copiar o recodificar al asignar destinos."
);

assert(
  has(
    mediaLibraryRoute,
    "resolveGameBackgroundMediaMode",
    "backgroundImage: item.payload.backgroundImage ?? null",
    "backgroundMode: resolveGameBackgroundMediaMode(item.payload)",
    "backgroundVideo: item.payload.videoMedia?.background ?? null",
    'Partial<Pick<Game, "backgroundImage" | "cardImage" | "detailImage" | "mediaModes">>',
    "game.backgroundImage === resource",
    "delete imageMedia.background",
    "backgroundImage:"
  ),
  "La Biblioteca compartida debe exponer Fondo y limpiar su asignación/recorte al eliminar una imagen, sin dejar referencias fantasma."
);

assert(
  has(
    admin,
    "Fondo del juego",
    "Opcional · recorte adaptable",
    "Imagen + hover",
    "Usar fondo global",
    "Falta seleccionar imagen",
    "Falta seleccionar video",
    "Recorte adaptable ·",
    'complete ? "confirmado" : "no confirmado"',
    "RECORTE ADAPTABLE CONFIRMADO",
    "RECORTE ADAPTABLE NO CONFIRMADO",
    "Imagen base seleccionada",
    "Video hover seleccionado",
    "GameBackgroundViewportEditor",
    "assignmentStyles.assignmentCard",
    "assignmentStyles.modeSwitch",
    "assignmentStyles.currentResource",
    "assignmentStyles.assignmentActions",
    "revision: number",
    "resources: LibraryResource[]",
    "assignment: BackgroundAssignment"
  ) &&
    !admin.includes("Falta ajustar el foco de la imagen") &&
    !admin.includes("Foco adaptable de imagen confirmado") &&
    !admin.includes("useEffect(") &&
    !admin.includes('fetch(endpoint, {\n          credentials: "same-origin"'),
  "Fondo debe verse como un destino más, usar terminología de recorte y reutilizar revisión/recursos del workspace sin una segunda lectura de biblioteca."
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
    "Un recorte, distintas pantallas",
    "Confirmar recorte adaptable",
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
    "game?.videoMedia?.background",
    "mediaStyle(",
    '"--game-background-position"',
    '"--game-background-zoom"',
    "autoPlay",
    "failedVideo"
  ) &&
    has(
      publicBackgroundCss,
      "object-position: var(--game-background-position, 50% 50%)",
      "transform-origin: var(--game-background-position, 50% 50%)",
      "transform: scale(var(--game-background-zoom, 1))"
    ),
  "El runtime público debe usar imagen/video por referencia, hover fino, fallback de movimiento reducido y aplicar X/Y/zoom adaptables en el fondo."
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
  multimediaEditor.includes("GameMultimediaWorkspaceContextual") &&
    !multimediaEditor.includes("GameBackgroundMediaEditor") &&
    has(
      multimediaWorkspace,
      'import GameBackgroundMediaEditor from "@/components/admin/GameBackgroundMediaEditor"',
      'import GameDetailMediaEditor from "@/components/admin/GameDetailMediaEditor"',
      "backgroundImage: string | null",
      "backgroundMode: GameDestinationMediaMode | null",
      "backgroundVideo: GameBackgroundVideo | null",
      "const backgroundReady = backgroundMode === null || cropReady(",
      "mandatoryRequirementsReady && backgroundReady",
      'labels.push(backgroundMode === "hover-video" ? "Fondo base" : "Fondo")',
      'labels.push(backgroundMode === "hover-video" ? "Fondo hover" : "Fondo")',
      "<GameBackgroundMediaEditor",
      "<GameDetailMediaEditor",
      "<span>F</span><h3>Galería del juego</h3>",
      "Fondo · adaptable"
    ),
  "Multimedia debe ordenar Portada → Hero → Card → Fondo → Contenedor → Galería en un único workspace y alinear gate/Biblioteca con el estado real de Fondo."
);

if (failures.length) {
  console.error("\nGame background media: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Game background media: OK (Fondo integrado en destinos, estado/biblioteca únicos, override opcional, bytes compartidos y recorte adaptable)."
);
