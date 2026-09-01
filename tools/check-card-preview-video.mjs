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
  "El inspector WebM debe aceptar el contenedor editorial mínimo."
);
assert(
  inspectSafeEditorialWebm(Buffer.alloc(160)) === null,
  "El inspector WebM debe rechazar datos sin cabecera EBML/WebM."
);
assert(
  MAX_EDITORIAL_PREVIEW_BYTES === 3 * 1024 * 1024,
  "El WebM público debe mantener un límite estricto de 3 MB."
);
assert(
  MAX_PREVIEW_SOURCE_BYTES === 1024 * 1024 * 1024 &&
    MAX_PREVIEW_DURATION_SECONDS === 30 &&
    MAX_PREVIEW_SOURCE_POSITION_SECONDS === 86_400,
  "La política de preview debe permitir origen de 1 GiB manteniendo 30 s máximos de salida."
);
assert(
  parsePreviewTrimWindow("12.5", "24")?.durationSeconds === 11.5 &&
    parsePreviewTrimWindow("0", "30")?.durationSeconds === 30 &&
    parsePreviewTrimWindow("0", "30.001") === null &&
    parsePreviewTrimWindow("20", "10") === null &&
    parsePreviewTrimWindow("-1", "1") === null,
  "El recorte debe aceptar ventanas válidas y rechazar duración, orden o posiciones inválidas."
);

const [
  transcoder,
  trimPolicy,
  streamedSource,
  remoteSource,
  staging,
  uploadRoute,
  stagingRoute,
  stagedPlaybackRoute,
  importRoute,
  removeRoute,
  publicRoute,
  hoverMedia,
  universalCard,
  previewAdminForm,
  trimEditor,
  adminEditor,
  integrity,
  publicationChanges,
  nextConfig,
  nginx,
  envExample,
  packageJson,
] = await Promise.all([
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/streamed-preview-source.ts"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-remove/route.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("next.config.ts"),
  source("ops/nginx/deuna-games.conf.example"),
  source(".env.example"),
  source("package.json"),
]);

assert(
  trimPolicy.includes("MAX_PREVIEW_SOURCE_BYTES = 1024 * 1024 * 1024") &&
    trimPolicy.includes("parsePreviewTrimWindow") &&
    trimPolicy.includes("MAX_PREVIEW_DURATION_SECONDS = 30"),
  "Origen grande y recorte corto deben compartir una única política."
);

assert(
  transcoder.includes('"libvpx-vp9"') &&
    transcoder.includes('"-ss"') &&
    transcoder.includes('"-t"') &&
    transcoder.includes('"-an"') &&
    transcoder.includes("PREFERRED_PREVIEW_BYTES = 1_572_864") &&
    transcoder.includes("width: 400") &&
    transcoder.includes("fps: 15") &&
    transcoder.includes("width: 360") &&
    transcoder.includes("fps: 12") &&
    transcoder.includes("spawn(ffmpegExecutable()") &&
    transcoder.includes("shell: false") &&
    transcoder.includes("inspectSafeEditorialWebm"),
  "La conversión debe seguir recortando una sola vez y generando WebM/VP9 ligero."
);

assert(
  streamedSource.includes("Readable.from") &&
    streamedSource.includes("Transform") &&
    streamedSource.includes("pipeline") &&
    streamedSource.includes("createWriteStream") &&
    streamedSource.includes('mode: 0o600') &&
    streamedSource.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    !streamedSource.includes("arrayBuffer"),
  "La subida local grande debe ir por streaming a disco temporal y nunca materializarse completa en RAM."
);

assert(
  uploadRoute.includes("hasTrustedAdminOrigin") &&
    uploadRoute.includes("resolveAdminSession") &&
    uploadRoute.includes('request.headers.get("content-length")') &&
    uploadRoute.includes("x-deuna-expected-revision") &&
    uploadRoute.includes("x-deuna-trim-start") &&
    uploadRoute.includes("x-deuna-trim-end") &&
    uploadRoute.includes("stageStreamedPreviewSource") &&
    uploadRoute.includes("storeEditorialPreviewVideoFromPath") &&
    uploadRoute.includes("previewClip: upload.publicPath") &&
    uploadRoute.includes("previewMode: undefined") &&
    uploadRoute.includes("youtubePreview: undefined") &&
    !uploadRoute.includes("request.formData()") &&
    !uploadRoute.includes("storeEditorialPreviewVideo("),
  "La ruta local de 1 GiB debe autenticar, validar IN/OUT, transmitir a disco y convertir desde path."
);

assert(
  remoteSource.includes("httpsRequest") &&
    remoteSource.includes("BlockList") &&
    remoteSource.includes("MAX_REDIRECTS = 3") &&
    remoteSource.includes("MAX_REMOTE_PREVIEW_BYTES") &&
    remoteSource.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    remoteSource.includes("pipeline"),
  "La URL directa debe usar el mismo techo de 1 GiB conservando SSRF, DNS y streaming."
);

assert(
  staging.includes("STAGING_TTL_MS = 30 * 60 * 1_000") &&
    staging.includes("MAX_STAGED_SOURCES = 8") &&
    staging.includes("removeStagedEditorialPreviewSource") &&
    stagingRoute.includes("createStagedRemotePreviewSource") &&
    stagedPlaybackRoute.includes('"Accept-Ranges": "bytes"') &&
    stagedPlaybackRoute.includes("removeStagedEditorialPreviewSource"),
  "La URL directa debe mantener staging privado, temporal y reproducible por Range."
);

