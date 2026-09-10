import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import "./check-card-preview-runtime.mjs";
import "./check-universal-game-card-3d.mjs";

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
  libraryTypes,
  mediaWorkspace,
  libraryRoute,
  viewportEditor,
  coverRenderer,
  cardResolver,
  cardWrapper,
  cardBase,
  hoverPreview,
  framedVideo,
  framedLayout,
  videoMedia,
  requirements,
  publicationReadiness,
  validation,
  importRoute,
  uploadRoute,
  layoutRoute,
  integrity,
  hygiene,
  history,
  serving,
  legacyCover,
  gameTypes,
] = await Promise.all([
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/safe-webm.ts"),
  source("src/lib/media/preview-providers.ts"),
  source("src/components/admin/GameVideoLibraryEditor.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/components/admin/MediaViewportEditor.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/game-multimedia-library-types.ts"),
  source("src/lib/admin/game-media-workspace.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/components/ui/GameCoverMedia.tsx"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/components/ui/UniversalGameCardBase.tsx"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/FramedVideo.tsx"),
  source("src/lib/media/framed-media-layout.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/media/game-media-requirements.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-media-hygiene.ts"),
  source("src/lib/admin/game-media-history.ts"),
  source("src/lib/media/editorial-media-serving.ts"),
  source("src/lib/media/legacy-game-cover-video.ts"),
  source("src/types/game.ts"),
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
    'type VideoDestination = Exclude<Destination, "cover">',
    'const coverCropReady = coverImageCropReady',
    'target="cover-image"',
    'onClick={() => openDestination("cover", "image")}',
    "Sólo imagen. Selecciona un recurso y confirma un único recorte 4:5.",
    "Portada usa sólo imagen con recorte 4:5.",
    "Portada requiere una imagen y su recorte 4:5.",
    'const cardMode = state?.assignments.cardMode ?? "hover-video"',
    'target="card"',
    'destinationActions("card", cardMode',
    "GameVideoViewportEditor"
  ) &&
    !workspace.includes("coverMode") &&
    !workspace.includes("coverVideo") &&
    !workspace.includes('target="cover-video"') &&
    !workspace.includes('target="cover-mode"') &&
    !workspace.includes("Igualar al Hero") &&
    !workspace.includes("card-match-hero"),
  "Portada debe ser sólo imagen/4:5 mientras Card conserva su sistema multimedia independiente."
);

assert(
  has(
    libraryTypes,
    'mode: "image"',
    'aspect: "4:5"',
    'aspect: "3:1"',
    "heroVideo: GameHeroVideo | null"
  ) &&
    !libraryTypes.includes("GameCoverVideo") &&
    !libraryTypes.includes("coverMode:") &&
    !libraryTypes.includes("coverVideo:"),
  "El estado compartido del workspace debe tipar Portada como image-only y conservar Hero 3:1."
);

assert(
  has(
    mediaWorkspace,
    "coverImage: game.coverImage ?? null",
    'heroMode: resolveGameDestinationMediaMode(game, "hero")',
    "heroVideo: game.videoMedia?.hero ?? null"
  ) &&
    !mediaWorkspace.includes('resolveGameDestinationMediaMode(game, "cover")') &&
    !mediaWorkspace.includes("coverMode:") &&
    !mediaWorkspace.includes("coverVideo:") &&
    !mediaWorkspace.includes("game.videoMedia?.cover"),
  "El snapshot multimedia del Admin no debe volver a transportar modo/video de Portada."
);

