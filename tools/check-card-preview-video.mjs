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
  parseYouTubePreview,
  parseYouTubeVideo,
  validateYouTubePreview,
} from "../src/lib/media/youtube-preview.ts";
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
  "La política de preview debe permitir origen local de 1 GiB y salida máxima de 30 s."
);
assert(
  parsePreviewTrimWindow("12.5", "24")?.durationSeconds === 11.5 &&
    parsePreviewTrimWindow("0", "30")?.durationSeconds === 30 &&
    parsePreviewTrimWindow("0", "30.001") === null &&
    parsePreviewTrimWindow("20", "10") === null,
  "IN/OUT debe compartir una única política estricta de 30 segundos."
);

for (const value of [
  "dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "youtu.be/dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "https://www.youtube.com/live/dQw4w9WgXcQ",
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
]) {
  assert(
    parseYouTubeVideo(value)?.videoId === "dQw4w9WgXcQ",
    `El parser debe reconocer el formato YouTube: ${value}`
  );
}
assert(
  parseYouTubeVideo("https://example.com/watch?v=dQw4w9WgXcQ") === null &&
    parseYouTubeVideo("javascript:alert(1)") === null &&
    parseYouTubeVideo("https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ") === null,
  "El modo URL debe aceptar sólo YouTube por HTTP/HTTPS estándar y sin credenciales."
);
const youtubeTrim = parseYouTubePreview(
  "youtube.com/watch?v=dQw4w9WgXcQ",
  12.25,
  29.5
);
assert(
  youtubeTrim?.videoId === "dQw4w9WgXcQ" &&
    youtubeTrim.startSeconds === 12.25 &&
    youtubeTrim.endSeconds === 29.5 &&
    validateYouTubePreview(youtubeTrim),
  "YouTube debe guardar sólo ID y un recorte válido."
);
assert(
  parseYouTubePreview(
    "youtube.com/watch?v=dQw4w9WgXcQ",
    0,
    30.001
  ) === null,
  "YouTube no debe permitir un recorte superior a 30 segundos."
);

const [
  transcoder,
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
  youtubeRoute,
  previewStateRoute,
  publicRoute,
  hoverMedia,
  universalCard,
  previewAdminForm,
  trimEditor,
  youtubeTrimEditor,
  youtubeHoverPlayer,
  cardPreviewResolver,
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
  source("src/app/api/admin/content/games/[slug]/preview-youtube/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-state/route.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/components/admin/YouTubeTrimEditor.tsx"),
  source("src/lib/media/shared-youtube-hover-player.ts"),
  source("src/lib/media/game-card-preview.ts"),
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
  transcoder.includes('"libvpx-vp9"') &&
    transcoder.includes('"-ss"') &&
    transcoder.includes('"-t"') &&
    transcoder.includes('"-an"') &&
    transcoder.includes("spawn(ffmpegExecutable()") &&
    transcoder.includes("shell: false") &&
    transcoder.includes("inspectSafeEditorialWebm"),
  "El archivo local debe seguir recortándose desde el original a WebM/VP9 validado y sin shell."
);
assert(
  proxyGenerator.includes('"libvpx-vp9"') &&
    proxyGenerator.includes("MAX_EDITORIAL_EDIT_PROXY_BYTES") &&
    proxyGenerator.includes("spawn(ffmpegExecutable()") &&
    proxyGenerator.includes("shell: false"),
  "Los códecs locales incompatibles deben conservar el proxy WebM privado."
);
assert(
  streamedSource.includes("Readable.from") &&
    streamedSource.includes("pipeline") &&
    streamedSource.includes("createWriteStream") &&
    streamedSource.includes("expectedBytes: number | null") &&
    streamedSource.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    !streamedSource.includes("arrayBuffer"),
  "La subida local grande debe continuar por streaming, incluso sin Content-Length."
);
assert(
  streamingAuth.includes("hasTrustedAdminOrigin") &&
    streamingAuth.includes("resolveAdminSession"),
  "Las rutas de streaming local deben conservar sesión y origen administrativo confiable."
);
assert(
  uploadRoute.includes("authorizeAdminStreamingMediaRequest") &&
    uploadRoute.includes("stageStreamedPreviewSource") &&
    uploadRoute.includes("storeEditorialPreviewVideoFromPath") &&
    uploadRoute.includes("previewClip: upload.publicPath") &&
    uploadRoute.includes("youtubePreview: undefined") &&
    !uploadRoute.includes("arrayBuffer"),
  "Guardar un archivo local debe activar WebM y retirar el modo YouTube."
);
assert(
  localStagingRoute.includes("createStagedUploadedPreviewSource") &&
    localStagingRoute.includes("ensureStagedEditorialPreviewProxy") &&
    !localStagingRoute.includes("arrayBuffer"),
  "El fallback local debe conservar original + proxy sin cargar 1 GiB en RAM."
);
assert(
  importRoute.includes("resolveStagedEditorialPreviewSource") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("youtubePreview: undefined") &&
    importRoute.includes("removeStagedEditorialPreviewSource"),
  "Un archivo local con proxy debe finalizar desde el original y activar WebM."
);

