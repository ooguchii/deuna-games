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
  libraryEditor,
  mediaViewportEditor,
  assignments,
  libraryRoute,
  viewportEditor,
  cardResolver,
  cardWrapper,
  cardBase,
  cardVideoBudget,
  cardPresentationCss,
  hoverPreview,
  videoMedia,
  validation,
  integrity,
] = await Promise.all([
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/safe-webm.ts"),
  source("src/components/admin/GameVideoLibraryEditor.tsx"),
  source("src/components/admin/MediaViewportEditor.tsx"),
  source("src/components/admin/GameMediaAssignmentsWorkspace.tsx"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/components/ui/UniversalGameCardBase.tsx"),
  source("src/lib/media/game-card-video-budget.ts"),
  source("src/components/ui/UniversalGameCardPresentation.module.css"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
]);

assert(
  has(
    policy,
    "MAX_PREVIEW_DURATION_SECONDS = 30",
    "MAX_PREVIEW_SOURCE_BYTES",
    "DEFAULT_PREVIEW_FPS",
    "MAX_PREVIEW_FPS",
    '"720p"',
    '"1080p"',
    '"3:2"'
  ),
  "Video Card debe conservar límites de duración/tamaño/calidad y viewport 3:2."
);

assert(
  has(safeWebm, "MAX_EDITORIAL_PREVIEW_BYTES", "inspectSafeEditorialWebm", "digest"),
  "Los WebM editoriales deben seguir pasando por inspección segura y hash."
);

assert(
  has(
    libraryEditor,
    '"X-Deuna-Preview-Target": "library"',
    "VideoTrimEditor",
    "PREVIEW_FPS_OPTIONS"
  ),
  "La biblioteca debe seguir creando masters reutilizables sin asignarlos implícitamente a una Card."
);

assert(
  has(
    mediaViewportEditor,
    'type MediaKind = "image" | "video"',
    "resolvePreviewViewportCrop",
    "requiredAspect",
    "Resultado final"
  ),
  "Imagen y video deben conservar un único motor espacial de encuadre."
);

assert(
  has(
    assignments,
    "Vista informativa",
    'target="card"',
    'target="card-image"',
    'target="card-video"',
    "Imagen + hover",
    "Video 3:2"
  ) &&
    !assignments.includes("Igualar al Hero"),
  "La capa informativa de Card debe conservar imagen/video propios y no reintroducir el antiguo control Igualar al Hero."
);

assert(
  has(
    libraryRoute,
    '"card-mode"',
    '"card-image"',
    '"card-video"',
    'source: "independent"',
    'requiredVideoViewport("card")',
    "previewClip: videoResource.src"
  ),
  "Asignar video Card debe conservar un WebM interno independiente y viewport 3:2."
);

assert(
  has(
    viewportEditor,
    'type Target = "cover" | "hero" | "card" | "detail"',
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "MediaViewportEditor"
  ),
  "El editor de video debe seguir persistiendo sólo metadata del viewport por destino."
);

assert(
  has(
    videoMedia,
    'export type GameVideoTarget = "cover" | "hero" | "card" | "detail"',
    "resolveGameCardVideo",
    'card?.source === "hero"',
    'card?.source === "independent"',
    "withGameVideoLayout"
  ),
  "El resolver debe mantener compatibilidad histórica con Card→Hero y nuevas Cards independientes."
);

assert(
  has(
    validation,
    "const cardVideoSchema = z.union",
    'source: z.literal("hero")',
    'source: z.literal("independent")',
    "cardImage",
    "mediaModes"
  ),
  "Validación debe aceptar snapshots históricos y el contrato Card independiente actual."
);

assert(
  has(
    cardResolver,
    'resolveGameDestinationMediaMode(game, "card") === "image"',
    "resolveGameCardVideo",
    'kind: "webm"'
  ),
  "El resolver de preview debe seguir respetando el modo multimedia propio de Card."
);

assert(
  has(
    cardWrapper,
    "UniversalGameCardBase",
    "GameFavoriteButton",
    "presentation={presentation}"
  ),
  "UniversalGameCard debe delegar al renderer base sin perder favorito ni presentación."
);

assert(
  has(
    cardBase,
    "DEFAULT_GLOBAL_GAME_CARD_PRESENTATION",
    'presentation === "poster"',
    'presentation === "detail-video"',
    "resolveGameCardVideo(game)",
    "IntersectionObserver",
    "REDUCED_MOTION_MEDIA",
    "FINE_HOVER_MEDIA",
    "posterRevealed",
    "PREVIEW_DELAY_MS",
    "useSyncExternalStore",
    "registerGameCardVideoCandidate",
    "updateGameCardVideoVisibility",
    "ownsDetailVideoBudget"
  ),
  "UniversalGameCardBase debe soportar poster→detalle, detalle con video por fila, touch/fine-pointer, reduced motion y presupuesto global de reproducción automática."
);

assert(
  has(
    cardVideoBudget,
    "MIN_VISIBLE_RATIO = 0.15",
    "const candidates = new Map<symbol, VideoCandidate>()",
    "currentOwner",
    "resolveOwner()",
    "registerGameCardVideoCandidate",
    "updateGameCardVideoVisibility",
    "unregisterGameCardVideoCandidate",
    "subscribeGameCardVideoBudget",
    "isGameCardVideoBudgetOwner"
  ),
  "El presupuesto de video debe elegir un único dueño visible y liberar candidatos al salir/desmontarse."
);

for (const forbidden of [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "fetch(",
  "navigator.sendBeacon",
]) {
  assert(
    !cardVideoBudget.includes(forbidden),
    `El presupuesto de reproducción debe ser efímero y no puede persistir ni reportar actividad: ${forbidden}.`
  );
}

assert(
  has(
    cardPresentationCss,
    "aspect-ratio: 4 / 5",
    "aspect-ratio: 3 / 2",
    '.presentationPoster[data-poster-revealed="true"]',
    "@media (hover: none), (pointer: coarse)",
    "@media (prefers-reduced-motion: reduce)"
  ),
  "La Card poster debe mantener footprint estable, revelar el detalle sin layout shift y degradar correctamente en touch/reduced-motion."
);

assert(
  has(
    hoverPreview,
    "FramedVideo",
    'preload="none"',
    "active && previewClip"
  ),
  "El WebM de Card debe continuar con carga diferida y sólo montar la capa cuando está activa."
);

assert(
  has(
    integrity,
    "game.cardImage",
    'game.videoMedia?.card?.source === "independent"',
    "game.videoMedia.card.clip"
  ),
  "Integridad debe proteger la imagen y WebM Card referenciados."
);

const activePreviewSources = [
  assignments,
  libraryRoute,
  viewportEditor,
  cardResolver,
  cardWrapper,
  cardBase,
];
for (const legacyIdentifier of ["youtubePreview", "directPreview", "previewMode"]) {
  assert(
    activePreviewSources.every((text) => !text.includes(legacyIdentifier)),
    `El subsistema activo de Card no debe volver a usar ${legacyIdentifier}.`
  );
}

if (failures.length) {
  console.error("\nCard presentation/video: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Card presentation/video: OK (poster 4:5 → detalle 3:2 → WebM opcional por fila → un autoplay visible → fallback imagen → touch/reduced-motion seguros)."
);