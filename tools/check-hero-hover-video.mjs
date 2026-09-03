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
  gameTypes,
  contentValidation,
  gameVideoMedia,
  libraryRoute,
  workspace,
  heroSection,
] = await Promise.all([
  source("src/types/game.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/home/HeroSection.tsx"),
]);

assert(
  has(
    gameTypes,
    'export type GameVideoPlayback = "always" | "hover"',
    "export type GameHeroVideoPlayback = GameVideoPlayback",
    "playback?: GameVideoPlayback",
    'export type GameDestinationMediaMode =',
    '| "hover-video"'
  ),
  "El contrato debe modelar reproducción always/hover y el modo editorial Imagen+hover."
);

assert(
  has(
    contentValidation,
    'playback: z.enum(["always", "hover"]).optional()',
    '"image",',
    '"video",',
    '"hover-video",',
    "hero: inferredMode(",
    '"hover-video"'
  ),
  "La validación editorial debe aceptar sólo modos/playback conocidos y usar Imagen+hover como default histórico del Hero cuando corresponde."
);

assert(
  has(
    gameVideoMedia,
    "resolveGameHeroVideoPlayback",
    'resolveGameDestinationMediaMode(game, "hero") === "hover-video"',
    '? "hover"',
    ': "always"',
    'hero: "hover-video"'
  ),
  "El runtime debe derivar playback del modo explícito del Hero y mantener Imagen+hover como default editorial."
);

assert(
  has(
    libraryRoute,
    '"hero-mode"',
    '"hero-image"',
    '"hero-video"',
    "mediaModeUpdate",
    'target.data === "hero-video"',
    'mode === "hover-video" ? "hover" : "always"',
    "saveGameMediaDraft"
  ) &&
    !libraryRoute.includes("hero-hover-video") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn("),
  "Cambiar Hero entre Imagen/Video/Imagen+hover debe guardar metadata y asignaciones, sin copiar ni recodificar el WebM."
);

assert(
  has(
    workspace,
    "MODE_OPTIONS",
    '{ value: "image", label: "Imagen" }',
    '{ value: "video", label: "Video" }',
    '{ value: "hover-video", label: "Imagen + hover" }',
    'target="hero"',
    'const heroMode = state?.assignments.heroMode ?? "hover-video"',
    'destinationActions("hero", heroMode',
    "Recortar imagen ${aspect}",
    "Recortar video ${aspect}",
    "GameVideoViewportEditor"
  ),
  "El Admin debe ofrecer los tres modos del Hero y recortes independientes para imagen y video."
);

assert(
  has(
    heroSection,
    'const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)"',
    'resolveGameDestinationMediaMode(game, "hero")',
    'const hoverPlayback = heroMode === "hover-video"',
    'const videoModeEnabled = heroMode !== "image"',
    "canUseFineHover()",
    "hoverPreviewActive",
    "videoEnabled &&",
    "videoModeEnabled &&",
    "(!hoverPlayback || hoverPreviewActive)",
    "onMouseEnter={startHoverPreview}",
    "onMouseLeave={stopHoverPreview}",
    "!reducedMotion",
    "<HeroVideoLayer",
    "enabled={videoShouldRender}"
  ),
  "El Hero público debe reproducir Video continuo o Imagen+hover según el modo, sólo con puntero compatible y respetando reduced-motion."
);

if (failures.length) {
  console.error("\nHero hover video: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Hero hover video: OK (modo explícito Imagen | Video | Imagen+hover, recortes por capa y reproducción pública accesible)."
);
