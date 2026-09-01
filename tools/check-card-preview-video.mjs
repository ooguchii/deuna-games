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
  platformUrl,
  platformSource,
  workerClient,
  staging,
  proxyGenerator,
  streamingAuth,
  uploadRoute,
  localStagingRoute,
  stagingRoute,
  stagedPlaybackRoute,
  proxyRoute,
  stagedHttp,
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
  runtimeEnv,
  workerScript,
  workerService,
  workerEnv,
  packageJson,
] = await Promise.all([
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/streamed-preview-source.ts"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/platform-video-url.ts"),
  source("src/lib/media/platform-video-source.ts"),
  source("src/lib/media/media-import-worker-client.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/editorial-preview-proxy.ts"),
  source("src/lib/admin/streaming-media-admin-route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/proxy/route.ts"),
  source("src/lib/media/staged-preview-http.ts"),
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
  source("ops/systemd/runtime.env.example"),
  source("ops/worker/media-import-worker.mjs"),
  source("ops/systemd/deuna-games-media-import.service.example"),
  source("ops/systemd/media-import.env.example"),
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
    transcoder.includes("spawn(ffmpegExecutable()") &&
    transcoder.includes("shell: false") &&
    transcoder.includes("inspectSafeEditorialWebm"),
  "La conversión final debe seguir recortando el original y generando WebM/VP9 ligero."
);

assert(
  streamedSource.includes("Readable.from") &&
    streamedSource.includes("Transform") &&
    streamedSource.includes("pipeline") &&
    streamedSource.includes("createWriteStream") &&
    streamedSource.includes('mode: 0o600') &&
    streamedSource.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    !streamedSource.includes("arrayBuffer"),
  "Las cargas grandes deben ir por streaming a disco temporal y nunca materializarse completas en RAM."
);

assert(
  streamingAuth.includes("hasTrustedAdminOrigin") &&
    streamingAuth.includes("resolveAdminSession") &&
    streamingAuth.includes("authorizeAdminStreamingMediaRequest"),
  "Las rutas de streaming deben compartir sesión administrativa y validación de origen."
);

assert(
  uploadRoute.includes("authorizeAdminStreamingMediaRequest") &&
    uploadRoute.includes('request.headers.get("content-length")') &&
    uploadRoute.includes("x-deuna-trim-start") &&
    uploadRoute.includes("x-deuna-trim-end") &&
    uploadRoute.includes("stageStreamedPreviewSource") &&
    uploadRoute.includes("storeEditorialPreviewVideoFromPath") &&
    uploadRoute.includes("previewClip: upload.publicPath") &&
    !uploadRoute.includes("request.formData()") &&
    !uploadRoute.includes("arrayBuffer"),
  "La ruta final local debe transmitir a disco y recortar desde el original sin buffering grande."
);

assert(
  localStagingRoute.includes("authorizeAdminStreamingMediaRequest") &&
    localStagingRoute.includes("createStagedUploadedPreviewSource") &&
    localStagingRoute.includes("ensureStagedEditorialPreviewProxy") &&
    localStagingRoute.includes('request.headers.get("content-length")') &&
    !localStagingRoute.includes("request.formData()") &&
    !localStagingRoute.includes("arrayBuffer"),
  "El fallback de códec local debe subir por streaming y crear el proxy sin cargar 1 GiB en RAM."
);

assert(
  remoteSource.includes("httpsRequest") &&
    remoteSource.includes("BlockList") &&
    remoteSource.includes("MAX_REDIRECTS = 3") &&
    remoteSource.includes("MAX_REMOTE_PREVIEW_BYTES") &&
    remoteSource.includes("pipeline") &&
    remoteSource.includes("parseSupportedPlatformVideoUrl") &&
    remoteSource.includes("downloadPlatformEditorialVideo") &&
    remoteSource.includes("mediaImportWorkerConfigured") &&
    remoteSource.includes('kind: "direct"'),
  "La URL directa debe conservar SSRF/DNS/streaming y derivar páginas de plataforma al importador aislado."
);

