import {
  access,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_BYTES,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
  parsePreviewTrimWindow,
} from "../src/lib/media/preview-video-policy.ts";
import {
  inspectSafeEditorialWebm,
  MAX_EDITORIAL_PREVIEW_BYTES,
} from "../src/lib/media/safe-webm.ts";
import {
  parseYouTubePreview,
  parseYouTubeVideo,
} from "../src/lib/media/youtube-preview.ts";
import {
  resolveGameCardPreview,
} from "../src/lib/media/game-card-preview.ts";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const syntheticWebm = Buffer.alloc(160);
syntheticWebm.set([0x1a, 0x45, 0xdf, 0xa3], 0);
syntheticWebm.write("webm", 24, "ascii");

assert(
  inspectSafeEditorialWebm(syntheticWebm)?.bytes === syntheticWebm.length,
  "El inspector WebM debe aceptar el contenedor editorial mínimo y calcular su identidad."
);
assert(
  inspectSafeEditorialWebm(Buffer.alloc(160)) === null,
  "El inspector WebM debe rechazar datos sin cabecera EBML/WebM."
);
assert(
  MAX_EDITORIAL_PREVIEW_BYTES === 3 * 1024 * 1024,
  "El preview WebM público debe mantener un límite estricto de 3 MB."
);
assert(
  MAX_PREVIEW_SOURCE_BYTES === 64 * 1024 * 1024 &&
    MAX_PREVIEW_DURATION_SECONDS === 30 &&
    MAX_PREVIEW_SOURCE_POSITION_SECONDS === 86_400,
  "La política compartida debe limitar origen, duración y posición del recorte."
);
assert(
  parsePreviewTrimWindow("12.5", "24")?.durationSeconds === 11.5 &&
    parsePreviewTrimWindow("0", "30")?.durationSeconds === 30 &&
    parsePreviewTrimWindow("0", "30.001") === null &&
    parsePreviewTrimWindow("20", "10") === null &&
    parsePreviewTrimWindow("-1", "1") === null,
  "El recorte compartido debe aceptar ventanas válidas y rechazar duración, orden o posiciones inválidas."
);

const parsedWatch = parseYouTubeVideo(
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
);
const parsedShort = parseYouTubeVideo(
  "https://youtu.be/dQw4w9WgXcQ?t=14"
);
assert(
  parsedWatch?.videoId === "dQw4w9WgXcQ" &&
    parsedShort?.videoId === "dQw4w9WgXcQ" &&
    parseYouTubeVideo("https://example.com/watch?v=dQw4w9WgXcQ") === null &&
    parseYouTubePreview(
      "dQw4w9WgXcQ",
      "12.5",
      "30"
    )?.endSeconds === 30 &&
    parseYouTubePreview(
      "dQw4w9WgXcQ",
      "0",
      "30.001"
    ) === null,
  "YouTube debe aceptar sólo IDs/URLs reconocidos y compartir el límite de 30 s."
);
assert(
  resolveGameCardPreview({
    previewMode: "youtube",
    previewClip: "/media/editorial/game/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webm",
    youtubePreview: {
      videoId: "dQw4w9WgXcQ",
      startSeconds: 4,
      endSeconds: 24,
    },
  })?.kind === "youtube" &&
    resolveGameCardPreview({
      previewMode: "webm",
      previewClip: "/media/editorial/game/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webm",
      youtubePreview: {
        videoId: "dQw4w9WgXcQ",
        startSeconds: 4,
        endSeconds: 24,
      },
    })?.kind === "webm" &&
    resolveGameCardPreview({
      previewClip: "/media/editorial/game/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webm",
    })?.kind === "webm",
  "El resolver debe respetar el modo activo, conservar fallback y mantener compatibilidad con WebM históricos."
);

