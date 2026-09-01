import { readFile } from "node:fs/promises";
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
  parseYouTubeVideoUrl,
} from "../src/lib/media/youtube-url.ts";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
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
  "El preview público debe mantener un límite estricto de 3 MB."
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

const youtubeWatch = parseYouTubeVideoUrl(
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
);
const youtubeShort = parseYouTubeVideoUrl(
  "https://youtu.be/dQw4w9WgXcQ?t=20"
);
const youtubeShorts = parseYouTubeVideoUrl(
  "https://www.youtube.com/shorts/dQw4w9WgXcQ"
);
assert(
  youtubeWatch?.videoId === "dQw4w9WgXcQ" &&
    youtubeShort?.videoId === "dQw4w9WgXcQ" &&
    youtubeShorts?.videoId === "dQw4w9WgXcQ" &&
    parseYouTubeVideoUrl("http://youtube.com/watch?v=dQw4w9WgXcQ") === null &&
    parseYouTubeVideoUrl("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ") === null &&
    parseYouTubeVideoUrl("https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ") === null &&
    parseYouTubeVideoUrl("https://youtube.com:444/watch?v=dQw4w9WgXcQ") === null,
  "El parser de YouTube debe aceptar sólo hosts HTTPS exactos e IDs válidos, sin credenciales ni puertos alternativos."
);

