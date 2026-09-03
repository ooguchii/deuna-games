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
  safeWebm,
  providers,
  libraryEditor,
  trimEditor,
  mediaViewportEditor,
  workspace,
  libraryRoute,
  viewportEditor,
  cardResolver,
  card,
  hoverPreview,
  framedVideo,
  videoMedia,
  validation,
  importRoute,
  uploadRoute,
  layoutRoute,
  integrity,
] = await Promise.all([
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/safe-webm.ts"),
  source("src/lib/media/preview-providers.ts"),
  source("src/components/admin/GameVideoLibraryEditor.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/components/admin/MediaViewportEditor.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/FramedVideo.tsx"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
]);

assert(
  has(
    policy,
    "MAX_PREVIEW_DURATION_SECONDS = 30",
    "MAX_PREVIEW_SOURCE_BYTES",
    "DEFAULT_PREVIEW_QUALITY",
    "DEFAULT_PREVIEW_FPS",
    "MAX_PREVIEW_FPS",
    '"720p"',
    '"1080p"',
    '"3:2"',
    "MAX_PREVIEW_VIEWPORT_ZOOM"
  ),
  "La política de video debe conservar límites de duración/tamaño, 720p/1080p, FPS acotados y viewport 3:2."
);

assert(
  has(safeWebm, "MAX_EDITORIAL_PREVIEW_BYTES", "inspectSafeEditorialWebm", "digest"),
  "Los masters WebM editoriales deben seguir pasando por validación segura y hash."
);

assert(
  has(
    providers,
    "PREVIEW_PROVIDER_IDS",
    "parsePreviewProviderUrl",
    '"youtube"',
    '"facebook"',
    '"instagram"',
    '"tiktok"',
    '"vimeo"'
  ),
  "La importación externa debe conservar un catálogo explícito de proveedores y validación por URL."
);

assert(
  has(
    libraryEditor,
    '"X-Deuna-Preview-Target": "library"',
    'target: "library"',
    "VideoTrimEditor",
    "PREVIEW_FPS_OPTIONS",
    '"X-Deuna-Preview-Fps"',
    "DEFAULT_PREVIEW_FPS",
    '"X-Deuna-Viewport-X": String(DEFAULT_PREVIEW_VIEWPORT.x)',
    'viewportAspect: DEFAULT_PREVIEW_VIEWPORT.aspect'
  ),
  "La biblioteca debe crear un master reutilizable una sola vez, con fotograma completo y resolución/FPS explícitos, sin asignarlo automáticamente a Card."
);

assert(
  has(
    trimEditor,
    "requestAnimationFrame",
    "scheduleDrag",
    "parsePreviewTrimWindow",
    "Marcar IN aquí",
    "Marcar OUT aquí",
    "Resolución del master",
    "fotograma completo",
    "sólo define el tramo temporal"
  ) &&
    !trimEditor.includes("scheduleViewportDraft") &&
    !trimEditor.includes("viewportMoveHandle") &&
    !trimEditor.includes("resultCanvasRef") &&
    !trimEditor.includes("resolvePreviewViewportCrop"),
  "El editor de creación del master debe limitarse a IN/OUT y calidad; no puede mantener un segundo motor de encuadre espacial."
);

assert(
  has(
    mediaViewportEditor,
    'type MediaKind = "image" | "video"',
    "resolvePreviewViewportCrop",
    "viewportFrame",
    "viewportMoveHandle",
    "scheduleViewportDraft",
    "resultCanvasRef",
    "requiredAspect",
    "Resultado final"
  ),
  "El encuadre espacial de imagen y video debe vivir en un único MediaViewportEditor."
);

assert(
  has(
    workspace,
    "MODE_OPTIONS",
    '{ value: "image", label: "Imagen" }',
    '{ value: "video", label: "Video" }',
    '{ value: "hover-video", label: "Imagen + hover" }',
    'const cardMode = state?.assignments.cardMode ?? "hover-video"',
    "const cardImage = state?.assignments.cardImage ?? null",
    'target="card"',
    'destinationActions("card", cardMode',
    "Recurso independiente",
    "GameVideoViewportEditor"
  ) &&
    !workspace.includes("Igualar al Hero") &&
    !workspace.includes("card-match-hero"),
  "Card debe tener imagen, modo y edición propios; no puede conservar el control Igualar al Hero."
);

assert(
  has(
    libraryRoute,
    '"card-mode"',
    '"card-image"',
    '"card-video"',
    'target.data === "card-video"',
    'source: "independent"',
    "clip: videoResource.src",
    'requiredVideoViewport("card")',
    "previewClip: videoResource.src",
    "mediaModeUpdate"
  ) &&
    !libraryRoute.includes("card-match-hero"),
  "Asignar Card desde biblioteca debe crear una referencia independiente al WebM elegido, aunque el archivo físico coincida con Hero."
);

assert(
  has(
    viewportEditor,
    "MediaViewportEditor",
    'kind="video"',
    'type Target = "cover" | "hero" | "card"',
    "preview-layout",
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "Confirmar recorte"
  ) &&
    !viewportEditor.includes("VideoTrimEditor") &&
    !viewportEditor.includes("preview-import") &&
    !viewportEditor.includes("preview-upload") &&
    !viewportEditor.includes("preview-remove") &&
    !viewportEditor.includes("Usar imagen estática"),
  "Editar Card video debe delegar el viewport 3:2 al motor común y persistir sólo metadata; el modo vive en Asignación de destinos."
);

assert(
  has(
    videoMedia,
    'export type GameVideoTarget = "cover" | "hero" | "card"',
    "resolveGameCardVideo",
    'card?.source === "hero"',
    'card?.source === "independent"',
    'source: "independent"',
    "withGameVideoLayout",
    "withoutGameVideoTarget"
  ),
  "El resolver debe mantener compatibilidad histórica con Card→Hero pero las nuevas Cards deben persistir referencia y viewport independientes."
);

assert(
  has(
    validation,
    "const cardVideoSchema = z.union",
    'source: z.literal("hero")',
    'source: z.literal("independent")',
    'playback: z.enum(["always", "hover"]).optional()',
    "cardImage",
    "mediaModes"
  ),
  "La validación debe aceptar snapshots antiguos y el nuevo contrato Card independiente con playback explícito."
);

assert(
  has(
    cardResolver,
    'resolveGameDestinationMediaMode(game, "card") === "image"',
    "resolveGameCardVideo",
    'kind: "webm"',
    "viewport: resolved.viewport"
  ),
  "El resolver público de Card debe omitir video en modo Imagen y devolver sólo WebM interno con su viewport."
);

assert(
  has(
    card,
    'resolveGameDestinationMediaMode(game, "card")',
    "const resolvedPreview = resolveGameCardPreview(game)",
    "const cardImage = game.cardImage ?? game.coverImage",
    "const imageViewport = game.imageMedia?.card",
    'const videoAlwaysActive = cardMode === "video"',
    'const hoverPreviewEnabled = cardMode === "hover-video"',
    "PREVIEW_DELAY_MS"
  ),
  "UniversalGameCard debe consumir cardImage propio, reproducir Video continuo o hover según modo y mantener fallback sólo para contenido histórico."
);

assert(
  has(hoverPreview, "FramedVideo", 'preload="none"', "active && previewClip") &&
    has(framedVideo, "resolvePreviewViewportCrop", "ResizeObserver"),
  "El hover de Card debe cargar diferido y aplicar el recorte lógico sin crear una segunda variante física."
);

for (const route of [uploadRoute, importRoute]) {
  assert(
    has(
      route,
      'GameVideoTarget | "library"',
      'normalized === "cover"',
      'normalized === "card"',
      'normalized === "library"',
      "storeEditorialPreviewVideoFromPath",
      "withSavedGameVideoClip"
    ),
    "Las rutas de carga/importación deben aceptar Card, Portada y library con validación servidor."
  );
}

assert(
  has(
    layoutRoute,
    'value === "cover" || value === "hero" || value === "card"',
    "withGameVideoLayout",
    "hasExactAdminFormFields",
    "REQUIRED_DESTINATION_ASPECTS[target]"
  ) &&
    !layoutRoute.includes("storeEditorialPreviewVideo") &&
    !layoutRoute.includes("FFmpeg"),
  "Guardar el layout de Card debe ser metadata-only y exigir 3:2."
);

assert(
  has(
    integrity,
    "game.cardImage",
    'game.videoMedia?.card?.source === "independent"',
    "game.videoMedia.card.clip"
  ),
  "La integridad de publicación debe incluir la imagen Card y su WebM independiente."
);

const activePreviewSources = [
  libraryEditor,
  workspace,
  libraryRoute,
  viewportEditor,
  cardResolver,
  card,
  importRoute,
  uploadRoute,
  layoutRoute,
];
for (const legacyIdentifier of ["youtubePreview", "directPreview", "previewMode"]) {
  assert(
    activePreviewSources.every((text) => !text.includes(legacyIdentifier)),
    `El subsistema activo de Card no debe volver a usar ${legacyIdentifier}.`
  );
}

if (failures.length) {
  console.error("\nCard preview video: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Card preview video: OK (master temporal sin crop duplicado → motor único imagen/video → Card independiente 3:2 → WebM reutilizable → carga pública diferida)."
);