assert(
  youtubeRoute.includes("authorizeAdminFormRequest") &&
    youtubeRoute.includes("hasExactAdminFormFields") &&
    youtubeRoute.includes("expectedRevisionSchema") &&
    youtubeRoute.includes("parseYouTubePreview") &&
    youtubeRoute.includes("saveGameMediaDraft") &&
    youtubeRoute.includes('previewMode: "youtube"') &&
    youtubeRoute.includes("youtubePreview: preview") &&
    !youtubeRoute.includes("yt-dlp") &&
    !youtubeRoute.includes("downloadPlatformEditorialVideo") &&
    !youtubeRoute.includes("preview-source"),
  "La URL de YouTube debe guardarse por ID/IN/OUT sin descargar ni pasar por el importador de plataformas."
);
assert(
  previewStateRoute.includes("resolveAdminSession") &&
    previewStateRoute.includes("previewMode") &&
    previewStateRoute.includes("youtubePreview") &&
    previewStateRoute.includes('"Cache-Control": "private, no-store, max-age=0"'),
  "El editor debe leer el estado YouTube actual sólo mediante una ruta privada sin cache."
);
assert(
  removeRoute.includes("previewClip: undefined") &&
    removeRoute.includes("previewMode: undefined") &&
    removeRoute.includes("youtubePreview: undefined"),
  "Quitar preview debe eliminar ambos modos."
);

assert(
  previewAdminForm.includes('type SourceMode = "file" | "youtube"') &&
    previewAdminForm.includes("Archivo de mi equipo") &&
    previewAdminForm.includes("URL de YouTube") &&
    previewAdminForm.includes("YouTubeTrimEditor") &&
    previewAdminForm.includes("parseYouTubeVideo") &&
    previewAdminForm.includes("/preview-youtube") &&
    previewAdminForm.includes("preview-state") &&
    previewAdminForm.includes("probeBrowserPlayback") &&
    previewAdminForm.includes("prepareLocalCodecFallback") &&
    previewAdminForm.includes("preview-source-upload") &&
    previewAdminForm.includes("/preview-import") &&
    !previewAdminForm.includes("prepareRemoteSource") &&
    !previewAdminForm.includes("parsePublicVideoUrl") &&
    !previewAdminForm.includes("URL / YouTube / redes") &&
    !previewAdminForm.includes("new FormData()"),
  "La UI debe exponer sólo archivo local o YouTube directo; YouTube no puede caer en el importador genérico."
);
assert(
  youtubeTrimEditor.includes("youtube-nocookie.com") &&
    youtubeTrimEditor.includes('role="slider"') &&
    youtubeTrimEditor.includes("Marcar IN aquí") &&
    youtubeTrimEditor.includes("Marcar OUT aquí") &&
    youtubeTrimEditor.includes("Reproducir recorte") &&
    youtubeTrimEditor.includes("MAX_PREVIEW_DURATION_SECONDS") &&
    youtubeTrimEditor.includes("onError") &&
    youtubeTrimEditor.includes("postMessage"),
  "El editor YouTube debe permitir recorte visual accesible de hasta 30 s con reproductor privacy-enhanced."
);
assert(
  trimEditor.includes("Línea de tiempo del video") &&
    trimEditor.includes("MAX_PREVIEW_DURATION_SECONDS"),
  "El editor local debe conservar su timeline y política compartida."
);

assert(
  cardPreviewResolver.includes('kind: "youtube"') &&
    cardPreviewResolver.includes('kind: "webm"') &&
    cardPreviewResolver.includes("previewMode") &&
    cardPreviewResolver.includes("validateYouTubePreview"),
  "La tarjeta debe resolver explícitamente WebM o YouTube según el borrador/publicación."
);
assert(
  universalCard.includes("resolveGameCardPreview") &&
    universalCard.includes("activateSharedYouTubeHoverPlayer") &&
    universalCard.includes("deactivateSharedYouTubeHoverPlayer") &&
    universalCard.includes("PREVIEW_DELAY_MS = 1_000") &&
    universalCard.includes("(hover: hover) and (pointer: fine)") &&
    universalCard.includes("prefers-reduced-motion: reduce") &&
    universalCard.includes("requestAnimationFrame"),
  "La card debe esperar intención real, respetar movimiento reducido y compartir el reproductor YouTube."
);
assert(
  youtubeHoverPlayer.includes("youtube-nocookie.com") &&
    youtubeHoverPlayer.includes("IDLE_DESTROY_MS") &&
    youtubeHoverPlayer.includes("loadVideoById") &&
    youtubeHoverPlayer.includes("startSeconds") &&
    youtubeHoverPlayer.includes("endSeconds") &&
    youtubeHoverPlayer.includes('sendCommand("mute")') &&
    youtubeHoverPlayer.includes("document.hidden") &&
    youtubeHoverPlayer.includes("prefers-reduced-motion: reduce"),
  "YouTube en cards debe usar un único iframe tardío, mudo, acotado al tramo y destruible por inactividad."
);
assert(
  hoverMedia.includes('preload="none"') &&
    hoverMedia.includes("muted") &&
    hoverMedia.includes("loop"),
  "El fallback WebM debe seguir sin precarga."
);