const [
  schema,
  typeModel,
  transcoder,
  trimPolicy,
  remoteSource,
  staging,
  youtubeUrlSource,
  youtubeImporter,
  uploadRoute,
  stagingRoute,
  stagedPlaybackRoute,
  importRoute,
  youtubeRoute,
  mediaAuth,
  mediaRequestSecurity,
  publicRoute,
  hoverMedia,
  universalCard,
  previewAdminForm,
  trimEditor,
  youtubeTrimEditor,
  adminEditor,
  integrity,
  publicationChanges,
  nginx,
  envExample,
  runtimeEnvExample,
  nextConfig,
] = await Promise.all([
  source("src/lib/admin/content-validation.ts"),
  source("src/types/game.ts"),
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/youtube-url.ts"),
  source("src/lib/media/youtube-video-source.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-youtube/route.ts"),
  source("src/lib/admin/media-admin-route.ts"),
  source("src/lib/admin/media-request-security.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/components/admin/YouTubeTrimEditor.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("ops/nginx/deuna-games.conf.example"),
  source(".env.example"),
  source("ops/systemd/runtime.env.example"),
  source("next.config.ts"),
]);

assert(
  schema.includes("previewClip: localPreviewClipSchema.optional()") &&
    schema.includes("\\.webm"),
  "El payload editorial del juego debe aceptar únicamente previews WebM locales validados."
);
assert(
  typeModel.includes("previewClip?: string"),
  "El modelo público del juego debe transportar el preview opcional."
);
assert(
  trimPolicy.includes("parsePreviewTrimWindow") &&
    trimPolicy.includes("MAX_PREVIEW_DURATION_SECONDS = 30") &&
    trimPolicy.includes("MAX_PREVIEW_SOURCE_POSITION_SECONDS = 86_400"),
  "La política de recorte debe ser compartible por cliente y servidor."
);
assert(
  transcoder.includes('"libvpx-vp9"') &&
    transcoder.includes('"-ss"') &&
    transcoder.includes("formatFfmpegSeconds(trim.startSeconds)") &&
    transcoder.includes("formatFfmpegSeconds(trim.durationSeconds)") &&
    transcoder.includes('"0:v:0"') &&
    transcoder.includes('"-an"') &&
    transcoder.includes('"-sn"') &&
    transcoder.includes('"-dn"') &&
    transcoder.includes("PREFERRED_PREVIEW_BYTES = 1_572_864") &&
    transcoder.includes("width: 400") &&
    transcoder.includes("fps: 15") &&
    transcoder.includes("width: 360") &&
    transcoder.includes("fps: 12") &&
    transcoder.includes("storeEditorialPreviewVideoFromPath") &&
    transcoder.includes("assertSafeSourcePath") &&
    !transcoder.includes("downloadRemoteEditorialVideo") &&
    transcoder.includes("spawn(ffmpegExecutable()") &&
    transcoder.includes("shell: false") &&
    transcoder.includes("inspectSafeEditorialWebm"),
  "La conversión debe trabajar sólo sobre archivos locales seguros, recortar antes de codificar y generar VP9 silencioso."
);
assert(
  uploadRoute.includes("hasExactAdminMediaFormFields") &&
    uploadRoute.includes('"startSeconds"') &&
    uploadRoute.includes('"endSeconds"') &&
    uploadRoute.includes('"video"') &&
    uploadRoute.includes("parsePreviewTrimWindow") &&
    uploadRoute.includes("MAX_ADMIN_PREVIEW_REQUEST_BYTES") &&
    uploadRoute.includes("saveGameMediaDraft") &&
    uploadRoute.includes("storeEditorialPreviewVideo"),
  "La carga local debe validar recorte, campos exactos, concurrencia y guardar sólo el WebM en borrador."
);
assert(
  remoteSource.includes("httpsRequest") &&
    remoteSource.includes("lookup") &&
    remoteSource.includes("BlockList") &&
    remoteSource.includes('url.protocol !== "https:"') &&
    remoteSource.includes("url.username") &&
    remoteSource.includes("url.password") &&
    remoteSource.includes('url.port !== "443"') &&
    remoteSource.includes("MAX_REDIRECTS = 3") &&
    remoteSource.includes("MAX_REMOTE_PREVIEW_BYTES") &&
    remoteSource.includes("createWriteStream") &&
    remoteSource.includes("pipeline") &&
    remoteSource.includes("resolved.address") &&
    remoteSource.includes("allowedContentTypes"),
  "La importación remota directa debe impedir SSRF, fijar DNS público, limitar redirecciones/tamaño y escribir el origen en streaming."
);
assert(
  staging.includes("randomBytes(24)") &&
    staging.includes("STAGING_TTL_MS = 30 * 60 * 1_000") &&
    staging.includes("MAX_STAGED_SOURCES = 8") &&
    staging.includes("downloadRemoteEditorialVideo") &&
    staging.includes("createStagedRemotePreviewSource") &&
    staging.includes("resolveStagedEditorialPreviewSource") &&
    staging.includes("removeStagedEditorialPreviewSource") &&
    staging.includes("tokenFromArtifact") &&
    staging.includes("artifactIsAbandoned") &&
    staging.includes("PART_SUFFIX") &&
    staging.includes("stats.isSymbolicLink()"),
  "La preview remota directa debe usar staging temporal opaco, acotado, con vencimiento y limpieza de restos interrumpidos."
);
assert(
  stagingRoute.includes("authorizeAdminFormRequest") &&
    stagingRoute.includes("hasExactAdminFormFields") &&
    stagingRoute.includes('"expectedRevision"') &&
    stagingRoute.includes('"url"') &&
    stagingRoute.includes("createStagedRemotePreviewSource") &&
    stagingRoute.includes("src:") &&
    stagingRoute.includes("expiresAt"),
  "La URL directa debe prepararse mediante un endpoint administrativo pequeño antes de mostrarla en el editor."
);
assert(
  stagedPlaybackRoute.includes("resolveAdminSession") &&
    stagedPlaybackRoute.includes("resolveStagedEditorialPreviewSource") &&
    stagedPlaybackRoute.includes("createReadStream") &&
    stagedPlaybackRoute.includes('"Accept-Ranges": "bytes"') &&
    stagedPlaybackRoute.includes("Content-Range") &&
    stagedPlaybackRoute.includes("export async function DELETE") &&
    stagedPlaybackRoute.includes("removeStagedEditorialPreviewSource") &&
    stagedPlaybackRoute.includes('"private, no-store, max-age=0"'),
  "La fuente temporal debe reproducirse sólo con sesión administrativa, por streaming/rangos y poder eliminarse al abandonar el editor."
);
assert(
  importRoute.includes("authorizeAdminFormRequest") &&
    importRoute.includes("hasExactAdminFormFields") &&
    importRoute.includes('"sourceToken"') &&
    !importRoute.includes('"url"') &&
    importRoute.includes('"startSeconds"') &&
    importRoute.includes('"endSeconds"') &&
    importRoute.includes("parsePreviewTrimWindow") &&
    importRoute.includes("resolveStagedEditorialPreviewSource") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("removeStagedEditorialPreviewSource") &&
    importRoute.includes("saveGameMediaDraft") &&
    !importRoute.includes("spawn("),
  "Confirmar una URL directa debe reutilizar el staging ya previsualizado, sin descargar de nuevo ni entregar la URL a FFmpeg."
);
assert(
  youtubeUrlSource.includes("YOUTUBE_VIDEO_ID_PATTERN") &&
    youtubeUrlSource.includes('url.protocol !== "https:"') &&
    youtubeUrlSource.includes("youtubeHosts") &&
    youtubeUrlSource.includes("canonicalUrl"),
  "YouTube debe usar un parser de URL dedicado y estricto en vez del descargador genérico de URLs."
);
assert(
  youtubeImporter.includes('process.env.DEUNA_YTDLP_PATH') &&
    youtubeImporter.includes('"--no-playlist"') &&
    youtubeImporter.includes('"--concurrent-fragments"') &&
    youtubeImporter.includes('"1"') &&
    youtubeImporter.includes('"--limit-rate"') &&
    youtubeImporter.includes('YOUTUBE_DOWNLOAD_RATE = "6M"') &&
    youtubeImporter.includes('"--download-sections"') &&
    youtubeImporter.includes('"--force-keyframes-at-cuts"') &&
    youtubeImporter.includes('"bestvideo[height<=480]/best[height<=480]/worstvideo"') &&
    youtubeImporter.includes('"--max-filesize"') &&
    youtubeImporter.includes('"64M"') &&
    youtubeImporter.includes("youtubeImportActive") &&
    youtubeImporter.includes("storeEditorialPreviewVideoFromPath") &&
    youtubeImporter.includes("mkdtemp") &&
    youtubeImporter.includes("recursive: true") &&
    youtubeImporter.includes("spawn(ytDlpExecutable()") &&
    youtubeImporter.includes("shell: false"),
  "YouTube debe descargar sólo el tramo confirmado, con una importación a la vez, red/calidad acotadas, sin shell y limpiando temporales."
);
assert(
  youtubeRoute.includes("authorizeAdminFormRequest") &&
    youtubeRoute.includes("hasExactAdminFormFields") &&
    youtubeRoute.includes('"youtubeUrl"') &&
    youtubeRoute.includes('"startSeconds"') &&
    youtubeRoute.includes('"endSeconds"') &&
    youtubeRoute.includes("parseYouTubeVideoUrl") &&
    youtubeRoute.includes("parsePreviewTrimWindow") &&
    youtubeRoute.includes("storeEditorialPreviewVideoFromYouTube") &&
    youtubeRoute.includes("saveGameMediaDraft"),
  "La confirmación de YouTube debe validar sesión, revisión, URL y recorte antes de guardar sólo el WebM editorial."
);
assert(
  previewAdminForm.includes('type SourceMode = "file" | "url" | "youtube"') &&
    previewAdminForm.includes("VideoTrimEditor") &&
    previewAdminForm.includes("YouTubeTrimEditor") &&
    previewAdminForm.includes("parseYouTubeVideoUrl") &&
    previewAdminForm.includes("URL.createObjectURL") &&
    previewAdminForm.includes("/preview-source") &&
    previewAdminForm.includes("sourceToken") &&
    previewAdminForm.includes("/preview-import") &&
    previewAdminForm.includes("/preview-youtube") &&
    previewAdminForm.includes("Reemplazar con este recorte"),
  "El workspace debe mostrar una preview real para archivo, URL directa o YouTube y confirmar cada origen por su ruta segura."
);
assert(
  trimEditor.includes("Línea de tiempo del video") &&
    trimEditor.includes("handleStartPointerMove") &&
    trimEditor.includes("handleEndPointerMove") &&
    trimEditor.includes("Marcar IN aquí") &&
    trimEditor.includes("Marcar OUT aquí") &&
    trimEditor.includes("Reproducir recorte") &&
    trimEditor.includes("onLoadedMetadata") &&
    trimEditor.includes("MAX_PREVIEW_DURATION_SECONDS") &&
    trimEditor.includes("parsePreviewTrimWindow") &&
    trimEditor.includes('role="slider"') &&
    trimEditor.includes('aria-orientation="horizontal"') &&
    trimEditor.includes("aria-valuetext"),
  "El recortador local/remoto debe tener video, timeline, tiradores IN/OUT accesibles, ajuste fino y reproducción del tramo elegido."
);
assert(
  youtubeTrimEditor.includes("https://www.youtube-nocookie.com") &&
    youtubeTrimEditor.includes('loading="lazy"') &&
    youtubeTrimEditor.includes("postMessage") &&
    youtubeTrimEditor.includes("ALLOWED_MESSAGE_ORIGINS") &&
    youtubeTrimEditor.includes("MAX_PREVIEW_DURATION_SECONDS") &&
    youtubeTrimEditor.includes("parsePreviewTrimWindow") &&
    youtubeTrimEditor.includes("Marcar IN aquí") &&
    youtubeTrimEditor.includes("Marcar OUT aquí") &&
    youtubeTrimEditor.includes("Reproducir recorte") &&
    youtubeTrimEditor.includes('role="slider"') &&
    !youtubeTrimEditor.includes("yt-dlp"),
  "La edición de YouTube debe usar sólo un iframe privado lazy y el mismo recorte visual; nunca debe descargar el video desde el navegador."
);
assert(
  mediaAuth.includes("maximumBytes?: number") &&
    mediaRequestSecurity.includes("MAX_ADMIN_MEDIA_REQUEST_BYTES") &&
    mediaRequestSecurity.includes("MAX_ADMIN_PREVIEW_REQUEST_BYTES") &&
    mediaRequestSecurity.includes("Math.min") &&
    mediaRequestSecurity.includes("hasTrustedAdminOrigin"),
  "El límite grande debe ser una excepción explícita sin relajar las cargas multimedia normales."
);
assert(
  publicRoute.includes('"Content-Type": "video/webm"') &&
    publicRoute.includes('"Accept-Ranges": "bytes"') &&
    publicRoute.includes("Content-Range") &&
    publicRoute.includes("inspectSafeEditorialWebm") &&
    publicRoute.includes("MAX_VALIDATED_WEBM_CACHE_ENTRIES") &&
    publicRoute.includes("validateWebmForServing") &&
    publicRoute.includes("readFileRange") &&
    publicRoute.includes('ETag: `"${filename}"`') &&
    publicRoute.includes("immutable"),
  "La ruta pública debe validar una vez por identidad de archivo, servir rangos parciales y mantener cache inmutable."
);
assert(
  hoverMedia.includes("preload=\"none\"") &&
    hoverMedia.includes("muted") &&
    hoverMedia.includes("loop") &&
    hoverMedia.includes("playsInline") &&
    hoverMedia.includes("controls={false}") &&
    hoverMedia.includes("disableRemotePlayback") &&
    hoverMedia.includes("visibilitychange") &&
    hoverMedia.includes("video.pause()") &&
    !hoverMedia.includes("poster="),
  "El preview público debe ser silencioso, sin controles, sin precarga anticipada y pausar al ocultarse la página."
);
assert(
  universalCard.includes("PREVIEW_DELAY_MS = 1_000") &&
    universalCard.includes("onPointerEnter={startCard}") &&
    universalCard.includes("requestAnimationFrame") &&
    universalCard.includes("cancelAnimationFrame") &&
    universalCard.includes("cardRect.current") &&
    universalCard.includes("setPreviewActive(true)") &&
    universalCard.includes("setPreviewActive(false)") &&
    universalCard.includes("(hover: hover) and (pointer: fine)") &&
    universalCard.includes("prefers-reduced-motion: reduce"),
  "La tarjeta universal debe activar el video tras 1 s, limitar el tilt a un frame y respetar puntero fino y movimiento reducido."
);
assert(
  adminEditor.includes("GamePreviewClipUploadForm") &&
    adminEditor.includes("currentPreview={game.previewClip}"),
  "Multimedia del juego debe administrar el preview desde el mismo workspace editorial."
);
assert(
  integrity.includes("game.previewClip") &&
    publicationChanges.includes("previewClip"),
  "Integridad y revisión de publicación deben incluir el preview de tarjeta."
);
assert(
  nginx.includes("preview-upload$") &&
    nginx.includes("client_max_body_size 66m") &&
    nginx.includes("client_max_body_size 8k") &&
    !nginx.includes("preview-import$"),
  "Sólo la subida local debe abrir el body grande; staging e importaciones por URL deben conservar el límite administrativo pequeño."
);
assert(
  envExample.includes("DEUNA_FFMPEG_PATH") &&
    envExample.includes("DEUNA_YTDLP_PATH") &&
    runtimeEnvExample.includes("DEUNA_YTDLP_PATH"),
  "Las dependencias operacionales FFmpeg/yt-dlp deben quedar documentadas sin integrarse al runtime público."
);
assert(
  nextConfig.includes('"frame-src \'none\'"') &&
    nextConfig.includes("frame-src https://www.youtube-nocookie.com") &&
    nextConfig.includes('buildContentSecurityPolicy("none")') &&
    nextConfig.includes('buildContentSecurityPolicy("youtube-admin")') &&
    nextConfig.includes('source: "/admin/:path*"') &&
    !nextConfig.includes("https://www.youtube.com/iframe_api"),
  "La CSP pública debe seguir bloqueando iframes; sólo /admin puede enmarcar youtube-nocookie y sin scripts externos de YouTube."
);

if (failures.length > 0) {
  console.error("");
  console.error("Preview de video en tarjetas: ERROR");
  console.error("");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Preview de video en tarjetas: OK (archivo/URL/YouTube con recorte visual, importación acotada, VP9 ligero, 1 s de intención, cache, Range y aislamiento público verificados)."
);
