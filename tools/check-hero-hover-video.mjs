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
  gameTypes,
  contentValidation,
  gameVideoMedia,
  libraryRoute,
  workspace,
  heroSection,
] = await Promise.all([
  source("src/types/game.ts"),
  source("src/lib/admin/content-validation-core.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/home/HeroSection.tsx"),
]);

assert(
  gameTypes.includes('export type GameHeroVideoPlayback = "always" | "hover"') &&
    gameTypes.includes("playback?: GameHeroVideoPlayback"),
  "El contrato GameHeroVideo debe modelar explícitamente reproducción continua o al hover sin romper payloads antiguos."
);

assert(
  contentValidation.includes('playback: z.enum(["always", "hover"]).optional()'),
  "La validación editorial debe aceptar únicamente always/hover y conservar playback como opcional para compatibilidad hacia atrás."
);

assert(
  gameVideoMedia.includes("resolveGameHeroVideoPlayback") &&
    gameVideoMedia.includes('playback === "hover" ? "hover" : "always"') &&
    gameVideoMedia.includes('playback: "always"'),
  "El runtime debe interpretar Hero históricos sin playback como video continuo y los nuevos masters normales como always."
);

assert(
  libraryRoute.includes('"hero-hover-video"') &&
    libraryRoute.includes('heroVideo.playback === "hover"') &&
    libraryRoute.includes('? "hover-video"') &&
    libraryRoute.includes('target.data === "hero-video" || target.data === "hero-hover-video"') &&
    libraryRoute.includes('playback: target.data === "hero-hover-video" ? "hover" : "always"') &&
    libraryRoute.includes("saveGameMediaDraft") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn("),
  "Cambiar entre Video y Imagen+hover debe guardar sólo metadata sobre un WebM validado, sin copiar ni recodificar el recurso."
);

assert(
  workspace.includes('type HeroDraftMode = "image" | "video" | "hover-video"') &&
    workspace.includes('setHeroDraftMode("image")') &&
    workspace.includes('setHeroDraftMode("video")') &&
    workspace.includes('setHeroDraftMode("hover-video")') &&
    workspace.includes('"hero-hover-video"') &&
    workspace.includes("Imagen + hover") &&
    workspace.includes("En táctil conserva la imagen") &&
    workspace.includes('heroDraftMode !== "image"') &&
    workspace.includes("GameVideoViewportEditor"),
  "El Admin debe ofrecer Imagen, Video e Imagen+hover y reutilizar el editor de encuadre de video para los dos modos WebM."
);

assert(
  heroSection.includes("resolveGameHeroVideoPlayback") &&
    heroSection.includes('const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)"') &&
    heroSection.includes("canUseFineHover()") &&
    heroSection.includes("hoverPreviewActive") &&
    heroSection.includes("videoEnabled && (!hoverPlayback || hoverPreviewActive)") &&
    heroSection.includes("onMouseEnter={startHoverPreview}") &&
    heroSection.includes("onMouseLeave={stopHoverPreview}") &&
    heroSection.includes("!reducedMotion") &&
    heroSection.includes("<HeroVideoLayer") &&
    heroSection.includes("enabled={videoShouldRender}"),
  "El Hero público debe montar el video hover sólo con puntero fino sobre el slide activo y respetar prefers-reduced-motion."
);

if (failures.length) {
  console.error("\nHero hover video: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Hero hover video: OK (Imagen | Video continuo | Imagen+hover, sin duplicación ni recodificación y con fallback táctil/reduced-motion)."
);