assert(
  has(
    libraryRoute,
    '"cover-image"',
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
    !libraryRoute.includes('"cover-mode"') &&
    !libraryRoute.includes('"cover-video"') &&
    !libraryRoute.includes('requiredVideoViewport("cover")') &&
    !libraryRoute.includes("coverVideo:") &&
    !libraryRoute.includes("coverMode:") &&
    !libraryRoute.includes("card-match-hero"),
  "La API de biblioteca debe aceptar sólo imagen para Portada y conservar Card/video en sus destinos válidos."
);

assert(
  has(
    viewportEditor,
    "MediaViewportEditor",
    'kind="video"',
    'type Target = "hero" | "card" | "detail"',
    "preview-layout",
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "Confirmar recorte"
  ) &&
    !viewportEditor.includes('target === "cover"') &&
    !viewportEditor.includes("VideoTrimEditor") &&
    !viewportEditor.includes("preview-import") &&
    !viewportEditor.includes("preview-upload") &&
    !viewportEditor.includes("preview-remove") &&
    !viewportEditor.includes("Usar imagen estática"),
  "El editor de viewport de video no puede volver a admitir Portada."
);

assert(
  has(
    coverRenderer,
    "GameMedia",
    "src={game.coverImage}",
    "viewport={game.imageMedia?.cover}",
    'aspectRatio: "4 / 5"'
  ) &&
    !coverRenderer.includes("FramedVideo") &&
    !coverRenderer.includes("resolveGameCoverVideo") &&
    !coverRenderer.includes("resolveGameDestinationMediaMode") &&
    !coverRenderer.includes("hover-video"),
  "El renderer público de Portada debe pintar únicamente coverImage con su viewport 4:5."
);

assert(
  has(
    videoMedia,
    'export type GameVideoTarget = "hero" | "card" | "detail"',
    'export type GameMediaDestinationTarget = "cover" | GameVideoTarget',
    'if (target === "cover") return "image"',
    "resolveGameCardVideo",
    'card?.source === "hero"',
    'card?.source === "independent"',
    'source: "independent"',
    "withGameVideoLayout",
    "withoutGameVideoTarget"
  ) &&
    !videoMedia.includes("resolveGameCoverVideo") &&
    !videoMedia.includes("media?.cover") &&
    !videoMedia.includes('cover: "image"'),
  "El dominio debe forzar Portada=image sin conservar un resolver, default ni target activo de video para Portada."
);

assert(
  has(
    gameTypes,
    "export type GameMediaModes",
    "export type GameVideoMedia",
    "Portada es siempre imagen",
    "Portada queda fuera del contrato activo",
    "coverImage?: string"
  ) &&
    !gameTypes.includes("GameCoverVideo") &&
    !gameTypes.includes("cover?: GameDestinationMediaMode") &&
    !gameTypes.includes("cover?: GameCoverVideo"),
  "El contrato TypeScript Game debe excluir por completo modo y video de Portada."
);

assert(
  has(
    requirements,
    "const coverAssigned = Boolean(game.coverImage)",
    "game.imageMedia?.cover",
    "mode: \"image\" as const",
    "cover.cropReady"
  ) &&
    !requirements.includes("videoMedia?.cover") &&
    !requirements.includes('resolveGameDestinationMediaMode(game, "cover")'),
  "Readiness de Portada debe depender sólo de coverImage + recorte 4:5 confirmado."
);

assert(
  publicationReadiness.includes("La Portada requiere una imagen y su recorte 4:5 confirmado.") &&
    !publicationReadiness.includes("La Portada debe completar los recursos exigidos por su modo activo."),
  "La revisión de publicación debe describir el mismo contrato image-only que valida el servidor."
);

assert(
  has(
    validation,
    "const cardVideoSchema = z.union",
    'source: z.literal("hero")',
    'source: z.literal("independent")',
    'cover: destinationVideoSchema.optional()',
    "activeVideoMedia",
    "videoMedia.hero",
    "videoMedia.card",
    "const normalizedGame: Game",
    "return normalizedGame"
  ) &&
    !validation.includes('cover: "image" as const'),
  "La validación debe aceptar cover-video sólo como entrada histórica y eliminar modo/video de Portada del Game normalizado."
);

for (const route of [uploadRoute, importRoute]) {
  assert(
    has(
      route,
      'GameVideoTarget | "library"',
      'normalized === "card"',
      'normalized === "library"',
      "storeEditorialPreviewVideoFromPath",
      "withSavedGameVideoClip"
    ) &&
      !route.includes('normalized === "cover"'),
    "Las rutas de carga/importación de video deben rechazar Portada y conservar Card/Hero/library."
  );
}

assert(
  has(
    layoutRoute,
    'value === "hero"',
    'value === "card"',
    'value === "detail"',
    "withGameVideoLayout",
    "hasExactAdminFormFields",
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "GAME_DETAIL_VIEWPORT_ASPECT"
  ) &&
    !layoutRoute.includes('value === "cover"') &&
    !layoutRoute.includes("storeEditorialPreviewVideo") &&
    !layoutRoute.includes("FFmpeg"),
  "Guardar layout de video debe rechazar Portada y seguir siendo metadata-only para destinos de video activos."
);

assert(
  has(
    legacyCover,
    "legacyGameCoverVideoReference",
    "videoMedia",
    "cover",
    "clip.trim()"
  ) &&
    has(history, "legacyGameCoverVideoReference(row.payload)", "references.add(legacyCoverVideo)") &&
    has(serving, "legacyGameCoverVideoReference(payload)", "legacyCoverVideo ? [legacyCoverVideo] : []"),
  "Los WebM históricos de Portada deben conservarse sólo en historial/serving para rollback y cache público irreversible."
);

assert(
  has(
    integrity,
    "game.cardImage",
    'game.videoMedia?.card?.source === "independent"',
    "game.videoMedia.card.clip",
    "game.videoMedia?.background?.clip"
  ) &&
    !integrity.includes("game.videoMedia?.cover"),
  "La integridad activa debe excluir video de Portada y seguir cubriendo Card/Hero/Contenedor/Fondo/Galería."
);

assert(
  hygiene.includes('pushUnique(labels, "Portada")') &&
    !hygiene.includes("coverMode") &&
    !hygiene.includes("coverClip") &&
    !hygiene.includes("videoMedia?.cover"),
  "La higiene debe clasificar coverImage como Portada activa sin ninguna rama de video/hover."
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
    cardWrapper,
    "UniversalGameCardBase",
    "GameFavoriteButton",
    "variant={variant}"
  ),
  "UniversalGameCard debe seguir delegando el renderer multimedia canónico al base y limitarse a componer el control de favorito."
);

