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
  MAX_PREVIEW_SOURCE_BYTES === 64 * 1024 * 1024 &&
    MAX_PREVIEW_DURATION_SECONDS === 30 &&
    MAX_PREVIEW_SOURCE_POSITION_SECONDS === 86_400,
  "La política de preview debe limitar tamaño, duración y posición del recorte."
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
  remoteSource,
  staging,
  uploadRoute,
  stagingRoute,
  stagedPlaybackRoute,
  importRoute,
  removeRoute,
  mediaAuth,
  mediaRequestSecurity,
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
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-remove/route.ts"),
  source("src/lib/admin/media-admin-route.ts"),
  source("src/lib/admin/media-request-security.ts"),
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
  trimPolicy.includes("parsePreviewTrimWindow") &&
    trimPolicy.includes("MAX_PREVIEW_DURATION_SECONDS = 30") &&
    trimPolicy.includes("MAX_PREVIEW_SOURCE_POSITION_SECONDS = 86_400"),
  "Archivo local y URL deben compartir una única política IN/OUT de máximo 30 segundos."
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
  "La conversión debe recortar una sola vez y generar WebM/VP9 ligero de forma segura."
);

assert(
  uploadRoute.includes("MAX_ADMIN_PREVIEW_REQUEST_BYTES") &&
    uploadRoute.includes("parsePreviewTrimWindow") &&
    uploadRoute.includes("storeEditorialPreviewVideo") &&
    uploadRoute.includes("previewClip: upload.publicPath") &&
    uploadRoute.includes("previewMode: undefined") &&
    uploadRoute.includes("youtubePreview: undefined"),
  "La subida local debe exigir IN/OUT, generar WebM y limpiar metadatos de previews retirados."
);

assert(
  remoteSource.includes("httpsRequest") &&
    remoteSource.includes("BlockList") &&
    remoteSource.includes("MAX_REDIRECTS = 3") &&
    remoteSource.includes("MAX_REMOTE_PREVIEW_BYTES") &&
    remoteSource.includes("pipeline"),
  "La URL directa debe conservar SSRF, límites, DNS seguro y descarga por streaming."
);

assert(
  staging.includes("STAGING_TTL_MS = 30 * 60 * 1_000") &&
    staging.includes("MAX_STAGED_SOURCES = 8") &&
    staging.includes("removeStagedEditorialPreviewSource") &&
    stagingRoute.includes("createStagedRemotePreviewSource") &&
    stagedPlaybackRoute.includes('"Accept-Ranges": "bytes"') &&
    stagedPlaybackRoute.includes("removeStagedEditorialPreviewSource"),
  "La URL directa debe usar staging privado, temporal, acotado y reproducible por Range."
);

assert(
  importRoute.includes("parsePreviewTrimWindow") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("previewClip: upload.publicPath") &&
    importRoute.includes("previewMode: undefined") &&
    importRoute.includes("youtubePreview: undefined") &&
    importRoute.includes("removeStagedEditorialPreviewSource"),
  "La URL directa debe terminar siempre como WebM recortado local y limpiar su staging."
);

assert(
  removeRoute.includes("previewClip: undefined") &&
    removeRoute.includes("previewMode: undefined") &&
    removeRoute.includes("youtubePreview: undefined") &&
    !removeRoute.includes("fallbackMode"),
  "Quitar el preview debe dejar el juego sin ningún origen alternativo oculto."
);

assert(
  mediaAuth.includes("maximumBytes?: number") &&
    mediaRequestSecurity.includes("MAX_ADMIN_PREVIEW_REQUEST_BYTES") &&
    mediaRequestSecurity.includes("hasTrustedAdminOrigin"),
  "Sólo la carga local autenticada debe aceptar el body multimedia grande."
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
    !universalCard.includes("iframe") &&
    !universalCard.includes("previewMode"),
  "La tarjeta debe esperar 1 segundo y reproducir únicamente su WebM local."
);

assert(
  previewAdminForm.includes('type SourceMode = "file" | "url"') &&
    !previewAdminForm.includes('"youtube"') &&
    previewAdminForm.includes("VideoTrimEditor") &&
    previewAdminForm.includes("Cargar video para recortar") &&
    previewAdminForm.includes("Marcar IN aquí") &&
    previewAdminForm.includes("Marcar OUT aquí") &&
    previewAdminForm.includes("Reproducir recorte") &&
    previewAdminForm.includes("Crear preview WebM con este recorte") &&
    previewAdminForm.includes("/preview-upload") &&
    previewAdminForm.includes("/preview-source") &&
    previewAdminForm.includes("/preview-import"),
  "Multimedia debe ofrecer sólo archivo/URL, preview visual y selección explícita del fragmento."
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
  "CSP debe volver a bloquear todos los iframes tras retirar YouTube directo."
);

assert(
  nginx.includes("preview-upload$") &&
    nginx.includes("client_max_body_size 66m") &&
    nginx.includes("client_max_body_size 8k"),
  "Sólo subir archivo local debe conservar el body administrativo grande."
);

assert(
  envExample.includes("DEUNA_FFMPEG_PATH") &&
    !envExample.includes("DEUNA_YTDLP") &&
    !envExample.includes("MEDIA_IMPORT_WORKER") &&
    !packageJson.includes("yt-dlp"),
  "El sistema WebM no debe requerir yt-dlp, worker ni dependencias de YouTube."
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
  "Preview de video en tarjetas: OK (archivo/URL → recorte visual IN/OUT → WebM local optimizado; YouTube directo retirado)."
);
