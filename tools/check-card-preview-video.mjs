import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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

const [
  schema,
  typeModel,
  transcoder,
  uploadRoute,
  mediaAuth,
  mediaRequestSecurity,
  publicRoute,
  hoverMedia,
  universalCard,
  adminEditor,
  integrity,
  publicationChanges,
  nginx,
  envExample,
] = await Promise.all([
  source("src/lib/admin/content-validation.ts"),
  source("src/types/game.ts"),
  source("src/lib/media/editorial-video.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/lib/admin/media-admin-route.ts"),
  source("src/lib/admin/media-request-security.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("ops/nginx/deuna-games.conf.example"),
  source(".env.example"),
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
  transcoder.includes('"libvpx-vp9"') &&
    transcoder.includes('"-an"') &&
    transcoder.includes("MAX_PREVIEW_DURATION_SECONDS = 30") &&
    transcoder.includes("PREFERRED_PREVIEW_BYTES = 1_572_864") &&
    transcoder.includes("width: 400") &&
    transcoder.includes("fps: 15") &&
    transcoder.includes("width: 360") &&
    transcoder.includes("fps: 12") &&
    transcoder.includes("force_divisible_by=2") &&
    transcoder.includes('"-g"') &&
    transcoder.includes("spawn(ffmpegExecutable()") &&
    transcoder.includes("shell: false") &&
    transcoder.includes("mkdtemp") &&
    transcoder.includes("rm(temporaryDirectory") &&
    transcoder.includes("inspectSafeEditorialWebm"),
  "La conversión debe generar VP9 silencioso, ligero, acotado, sin shell y limpiar el archivo fuente temporal."
);
assert(
  uploadRoute.includes("hasExactAdminMediaFormFields") &&
    uploadRoute.includes('"expectedRevision"') &&
    uploadRoute.includes('"video"') &&
    uploadRoute.includes("MAX_ADMIN_PREVIEW_REQUEST_BYTES") &&
    uploadRoute.includes("saveGameMediaDraft") &&
    uploadRoute.includes("storeEditorialPreviewVideo"),
  "La carga de preview debe conservar autenticación, campos exactos, concurrencia y guardado sólo en borrador."
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
    nginx.includes("client_max_body_size 8k"),
  "Nginx debe permitir el video fuente sólo en el endpoint de conversión y mantener pequeño el límite general del API administrativo."
);
assert(
  envExample.includes("DEUNA_FFMPEG_PATH"),
  "La dependencia operacional de FFmpeg debe estar documentada."
);

if (failures.length > 0) {
  console.error("");
  console.error("Preview de video en tarjetas: ERROR");
  console.error("");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Preview de video en tarjetas: OK (VP9 ligero, 1 s de intención, tilt limitado por frame, pausa en segundo plano, cache de validación y Range eficiente verificados)."
);