assert(
  platformUrl.includes('platform: "youtube"') &&
    platformUrl.includes('platform: "facebook"') &&
    platformUrl.includes('platform: "instagram"') &&
    platformUrl.includes('platform: "tiktok"') &&
    platformUrl.includes('platform: "vimeo"') &&
    platformUrl.includes('platform: "x"') &&
    platformUrl.includes('platform: "twitch"') &&
    platformUrl.includes('platform: "reddit"') &&
    platformUrl.includes('platform: "rumble"') &&
    platformUrl.includes('platform: "dailymotion"') &&
    platformUrl.includes('platform: "kick"') &&
    platformUrl.includes('platform: "bilibili"') &&
    platformUrl.includes('platform: "loom"') &&
    platformUrl.includes('parsed.protocol !== "https:"') &&
    platformUrl.includes("hostnameMatches"),
  "Los enlaces sociales deben usar HTTPS y una allowlist explícita y amplia de plataformas públicas."
);

assert(
  platformSource.includes("parseSupportedPlatformVideoUrl") &&
    platformSource.includes("spawn(ytDlpExecutable()") &&
    platformSource.includes("shell: false") &&
    platformSource.includes("512 * 1024 * 1024") &&
    platformSource.includes("mediaImportWorkerConfigured") &&
    platformSource.includes('kind: "platform"') &&
    platformSource.includes('"--no-playlist"') &&
    platformSource.includes('"--max-filesize"'),
  "Las plataformas deben preparar una sola copia limitada mediante yt-dlp sin shell, playlists ni descargas ilimitadas."
);

assert(
  workerClient.includes('url.hostname === "127.0.0.1"') &&
    workerClient.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN") &&
    workerClient.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    workerClient.includes("pipeline") &&
    workerClient.includes("createWriteStream") &&
    workerClient.includes('kind: "direct"') &&
    workerClient.includes('kind: "platform"'),
  "El runtime público sólo debe comunicarse con el worker autenticado por loopback y recibir archivos por streaming."
);

assert(
  workerScript.includes('const HOST = "127.0.0.1"') &&
    workerScript.includes("timingSafeEqual") &&
    workerScript.includes("BlockList") &&
    workerScript.includes("platformHosts") &&
    workerScript.includes('"youtube.com"') &&
    workerScript.includes('"facebook.com"') &&
    workerScript.includes('"instagram.com"') &&
    workerScript.includes('"reddit.com"') &&
    workerScript.includes('"rumble.com"') &&
    workerScript.includes('"--no-playlist"') &&
    workerScript.includes('"--max-filesize"') &&
    workerScript.includes("activeJob") &&
    workerScript.includes("createReadStream") &&
    workerScript.includes("pipeline"),
  "El worker debe quedar autenticado, limitado a loopback, protegido contra SSRF y con una sola importación concurrente."
);

assert(
  workerService.includes("CPUQuota=35%") &&
    workerService.includes("MemoryMax=384M") &&
    workerService.includes("IPAddressDeny=10.0.0.0/8") &&
    workerService.includes("NoNewPrivileges=true") &&
    workerService.includes("ProtectSystem=strict") &&
    workerEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN") &&
    workerEnv.includes("DEUNA_YTDLP_PATH") &&
    runtimeEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_URL=http://127.0.0.1:3101/source") &&
    runtimeEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN"),
  "Producción debe aislar el worker con límites de recursos y un token compartido sólo por loopback."
);

assert(
  staging.includes("MAX_STAGED_SOURCES = 8") &&
    staging.includes("createStagedRemotePreviewSource") &&
    staging.includes("createStagedUploadedPreviewSource") &&
    staging.includes("ensureStagedEditorialPreviewProxy") &&
    staging.includes("resolveStagedEditorialPreviewProxy") &&
    staging.includes("removeStagedEditorialPreviewSource") &&
    stagingRoute.includes("createStagedRemotePreviewSource"),
  "Archivo incompatible, URL directa y plataforma deben reutilizar el mismo staging privado y temporal."
);

