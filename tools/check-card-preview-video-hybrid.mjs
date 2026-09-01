import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  parseYouTubeVideo,
  validateYouTubePreview,
} from "../src/lib/media/youtube-preview.ts";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

for (const sample of [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "https://www.youtube.com/live/dQw4w9WgXcQ",
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
]) {
  assert(
    parseYouTubeVideo(sample)?.videoId === "dQw4w9WgXcQ",
    `YouTube debe reconocer el formato: ${sample}`
  );
}

assert(
  parseYouTubeVideo("https://example.com/watch?v=dQw4w9WgXcQ") === null,
  "El parser de YouTube no debe aceptar hosts ajenos."
);
assert(
  validateYouTubePreview({
    videoId: "dQw4w9WgXcQ",
    startSeconds: 10,
    endSeconds: 30,
  }),
  "Un recorte YouTube válido debe superar la validación."
);
assert(
  !validateYouTubePreview({
    videoId: "dQw4w9WgXcQ",
    startSeconds: 0,
    endSeconds: 31,
  }),
  "YouTube directo debe conservar el máximo editorial de 30 segundos."
);

const [
  gameTypes,
  validation,
  contentService,
  resolver,
  sharedPlayer,
  universalCard,
  youtubeEditor,
  adminForm,
  youtubeRoute,
  stateRoute,
  uploadRoute,
  importRoute,
  removeRoute,
  staging,
  remoteSource,
  platformSource,
  publicationChanges,
  nextConfig,
] = await Promise.all([
  source("src/types/game.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/admin/content-service.ts"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/lib/media/shared-youtube-hover-player.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/components/admin/YouTubeTrimEditor.tsx"),
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-youtube/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-state/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-remove/route.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/platform-video-source.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("next.config.ts"),
]);

assert(
  gameTypes.includes('GamePreviewMode = "webm" | "youtube"') &&
    gameTypes.includes("youtubePreview?: GameYouTubePreview"),
  "El modelo debe conservar WebM y YouTube como orígenes de preview explícitos."
);

assert(
  validation.includes('previewMode: z.enum(["webm", "youtube"])') &&
    validation.includes("youtubePreview: youtubePreviewSchema.optional()"),
  "La validación editorial debe persistir YouTube directo sin debilitar el payload."
);

assert(
  contentService.includes('"previewMode"') &&
    contentService.includes('"youtubePreview"'),
  "El servicio editorial debe guardar previewMode y youtubePreview."
);

assert(
  resolver.includes('kind: "youtube"') &&
    resolver.includes('kind: "webm"') &&
    resolver.includes("validateYouTubePreview"),
  "La tarjeta debe resolver de forma centralizada WebM o YouTube con fallback."
);

assert(
  sharedPlayer.includes("youtube-nocookie.com") &&
    sharedPlayer.includes("loadVideoById") &&
    sharedPlayer.includes("IDLE_DESTROY_MS") &&
    sharedPlayer.includes("(hover: hover) and (pointer: fine)"),
  "YouTube debe usar un solo reproductor compartido, diferido y reutilizable."
);

assert(
  universalCard.includes("resolveGameCardPreview") &&
    universalCard.includes("activateSharedYouTubeHoverPlayer") &&
    universalCard.includes("PREVIEW_DELAY_MS = 1_000") &&
    universalCard.includes("prefers-reduced-motion: reduce"),
  "La tarjeta debe mantener hover intent de 1 s, WebM local y YouTube directo."
);

assert(
  youtubeEditor.includes("Línea de tiempo del video de YouTube") &&
    youtubeEditor.includes("Marcar IN aquí") &&
    youtubeEditor.includes("Marcar OUT aquí") &&
    youtubeEditor.includes("youtube-nocookie.com"),
  "YouTube directo debe conservar recorte visual IN/OUT sin descargar el video."
);

assert(
  adminForm.includes('type SourceMode = "file" | "url" | "youtube"') &&
    adminForm.includes("parseYouTubeVideo") &&
    adminForm.includes("YouTubeTrimEditor") &&
    adminForm.includes("Intentar WebM local (opcional)") &&
    adminForm.includes("preview-state") &&
    adminForm.includes("preview-youtube"),
  "Multimedia debe detectar YouTube, ofrecer modo nativo y mantener importación WebM como alternativa."
);

assert(
  youtubeRoute.includes('previewMode: "youtube"') &&
    youtubeRoute.includes("youtubePreview: preview"),
  "Guardar YouTube debe activar explícitamente el modo directo."
);

assert(
  stateRoute.includes("resolveAdminSession") &&
    stateRoute.includes("previewMode") &&
    stateRoute.includes("youtubePreview"),
  "El editor cliente debe poder recuperar de forma autenticada el estado híbrido guardado."
);

assert(
  uploadRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    removeRoute.includes("youtubePreview: undefined"),
  "El pipeline WebM existente debe seguir funcionando y Quitar preview debe limpiar todos los orígenes."
);

assert(
  staging.includes("parseSupportedPlatformVideoUrl") &&
    staging.includes("downloadRemoteEditorialVideo") &&
    staging.includes("downloadPlatformEditorialVideo"),
  "Las URLs directas y las redes compatibles deben conservar staging privado separado del modo YouTube nativo."
);

assert(
  remoteSource.includes("BlockList") &&
    remoteSource.includes("MAX_REDIRECTS = 3") &&
    remoteSource.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    remoteSource.includes("pipeline"),
  "La URL directa debe mantener protección SSRF, redirecciones limitadas, streaming y techo de tamaño."
);

assert(
  platformSource.includes("parseSupportedPlatformVideoUrl") &&
    platformSource.includes("spawn(ytDlpExecutable()") &&
    platformSource.includes("--no-playlist") &&
    platformSource.includes("--max-filesize"),
  "Facebook, Instagram, TikTok y demás redes deben conservar importación aislada mediante yt-dlp."
);

assert(
  publicationChanges.includes("previewMode") &&
    publicationChanges.includes("youtubePreview") &&
    publicationChanges.includes("WebM local") &&
    publicationChanges.includes("YouTube"),
  "La revisión de publicación debe detectar cambios del preview híbrido completo."
);

assert(
  nextConfig.includes('"frame-src https://www.youtube-nocookie.com"') &&
    !nextConfig.includes('"frame-src *"'),
  "CSP debe permitir únicamente el iframe privacy-enhanced de YouTube, no frames arbitrarios."
);

if (failures.length > 0) {
  console.error("");
  console.error("Preview híbrido de video: ERROR");
  console.error("");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exit(1);
}

console.log(
  "Preview híbrido de video: OK (archivo/URL/red → WebM local; YouTube → reproductor directo con recorte y fallback opcional a WebM)."
);