assert(
  has(
    cardBase,
    'resolveGameDestinationMediaMode(game, "card")',
    "const resolvedPreview = resolveGameCardPreview(game)",
    "const cardImage = game.cardImage ?? game.coverImage",
    "const imageViewport = game.imageMedia?.card",
    'const videoAlwaysActive = cardMode === "video"',
    'const hoverPreviewEnabled = cardMode === "hover-video"',
    "PREVIEW_DELAY_MS"
  ),
  "UniversalGameCardBase debe conservar Card Video/hover; el cambio image-only se limita a Portada."
);

assert(
  has(hoverPreview, "FramedVideo", 'preload="none"', "active && previewClip") &&
    has(framedVideo, "resolveFramedMediaLayout", "ResizeObserver") &&
    has(framedLayout, "resolvePreviewViewportCrop", "frameWidth / crop.width", "frameHeight / crop.height"),
  "El hover de Card debe cargar diferido y aplicar el recorte lógico sin crear una segunda variante física."
);

const activeCoverBoundarySources = [
  workspace,
  libraryTypes,
  mediaWorkspace,
  libraryRoute,
  viewportEditor,
  coverRenderer,
  importRoute,
  uploadRoute,
  layoutRoute,
  videoMedia,
  requirements,
  publicationReadiness,
  integrity,
  hygiene,
  gameTypes,
];
for (const forbidden of [
  "GameCoverVideo",
  "resolveGameCoverVideo",
  "videoMedia?.cover",
  "videoMedia.cover",
  '"cover-video"',
  '"cover-mode"',
]) {
  assert(
    activeCoverBoundarySources.every((text) => !text.includes(forbidden)),
    `Portada image-only no debe reintroducir ${forbidden} en el dominio activo.`
  );
}

const activePreviewSources = [
  libraryEditor,
  workspace,
  libraryRoute,
  viewportEditor,
  cardResolver,
  cardWrapper,
  cardBase,
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
  console.error("\nCard/Portada multimedia: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Card/Portada multimedia: OK (Portada sólo imagen 4:5 en UI/API/tipos/dominio/render público; video/hover sin targets activos; Card/Hero video preservados; historial de Portada aislado)."
);