assert(
  importRoute.includes("parsePreviewTrimWindow") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("previewClip: upload.publicPath") &&
    importRoute.includes("removeStagedEditorialPreviewSource"),
  "La URL directa debe terminar como WebM recortado local y limpiar su staging."
);

assert(
  removeRoute.includes("previewClip: undefined") &&
    removeRoute.includes("previewMode: undefined") &&
    removeRoute.includes("youtubePreview: undefined"),
  "Quitar el preview debe dejar el juego sin origen alternativo oculto."
);

assert(
  publicRoute.includes('"Content-Type": "video/webm"') &&
    publicRoute.includes('"Accept-Ranges": "bytes"') &&
    publicRoute.includes("MAX_VALIDATED_WEBM_CACHE_ENTRIES") &&
    publicRoute.includes("immutable"),
  "El WebM público debe mantener Range, validación y cache inmutable."
);

assert(
  hoverMedia.includes('preload="none"') &&
    hoverMedia.includes("muted") &&
    hoverMedia.includes("loop") &&
    hoverMedia.includes("video.pause()"),
  "La tarjeta no debe precargar el WebM y debe reproducirlo silencioso bajo intención."
);

assert(
  universalCard.includes("PREVIEW_DELAY_MS = 1_000") &&
    universalCard.includes("game.previewClip?.trim()") &&
    universalCard.includes("setPreviewActive(true)") &&
    universalCard.includes("(hover: hover) and (pointer: fine)") &&
    universalCard.includes("prefers-reduced-motion: reduce") &&
    universalCard.includes("requestAnimationFrame") &&
    !universalCard.includes("YouTube") &&
    !universalCard.includes("iframe"),
  "La tarjeta debe esperar 1 segundo y reproducir únicamente el WebM local."
);

assert(
  previewAdminForm.includes('type SourceMode = "file" | "url"') &&
    previewAdminForm.includes("VideoTrimEditor") &&
    previewAdminForm.includes("1 GB") &&
    previewAdminForm.includes("X-Deuna-Expected-Revision") &&
    previewAdminForm.includes("X-Deuna-Trim-Start") &&
    previewAdminForm.includes("X-Deuna-Trim-End") &&
    previewAdminForm.includes("body = preparedSource.file") &&
    !previewAdminForm.includes("new FormData()") &&
    previewAdminForm.includes("Cargar video para recortar") &&
    previewAdminForm.includes("Crear preview WebM con este recorte"),
  "Multimedia debe permitir 1 GiB por streaming sin perder archivo/URL ni recorte visual."
);

assert(
  trimEditor.includes("Línea de tiempo del video") &&
    trimEditor.includes("Marcar IN aquí") &&
    trimEditor.includes("Marcar OUT aquí") &&
    trimEditor.includes("Reproducir recorte") &&
    trimEditor.includes('role="slider"'),
  "El editor debe conservar timeline, IN/OUT, playhead y recorte accesible."
);

assert(
  adminEditor.includes("GamePreviewClipUploadForm") &&
    adminEditor.includes("currentPreview={game.previewClip}"),
  "El editor del juego debe mantener el preview dentro de Multimedia."
);

assert(
  integrity.includes("game.previewClip"),
  "La integridad editorial debe seguir verificando el archivo WebM local."
);

assert(
  publicationChanges.includes("previewClip") &&
    publicationChanges.includes("WebM recortado") &&
    !publicationChanges.includes("youtubePreview") &&
    !publicationChanges.includes("previewMode"),
  "La revisión de publicación debe describir únicamente el WebM recortado."
);

assert(
  nextConfig.includes('"frame-src \'none\'"') &&
    !nextConfig.includes("youtube-nocookie") &&
    !nextConfig.includes("youtube.com"),
  "CSP debe bloquear iframes externos."
);

assert(
  nginx.includes("preview-upload$") &&
    nginx.includes("client_max_body_size 1024m") &&
    nginx.includes("proxy_request_buffering off") &&
    nginx.includes("proxy_send_timeout 600s") &&
    nginx.includes("client_max_body_size 8k"),
  "Sólo preview-upload debe admitir 1 GiB y debe transmitirlo sin buffering de request en Nginx."
);

assert(
  envExample.includes("DEUNA_FFMPEG_PATH") &&
    !envExample.includes("DEUNA_YTDLP") &&
    !packageJson.includes("yt-dlp"),
  "El sistema WebM debe seguir sin dependencias de YouTube."
);

for (const removedPath of [
  "src/components/admin/YouTubeTrimEditor.tsx",
  "src/lib/media/shared-youtube-hover-player.ts",
  "src/lib/media/youtube-preview.ts",
  "src/lib/media/game-card-preview.ts",
  "src/app/api/admin/content/games/[slug]/preview-youtube/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-youtube-remove/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-mode/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-settings/route.ts",
]) {
  assert(
    !(await exists(removedPath)),
    `No debe quedar funcionalidad de YouTube directo: ${removedPath}`
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
  "Preview de video en tarjetas: OK (origen hasta 1 GiB por streaming/URL → recorte IN/OUT <= 30 s → WebM local <= 3 MB)."
);