const [
  schema,
  typeModel,
  transcoder,
  trimPolicy,
  remoteSource,
  staging,
  uploadRoute,
  stagingRoute,
  stagedPlaybackRoute,
  importRoute,
  youtubeRoute,
  previewModeRoute,
  youtubeRemoveRoute,
  removeRoute,
  settingsRoute,
  mediaAuth,
  mediaRequestSecurity,
  publicRoute,
  hoverMedia,
  universalCard,
  sharedYouTubePlayer,
  previewAdminForm,
  trimEditor,
  youtubeTrimEditor,
  adminEditor,
  integrity,
  publicationChanges,
  rootLayout,
  nextConfig,
  nginx,
  envExample,
  packageJson,
] = await Promise.all([
  source("src/lib/admin/content-validation.ts"),
  source("src/types/game.ts"),
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-youtube/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-mode/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-youtube-remove/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-remove/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-settings/route.ts"),
  source("src/lib/admin/media-admin-route.ts"),
  source("src/lib/admin/media-request-security.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/lib/media/shared-youtube-hover-player.ts"),
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/components/admin/YouTubeTrimEditor.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("src/app/layout.tsx"),
  source("next.config.ts"),
  source("ops/nginx/deuna-games.conf.example"),
  source(".env.example"),
  source("package.json"),
]);