assert(
  nextConfig.includes('"frame-src https://www.youtube-nocookie.com"') &&
    !nextConfig.includes('frame-src https://www.youtube.com'),
  "CSP debe permitir únicamente el host privacy-enhanced de YouTube para iframes."
);
assert(
  publicationChanges.includes("previewMode") &&
    publicationChanges.includes("youtubePreview") &&
    publicationChanges.includes("WebM local o tramo directo de YouTube"),
  "Publicación debe detectar cambios de modo y recorte YouTube."
);
assert(
  integrity.includes("game.previewClip"),
  "La integridad editorial debe seguir verificando cualquier WebM local conservado."
);
assert(
  adminEditor.includes("GamePreviewClipUploadForm"),
  "El editor del juego debe mantener el preview dentro de Multimedia."
);

assert(
  remoteSource.includes("httpRequest") &&
    remoteSource.includes("httpsRequest") &&
    remoteSource.includes("BlockList") &&
    remoteSource.includes("lookup:") &&
    remoteSource.includes("MAX_REMOTE_PREVIEW_BYTES"),
  "El backend genérico no expuesto por la UI debe conservar SSRF, DNS pinning y límites."
);
assert(
  platformUrl.includes('platform: "youtube"') &&
    platformUrl.includes('platform: "facebook"') &&
    platformUrl.includes("hostnameMatches"),
  "El importador genérico puede permanecer disponible internamente sin mezclarse con la opción URL visible."
);
assert(
  platformSource.includes("spawn(ytDlpExecutable()") &&
    platformSource.includes("shell: false") &&
    platformSource.includes("--max-filesize"),
  "Si el importador interno se usa en el futuro, yt-dlp debe permanecer aislado y limitado."
);
assert(
  workerClient.includes('url.hostname === "127.0.0.1"') &&
    workerClient.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN"),
  "Producción debe mantener el worker de importación sólo por loopback autenticado."
);
assert(
  workerScript.includes('const HOST = "127.0.0.1"') &&
    workerScript.includes("timingSafeEqual") &&
    workerScript.includes("BlockList") &&
    workerScript.includes("activeJob"),
  "El worker genérico debe conservar aislamiento y una sola tarea activa."
);
assert(
  workerWrapper.includes('"--js-runtimes"') &&
    workerWrapper.includes("skip_next") &&
    workerWrapper.includes("node:${NODE_BIN}"),
  "El wrapper de yt-dlp debe conservar runtime único cuando se use fuera del modo YouTube directo."
);
assert(
  workerService.includes("MemoryMax=384M") &&
    workerService.includes("NoNewPrivileges=true") &&
    workerEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN"),
  "El worker debe mantener sus límites operativos."
);

assert(
  staging.includes("STAGING_TTL_MS = 30 * 60 * 1_000") &&
    staging.includes("MAX_STAGED_SOURCES = 8") &&
    staging.includes("removeStagedEditorialPreviewSource") &&
    stagedPlaybackRoute.includes("serveStagedPreviewFile") &&
    stagedHttp.includes('"Accept-Ranges": "bytes"') &&
    proxyRoute.includes("ensureStagedEditorialPreviewProxy") &&
    stagingRoute.includes("createStagedRemotePreviewSource"),
  "El staging existente debe seguir privado, limitado y limpiable."
);
assert(
  publicRoute.includes('"Content-Type": "video/webm"') &&
    publicRoute.includes('"Accept-Ranges": "bytes"') &&
    publicRoute.includes("immutable"),
  "El WebM público debe conservar Range y cache inmutable."
);
assert(
  nginx.includes("(preview-upload|preview-source-upload)$") &&
    nginx.includes("client_max_body_size 1024m") &&
    nginx.includes("proxy_request_buffering off") &&
    nginx.includes("client_max_body_size 8k"),
  "Sólo las rutas locales grandes deben conservar excepción de 1 GiB en Nginx."
);
assert(
  envExample.includes("DEUNA_FFMPEG_PATH") &&
    envExample.includes("DEUNA_YTDLP_PATH") &&
    !packageJson.includes('"yt-dlp"'),
  "FFmpeg/yt-dlp siguen siendo herramientas del servidor, nunca dependencias del reproductor YouTube directo."
);

for (const requiredPath of [
  "src/components/admin/YouTubeTrimEditor.tsx",
  "src/lib/media/shared-youtube-hover-player.ts",
  "src/lib/media/youtube-preview.ts",
  "src/lib/media/game-card-preview.ts",
  "src/app/api/admin/content/games/[slug]/preview-youtube/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-state/route.ts",
]) {
  assert(
    await exists(requiredPath),
    `Falta una pieza del modo YouTube directo: ${requiredPath}`
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
  "Preview de video en tarjetas: OK (archivo local → WebM seguro; URL visible → YouTube directo por ID + IN/OUT <= 30 s, sin yt-dlp ni staging remoto)."
);
