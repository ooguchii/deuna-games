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
  proxyGenerator,
  adminEditor,
  integrity,
  publicationChanges,
  nextConfig,
  nginx,
  envExample,
  packageJson,
  workerScript,
  workerWrapper,
  workerService,
  workerEnv,
] = await Promise.all([
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/streamed-preview-source.ts"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/platform-video-url.ts"),
  source("src/lib/media/platform-video-source.ts"),
  source("src/lib/media/media-import-worker-client.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
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
  source("src/lib/media/editorial-preview-proxy.ts"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("next.config.ts"),
  source("ops/nginx/deuna-games.conf.example"),
  source(".env.example"),
  source("package.json"),
  source("ops/worker/media-import-worker.mjs"),
  source("ops/worker/yt-dlp-node-wrapper.sh"),
  source("ops/systemd/deuna-games-media-import.service.example"),
  source("ops/systemd/media-import.env.example"),
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
  "La conversión final debe recortar desde el original y generar WebM/VP9 ligero y validado."
);

assert(
  proxyGenerator.includes('"libvpx-vp9"') &&
    proxyGenerator.includes('"-an"') &&
    proxyGenerator.includes("MAX_EDITORIAL_EDIT_PROXY_BYTES") &&
    proxyGenerator.includes("PROXY_TIMEOUT_MS") &&
    proxyGenerator.includes("spawn(ffmpegExecutable()") &&
    proxyGenerator.includes("shell: false"),
  "Los códecs que el navegador no reproduce deben usar un proxy WebM privado y acotado sólo para editar."
);

assert(
  streamedSource.includes("Readable.from") &&
    streamedSource.includes("Transform") &&
    streamedSource.includes("pipeline") &&
    streamedSource.includes("createWriteStream") &&
    streamedSource.includes('mode: 0o600') &&
    streamedSource.includes("expectedBytes: number | null") &&
    streamedSource.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    !streamedSource.includes("arrayBuffer"),
  "La subida local grande debe ir por streaming a disco temporal, incluso sin Content-Length, y nunca materializarse completa en RAM."
);

assert(
  streamingAuth.includes("hasTrustedAdminOrigin") &&
    streamingAuth.includes("resolveAdminSession") &&
    streamingAuth.includes("getAdminSessionCookieName") &&
    streamingAuth.includes("adminRedirect"),
  "Las rutas de streaming deben compartir autenticación de sesión y origen confiable."
);

assert(
  uploadRoute.includes("authorizeAdminStreamingMediaRequest") &&
    uploadRoute.includes('request.headers.get("content-length")') &&
    uploadRoute.includes("x-deuna-expected-revision") &&
    uploadRoute.includes("x-deuna-trim-start") &&
    uploadRoute.includes("x-deuna-trim-end") &&
    uploadRoute.includes("stageStreamedPreviewSource") &&
    uploadRoute.includes("storeEditorialPreviewVideoFromPath") &&
    uploadRoute.includes("previewClip: upload.publicPath") &&
    !uploadRoute.includes("request.formData()") &&
    !uploadRoute.includes("arrayBuffer"),
  "El guardado local debe autenticar, validar IN/OUT, transmitir hasta 1 GiB a disco y convertir desde path."
);

assert(
  localStagingRoute.includes("authorizeAdminStreamingMediaRequest") &&
    localStagingRoute.includes("createStagedUploadedPreviewSource") &&
    localStagingRoute.includes("ensureStagedEditorialPreviewProxy") &&
    localStagingRoute.includes("x-deuna-source-extension") &&
    localStagingRoute.includes('request.headers.get("content-length")') &&
    !localStagingRoute.includes("request.formData()") &&
    !localStagingRoute.includes("arrayBuffer"),
  "El fallback local debe subir por streaming, conservar el original y crear un proxy de edición compatible."
);

assert(
  remoteSource.includes("httpRequest") &&
    remoteSource.includes("httpsRequest") &&
    remoteSource.includes("BlockList") &&
    remoteSource.includes("MAX_REDIRECTS = 3") &&
    remoteSource.includes("MAX_REMOTE_PREVIEW_BYTES") &&
    remoteSource.includes("application/octet-stream") &&
    remoteSource.includes("binary/octet-stream") &&
    remoteSource.includes("lookup:") &&
    remoteSource.includes("mediaImportWorkerConfigured") &&
    remoteSource.includes('kind: "direct"'),
  "La URL directa debe admitir HTTP/HTTPS públicos y CDNs binarios manteniendo SSRF, DNS pinning, redirecciones validadas y streaming de 1 GiB."
);

assert(
  platformUrl.includes('platform: "youtube"') &&
    platformUrl.includes('platform: "facebook"') &&
    platformUrl.includes('platform: "instagram"') &&
    platformUrl.includes('platform: "tiktok"') &&
    platformUrl.includes('platform: "vimeo"') &&
    platformUrl.includes('platform: "x"') &&
    platformUrl.includes('platform: "twitch"') &&
    platformUrl.includes('platform: "dailymotion"') &&
    platformUrl.includes('platform: "streamable"') &&
    platformUrl.includes('platform: "kick"') &&
    platformUrl.includes('"fb.com"') &&
    platformUrl.includes('"instagr.am"') &&
    platformUrl.includes('parsed.protocol === "http:"') &&
    platformUrl.includes('parsed.protocol === "https:"') &&
    platformUrl.includes("hostnameMatches"),
  "Los enlaces de plataforma deben aceptar HTTP/HTTPS por puertos estándar y quedar limitados a una allowlist explícita."
);

assert(
  platformSource.includes("parseSupportedPlatformVideoUrl") &&
    platformSource.includes("spawn(ytDlpExecutable()") &&
    platformSource.includes("shell: false") &&
    platformSource.includes("512 * 1024 * 1024") &&
    platformSource.includes("mediaImportWorkerConfigured") &&
    platformSource.includes('kind: "platform"') &&
    platformSource.includes("--js-runtimes") &&
    platformSource.includes("DEUNA_YTDLP_JS_RUNTIME") &&
    platformSource.includes("vcodec^=avc1") &&
    platformSource.includes("--no-playlist") &&
    platformSource.includes("--max-filesize"),
  "Las plataformas deben usar yt-dlp sin shell, runtime JavaScript explícito, formato reproducible y límites de descarga."
);

assert(
  workerClient.includes('url.hostname === "127.0.0.1"') &&
    workerClient.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN") &&
    workerClient.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    workerClient.includes("pipeline") &&
    workerClient.includes("createWriteStream") &&
    workerClient.includes('kind: "direct"') &&
    workerClient.includes('kind: "platform"'),
  "El runtime público sólo debe comunicarse con el worker multimedia autenticado por loopback y recibir archivos por streaming."
);

assert(
  workerScript.includes('const HOST = "127.0.0.1"') &&
    workerScript.includes("timingSafeEqual") &&
    workerScript.includes("BlockList") &&
    workerScript.includes("httpRequest") &&
    workerScript.includes("httpsRequest") &&
    workerScript.includes("application/octet-stream") &&
    workerScript.includes("platformHosts") &&
    workerScript.includes('"fb.com"') &&
    workerScript.includes('"instagr.am"') &&
    workerScript.includes('"--js-runtimes"') &&
    workerScript.includes("DEUNA_YTDLP_JS_RUNTIME") &&
    workerScript.includes("vcodec^=avc1") &&
    workerScript.includes('"--no-playlist"') &&
    workerScript.includes('"--max-filesize"') &&
    workerScript.includes('"512M"') &&
    workerScript.includes("activeJob") &&
    workerScript.includes("createReadStream") &&
    workerScript.includes("pipeline"),
  "El worker de producción debe tener la misma compatibilidad HTTP/plataformas que desarrollo sin perder aislamiento ni límites."
);

assert(
  workerWrapper.includes('NODE_BIN="${DEUNA_NODE_BINARY:-/usr/bin/node}"') &&
    workerWrapper.includes('"--js-runtimes"') &&
    workerWrapper.includes("skip_next") &&
    workerWrapper.includes('node:${NODE_BIN}'),
  "El wrapper de yt-dlp debe fijar una única ruta absoluta a Node y eliminar declaraciones duplicadas del runtime."
);

assert(
  workerService.includes("CPUQuota=35%") &&
    workerService.includes("MemoryMax=384M") &&
    workerService.includes("IPAddressDeny=10.0.0.0/8") &&
    workerService.includes("NoNewPrivileges=true") &&
    workerEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN") &&
    workerEnv.includes("DEUNA_YTDLP_PATH"),
  "El worker de producción debe conservar límites de CPU/memoria, bloqueo de redes privadas y secreto separado."
);

assert(
  staging.includes("STAGING_TTL_MS = 30 * 60 * 1_000") &&
    staging.includes("MAX_STAGED_SOURCES = 8") &&
    staging.includes("removeStagedEditorialPreviewSource") &&
    staging.includes("parseSupportedPlatformVideoUrl") &&
    staging.includes("downloadPlatformEditorialVideo") &&
    staging.includes("createStagedUploadedPreviewSource") &&
    staging.includes("ensureStagedEditorialPreviewProxy") &&
    staging.includes("resolveStagedEditorialPreviewProxy") &&
    stagingRoute.includes("createStagedRemotePreviewSource") &&
    stagedPlaybackRoute.includes("serveStagedPreviewFile") &&
    stagedPlaybackRoute.includes("removeStagedEditorialPreviewSource") &&
    stagedHttp.includes('"Accept-Ranges": "bytes"') &&
    stagedHttp.includes('status: 206') &&
    stagedHttp.includes('status: 416'),
  "Archivo local, URL directa y plataformas deben compartir staging privado con limpieza y reproducción Range."
);

assert(
  proxyRoute.includes("resolveStagedEditorialPreviewProxy") &&
    proxyRoute.includes("ensureStagedEditorialPreviewProxy") &&
    proxyRoute.includes("resolveStagedEditorialPreviewSource") &&
    proxyRoute.includes("serveStagedPreviewFile") &&
    proxyRoute.includes("expectedRevision"),
  "El proxy de edición debe quedar privado, ligado a sesión/juego/revisión y servirse por Range."
);

assert(
  importRoute.includes("parsePreviewTrimWindow") &&
    importRoute.includes("resolveStagedEditorialPreviewSource") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("previewClip: upload.publicPath") &&
    importRoute.includes("removeStagedEditorialPreviewSource"),
  "Toda fuente staged, incluido un archivo local con proxy, debe recortarse desde el original y limpiar el staging."
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
  "La tarjeta debe esperar 1 segundo y reproducir únicamente el WebM local, nunca un reproductor externo."
);

assert(
  previewAdminForm.includes('type SourceMode = "file" | "url"') &&
    previewAdminForm.includes("VideoTrimEditor") &&
    previewAdminForm.includes("probeBrowserPlayback") &&
    previewAdminForm.includes("prepareLocalCodecFallback") &&
    previewAdminForm.includes("preview-source-upload") &&
    previewAdminForm.includes("createProxyForStagedToken") &&
    previewAdminForm.includes("parsePublicVideoUrl") &&
    previewAdminForm.includes('parsedUrl.protocol === "http:"') &&
    previewAdminForm.includes('parsedUrl.protocol === "https:"') &&
    previewAdminForm.includes("X-Deuna-Expected-Revision") &&
    previewAdminForm.includes("X-Deuna-Trim-Start") &&
    previewAdminForm.includes("X-Deuna-Trim-End") &&
    previewAdminForm.includes("body = preparedSource.file") &&
    previewAdminForm.includes("/preview-import") &&
    !previewAdminForm.includes("new FormData()") &&
    previewAdminForm.includes("URL / YouTube / redes") &&
    previewAdminForm.includes("Crear preview WebM con este recorte"),
  "La UI debe cubrir archivo local, fallback de códec, URL HTTP/HTTPS y plataformas con un único editor visual de recorte."
);

assert(
  trimEditor.includes("Línea de tiempo del video") &&
    trimEditor.includes("Marcar IN aquí") &&
    trimEditor.includes("Marcar OUT aquí") &&
    trimEditor.includes("Reproducir recorte") &&
    trimEditor.includes('role="slider"') &&
    trimEditor.includes("MAX_PREVIEW_DURATION_SECONDS"),
  "El editor debe conservar timeline, IN/OUT, playhead, teclado y la política única de 30 segundos."
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
  "CSP debe seguir bloqueando iframes externos: las plataformas sólo existen en la importación administrativa."
);

assert(
  nginx.includes("(preview-upload|preview-source-upload)$") &&
    nginx.includes("client_max_body_size 1024m") &&
    nginx.includes("proxy_request_buffering off") &&
    nginx.includes("proxy_send_timeout 600s") &&
    nginx.includes("client_max_body_size 8k"),
  "Las dos rutas locales de streaming deben admitir 1 GiB sin buffering; el resto del API admin debe conservar el límite pequeño."
);

assert(
  envExample.includes("DEUNA_FFMPEG_PATH") &&
    envExample.includes("DEUNA_YTDLP_PATH") &&
    envExample.includes("DEUNA_MEDIA_IMPORT_WORKER_URL") &&
    envExample.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN") &&
    !packageJson.includes('"yt-dlp"'),
  "FFmpeg debe seguir siendo el conversor final y yt-dlp una herramienta editorial externa/aislada, no una dependencia del frontend ni del WebM público."
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
    `No debe volver el reproductor/preview YouTube específico: ${removedPath}`
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
  "Preview de video en tarjetas: OK (local directo/fallback + URL HTTP/HTTPS + plataformas → staging privado → recorte IN/OUT <= 30 s desde original → WebM local <= 3 MB)."
);