assert(
  schema.includes("previewMode: z.enum") &&
    schema.includes('"webm"') &&
    schema.includes('"youtube"') &&
    schema.includes("youtubePreview: youtubePreviewSchema.optional()") &&
    schema.includes("previewClip: localPreviewClipSchema.optional()") &&
    schema.includes("duration > 30") &&
    schema.includes("[A-Za-z0-9_-]{11}"),
  "El payload editorial debe validar modo híbrido, WebM local e ID/intervalo de YouTube."
);
assert(
  typeModel.includes('GamePreviewMode = "webm" | "youtube"') &&
    typeModel.includes("youtubePreview?: GameYouTubePreview") &&
    typeModel.includes("previewClip?: string"),
  "El modelo público debe transportar los dos orígenes sin romper el WebM existente."
);
assert(
  trimPolicy.includes("parsePreviewTrimWindow") &&
    trimPolicy.includes("MAX_PREVIEW_DURATION_SECONDS = 30") &&
    trimPolicy.includes("MAX_PREVIEW_SOURCE_POSITION_SECONDS = 86_400"),
  "La política de recorte debe seguir siendo única para local y YouTube."
);
assert(
  transcoder.includes('"libvpx-vp9"') &&
    transcoder.includes('"-ss"') &&
    transcoder.includes('"-an"') &&
    transcoder.includes("PREFERRED_PREVIEW_BYTES = 1_572_864") &&
    transcoder.includes("width: 400") &&
    transcoder.includes("fps: 15") &&
    transcoder.includes("width: 360") &&
    transcoder.includes("fps: 12") &&
    transcoder.includes("spawn(ffmpegExecutable()") &&
    transcoder.includes("shell: false") &&
    transcoder.includes("inspectSafeEditorialWebm"),
  "La alternativa WebM debe conservar su conversión VP9 segura y ligera."
);
assert(
  uploadRoute.includes("MAX_ADMIN_PREVIEW_REQUEST_BYTES") &&
    uploadRoute.includes("parsePreviewTrimWindow") &&
    uploadRoute.includes('previewMode: "webm"') &&
    uploadRoute.includes("storeEditorialPreviewVideo"),
  "Una subida local debe crear WebM y activarlo explícitamente."
);
assert(
  remoteSource.includes("httpsRequest") &&
    remoteSource.includes("BlockList") &&
    remoteSource.includes("MAX_REDIRECTS = 3") &&
    remoteSource.includes("MAX_REMOTE_PREVIEW_BYTES") &&
    remoteSource.includes("pipeline"),
  "La URL directa a archivo debe conservar la protección SSRF y streaming."
);
assert(
  staging.includes("STAGING_TTL_MS = 30 * 60 * 1_000") &&
    staging.includes("MAX_STAGED_SOURCES = 8") &&
    staging.includes("removeStagedEditorialPreviewSource"),
  "La alternativa URL→WebM debe mantener staging acotado y temporal."
);
assert(
  stagingRoute.includes("createStagedRemotePreviewSource") &&
    stagedPlaybackRoute.includes('"Accept-Ranges": "bytes"') &&
    stagedPlaybackRoute.includes("removeStagedEditorialPreviewSource") &&
    importRoute.includes('previewMode: "webm"') &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    !importRoute.includes("youtube"),
  "La importación directa debe seguir aislada del flujo YouTube y activar WebM."
);
assert(
  youtubeRoute.includes("authorizeAdminFormRequest") &&
    youtubeRoute.includes("hasExactAdminFormFields") &&
    youtubeRoute.includes("parseYouTubePreview") &&
    youtubeRoute.includes('previewMode: "youtube"') &&
    youtubeRoute.includes("youtubePreview: preview") &&
    !youtubeRoute.includes("FFmpeg") &&
    !youtubeRoute.includes("spawn(") &&
    !youtubeRoute.includes("fetch(") &&
    !youtubeRoute.includes("yt-dlp"),
  "Guardar YouTube debe persistir sólo metadatos, sin descargar ni transcodificar."
);
assert(
  previewModeRoute.includes('mode !== "webm"') &&
    previewModeRoute.includes('mode !== "youtube"') &&
    previewModeRoute.includes("item.payload.previewClip") &&
    previewModeRoute.includes("item.payload.youtubePreview") &&
    youtubeRemoveRoute.includes("fallbackMode") &&
    removeRoute.includes("fallbackMode"),
  "Cambiar/eliminar origen debe validar disponibilidad y caer al origen alternativo sin destruirlo."
);
assert(
  settingsRoute.includes('"Cache-Control": "private, no-store, max-age=0"') &&
    settingsRoute.includes("youtubePreview") &&
    settingsRoute.includes("previewClip"),
  "El gestor privado debe leer sus ajustes sin cachear datos administrativos."
);
assert(
  previewAdminForm.includes('type SourceMode = "file" | "url" | "youtube"') &&
    previewAdminForm.includes("VideoTrimEditor") &&
    previewAdminForm.includes("YouTubeTrimEditor") &&
    previewAdminForm.includes("parseYouTubeVideo(sourceUrl)") &&
    previewAdminForm.includes("navigator.clipboard.readText()") &&
    previewAdminForm.includes("Buscar en YouTube") &&
    previewAdminForm.includes("/preview-youtube") &&
    previewAdminForm.includes("/preview-mode") &&
    previewAdminForm.includes("No existe un iframe por tarjeta"),
  "Multimedia debe gestionar WebM y YouTube desde un único flujo visual sin confundir URL directa con YouTube."
);
assert(
  trimEditor.includes("Línea de tiempo del video") &&
    trimEditor.includes("Marcar IN aquí") &&
    trimEditor.includes("Marcar OUT aquí") &&
    trimEditor.includes("Reproducir recorte") &&
    trimEditor.includes('role="slider"') &&
    youtubeTrimEditor.includes("youtube-nocookie.com") &&
    youtubeTrimEditor.includes("Línea de tiempo del video de YouTube") &&
    youtubeTrimEditor.includes("Marcar IN aquí") &&
    youtubeTrimEditor.includes("Marcar OUT aquí") &&
    youtubeTrimEditor.includes("Reproducir recorte") &&
    youtubeTrimEditor.includes('role="slider"'),
  "Ambos orígenes deben ofrecer recorte visual IN/OUT accesible antes de guardar."
);
assert(
  mediaAuth.includes("maximumBytes?: number") &&
    mediaRequestSecurity.includes("MAX_ADMIN_PREVIEW_REQUEST_BYTES") &&
    mediaRequestSecurity.includes("hasTrustedAdminOrigin"),
  "El límite grande debe seguir limitado a la carga local, sin afectar formularios pequeños."
);
assert(
  publicRoute.includes('"Content-Type": "video/webm"') &&
    publicRoute.includes('"Accept-Ranges": "bytes"') &&
    publicRoute.includes("MAX_VALIDATED_WEBM_CACHE_ENTRIES") &&
    publicRoute.includes("immutable"),
  "La alternativa WebM debe mantener Range y cache inmutable."
);
assert(
  hoverMedia.includes("preload=\"none\"") &&
    hoverMedia.includes("muted") &&
    hoverMedia.includes("loop") &&
    hoverMedia.includes("video.pause()"),
  "El WebM no debe precargarse antes de la intención de hover."
);
assert(
  universalCard.includes("PREVIEW_DELAY_MS = 1_000") &&
    universalCard.includes("resolveGameCardPreview") &&
    universalCard.includes("activateSharedYouTubeHoverPlayer") &&
    universalCard.includes("deactivateSharedYouTubeHoverPlayer") &&
    universalCard.indexOf("setTimeout") <
      universalCard.indexOf("activateSharedYouTubeHoverPlayer") &&
    universalCard.includes("(hover: hover) and (pointer: fine)") &&
    universalCard.includes("prefers-reduced-motion: reduce") &&
    universalCard.includes("requestAnimationFrame") &&
    universalCard.includes('"--tilt-transition-duration"'),
  "La tarjeta debe esperar 1 s, estabilizar el tilt y activar el singleton sólo tras intención real."
);
assert(
  sharedYouTubePlayer.includes("youtube-nocookie.com") &&
    sharedYouTubePlayer.includes('document.createElement("iframe")') &&
    (sharedYouTubePlayer.match(/createElement\("iframe"\)/g) ?? []).length === 1 &&
    sharedYouTubePlayer.includes('sendCommand("loadVideoById"') &&
    sharedYouTubePlayer.includes("startSeconds") &&
    sharedYouTubePlayer.includes("endSeconds") &&
    sharedYouTubePlayer.includes('sendCommand("pauseVideo")') &&
    sharedYouTubePlayer.includes("visibilitychange") &&
    sharedYouTubePlayer.includes("ResizeObserver") &&
    sharedYouTubePlayer.includes("requestAnimationFrame") &&
    sharedYouTubePlayer.includes("IDLE_DESTROY_MS = 60_000") &&
    sharedYouTubePlayer.includes("destroyPlayer") &&
    sharedYouTubePlayer.includes('pointerEvents: "none"') &&
    sharedYouTubePlayer.includes('contain: "layout paint style"') &&
    !sharedYouTubePlayer.includes("youtube.com/iframe_api") &&
    !sharedYouTubePlayer.includes("YT.Player"),
  "YouTube público debe usar un único iframe DOM lazy, reutilizable y liberable por inactividad, sin SDK externo."
);
assert(
  !rootLayout.includes("YouTubeHoverPlayerProvider") &&
    !rootLayout.includes("shared-youtube-hover-player"),
  "El reproductor YouTube no debe montarse en el root layout ni añadir JavaScript a rutas sin tarjetas."
);
assert(
  nextConfig.includes('frame-src https://www.youtube-nocookie.com') &&
    !nextConfig.includes("frame-src https:") &&
    !nextConfig.includes("youtube.com/iframe_api"),
  "CSP debe permitir sólo el dominio de embed de privacidad mejorada, no iframes HTTPS arbitrarios ni SDK externo."
);
assert(
  adminEditor.includes("GamePreviewClipUploadForm") &&
    adminEditor.includes("currentPreview={game.previewClip}"),
  "Multimedia del juego debe administrar el preview en el workspace editorial existente."
);
assert(
  integrity.includes("game.previewClip") &&
    !integrity.includes("youtubePreview"),
  "Integridad de archivos debe comprobar sólo multimedia local; YouTube no debe fingirse como archivo local."
);
assert(
  publicationChanges.includes("previewMode") &&
    publicationChanges.includes("youtubePreview") &&
    publicationChanges.includes("previewClip"),
  "La revisión de publicación debe mostrar cambios de modo, WebM y tramo de YouTube."
);
assert(
  nginx.includes("preview-upload$") &&
    nginx.includes("client_max_body_size 66m") &&
    nginx.includes("client_max_body_size 8k"),
  "Sólo subir un archivo local debe conservar el body administrativo grande."
);
assert(
  envExample.includes("DEUNA_FFMPEG_PATH") &&
    !envExample.includes("DEUNA_YTDLP") &&
    !envExample.includes("MEDIA_IMPORT_WORKER") &&
    !packageJson.includes("yt-dlp"),
  "La arquitectura directa de YouTube no debe requerir yt-dlp, worker ni nuevas dependencias de servidor."
);

for (const discardedPath of [
  "src/components/ui/YouTubeHoverPlayerProvider.tsx",
  "src/components/ui/YouTubeHoverPlayerProvider.module.css",
  "src/lib/media/youtube-video-source.ts",
  "src/lib/media/media-import-worker-client.ts",
  "ops/deploy/media-import-worker.mjs",
  "ops/systemd/deuna-games-media-import.service.example",
  "ops/systemd/media-import.env.example",
]) {
  assert(
    !(await exists(discardedPath)),
    `No debe quedar residuo de la arquitectura descartada: ${discardedPath}`
  );
}

if (failures.length > 0) {
  console.error("");
  console.error("Preview de video en tarjetas: ERROR");
  console.error("");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Preview de video en tarjetas: OK (WebM opcional + YouTube directo con singleton lazy, 1 s de intención, recorte visual, liberación por inactividad y cero descarga/transcodificación YouTube verificados)."
);