assert(
  proxyGenerator.includes("createEditorialPreviewProxy") &&
    proxyGenerator.includes('"libvpx-vp9"') &&
    proxyGenerator.includes("fps=8") &&
    proxyGenerator.includes('"-an"') &&
    proxyGenerator.includes("MAX_EDITORIAL_EDIT_PROXY_BYTES") &&
    proxyGenerator.includes("shell: false"),
  "El proxy debe ser pequeño, sin audio y barato de codificar; nunca debe ser el archivo público final."
);

assert(
  stagedHttp.includes('"Accept-Ranges": "bytes"') &&
    stagedHttp.includes('"Cache-Control": "private, no-store, max-age=0"') &&
    stagedPlaybackRoute.includes("serveStagedPreviewFile") &&
    stagedPlaybackRoute.includes("removeStagedEditorialPreviewSource") &&
    proxyRoute.includes("ensureStagedEditorialPreviewProxy") &&
    proxyRoute.includes("resolveStagedEditorialPreviewProxy") &&
    proxyRoute.includes("serveStagedPreviewFile"),
  "Original temporal y proxy deben servirse autenticados, privados y con Range para scrubbing."
);

assert(
  importRoute.includes("parsePreviewTrimWindow") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("previewClip: upload.publicPath") &&
    importRoute.includes("removeStagedEditorialPreviewSource"),
  "Tras editar, el recorte final debe volver siempre al original staged."
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
    universalCard.includes("prefers-reduced-motion: reduce") &&
    !universalCard.includes("YouTube") &&
    !universalCard.includes("iframe"),
  "La tarjeta pública debe seguir usando únicamente el WebM local después de intención."
);

assert(
  previewAdminForm.includes('type SourceMode = "file" | "url"') &&
    previewAdminForm.includes("VideoTrimEditor") &&
    previewAdminForm.includes("probeBrowserPlayback") &&
    previewAdminForm.includes("preview-source-upload") &&
    previewAdminForm.includes("createProxyForStagedToken") &&
    previewAdminForm.includes("URL / YouTube / redes") &&
    previewAdminForm.includes("Facebook, Instagram, TikTok") &&
    previewAdminForm.includes("Cargar video o enlace para recortar") &&
    previewAdminForm.includes("Crear preview WebM con este recorte") &&
    previewAdminForm.includes("body = preparedSource.file") &&
    !previewAdminForm.includes("new FormData()"),
  "Multimedia debe aceptar archivo, URL directa o plataforma sin perder el recorte visual ni el fallback de códec."
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
  integrity.includes("game.previewClip") &&
    publicationChanges.includes("previewClip") &&
    publicationChanges.includes("WebM recortado"),
  "Integridad y publicación deben seguir trabajando sólo con el WebM final."
);

assert(
  nextConfig.includes('"frame-src \'none\'"') &&
    !nextConfig.includes("youtube-nocookie") &&
    !nextConfig.includes("youtube.com"),
  "CSP debe seguir bloqueando iframes externos: las redes sólo existen en la importación administrativa."
);

assert(
  nginx.includes("preview-(upload|source-upload)$") &&
    nginx.includes("client_max_body_size 1024m") &&
    nginx.includes("proxy_request_buffering off") &&
    nginx.includes("proxy_send_timeout 1200s") &&
    nginx.includes("client_max_body_size 8k"),
  "Sólo las rutas de fuente grande deben admitir 1 GiB sin buffering en Nginx."
);

assert(
  envExample.includes("DEUNA_FFMPEG_PATH") &&
    envExample.includes("DEUNA_YTDLP_PATH") &&
    envExample.includes("DEUNA_MEDIA_IMPORT_WORKER_URL") &&
    !packageJson.includes('"yt-dlp"'),
  "yt-dlp debe seguir siendo una herramienta externa aislada, no una dependencia npm ni código del frontend."
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
    `No debe volver el reproductor/preview específico de YouTube: ${removedPath}`
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
  "Preview de video en tarjetas: OK (archivo/URL/plataforma pública → staging privado → proxy de edición si hace falta → IN/OUT <= 30 s → WebM final local <= 3 MB)."
);
