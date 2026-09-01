import {
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewTrimWindow,
} from "../src/lib/media/preview-video-policy.ts";
import {
  parseSupportedPlatformVideoUrl,
} from "../src/lib/media/platform-video-url.ts";
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
  inspectSafeEditorialWebm(syntheticWebm)?.bytes === syntheticWebm.length &&
    inspectSafeEditorialWebm(Buffer.alloc(160)) === null,
  "El inspector WebM debe conservar la validación del contenedor editorial."
);
assert(
  MAX_EDITORIAL_PREVIEW_BYTES === 3 * 1024 * 1024 &&
    MAX_PREVIEW_SOURCE_BYTES === 1024 * 1024 * 1024 &&
    MAX_PREVIEW_DURATION_SECONDS === 30,
  "El origen local debe conservar 1 GiB y el WebM final un máximo editorial de 30 s / 3 MB."
);
assert(
  parsePreviewTrimWindow("12", "42")?.durationSeconds === 30 &&
    parsePreviewTrimWindow("12", "42.001") === null &&
    parsePreviewTrimWindow("20", "10") === null,
  "IN/OUT debe mantener una única política estricta de 30 segundos."
);

const platformCases = [
  ["youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["facebook", "https://www.facebook.com/watch/?v=123456789012345"],
  ["instagram", "https://www.instagram.com/reel/ABCdef12345/"],
  ["tiktok", "https://www.tiktok.com/@deuna/video/1234567890123456789"],
  ["vimeo", "https://vimeo.com/123456789"],
  ["x", "https://x.com/deuna/status/1234567890123456789"],
  ["twitch", "https://www.twitch.tv/videos/123456789"],
  ["dailymotion", "https://www.dailymotion.com/video/x9abcd1"],
  ["streamable", "https://streamable.com/abc123"],
  ["kick", "https://kick.com/deuna"],
  ["reddit", "https://www.reddit.com/r/gaming/comments/abc123/example/"],
  ["rumble", "https://rumble.com/v123abc-example.html"],
  ["odysee", "https://odysee.com/@deuna:1/video:2"],
  ["bilibili", "https://www.bilibili.com/video/BV1xx411c7mD"],
  ["vk", "https://vk.com/video-1_123456"],
  ["imgur", "https://imgur.com/abc123"],
  ["pinterest", "https://www.pinterest.com/pin/123456789/"],
  ["tumblr", "https://www.tumblr.com/deuna/123456789/example"],
  ["snapchat", "https://www.snapchat.com/spotlight/example"],
  ["loom", "https://www.loom.com/share/0123456789abcdef0123456789abcdef"],
  ["wistia", "https://fast.wistia.net/embed/iframe/abc123def4"],
  ["nicovideo", "https://www.nicovideo.jp/watch/sm12345678"],
];

for (const [platform, url] of platformCases) {
  assert(
    parseSupportedPlatformVideoUrl(url)?.platform === platform,
    `El parser aislado debe reconocer ${platform}.`
  );
}

const [
  formEntry,
  form,
  platformRoute,
  isolatedStaging,
  staging,
  platformSource,
  proxyRoute,
  importRoute,
  uploadRoute,
  resolver,
  card,
  transcoder,
  workerClient,
  worker,
  wrapper,
] = await Promise.all([
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/admin/GamePreviewClipUploadFormV3.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-platform/[platform]/route.ts"),
  source("src/lib/media/isolated-platform-preview-source.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/platform-video-source.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/proxy/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/media/media-import-worker-client.ts"),
  source("ops/worker/media-import-worker.mjs"),
  source("ops/worker/yt-dlp-node-wrapper.sh"),
]);

assert(
  formEntry.includes('export { default } from "./GamePreviewClipUploadFormV3"'),
  "La entrada del editor debe apuntar al flujo plataforma → WebM."
);

for (const [platform] of platformCases) {
  assert(
    form.includes(`value: "${platform}"`) ||
      form.includes(`value="${platform}"`),
    `El selector debe tener una línea independiente para ${platform}.`
  );
}

assert(
  form.includes('<option value="file">Archivo de mi equipo</option>') &&
    form.includes("preview-platform/") &&
    form.includes("/preview-import") &&
    form.includes("VideoTrimEditor") &&
    form.includes("Descargar y preparar") &&
    form.includes("Crear preview WebM con este recorte") &&
    form.includes("createProxyForStagedToken") &&
    !form.includes("preview-youtube") &&
    !form.includes("preview-direct/") &&
    !form.includes("YouTubeTrimEditor") &&
    !form.includes("DirectPlatformPreviewEditor"),
  "La UI debe descargar la plataforma a staging, recortar con el editor común y finalizar siempre en WebM."
);

assert(
  platformRoute.includes("parsed.platform !== platform") &&
    platformRoute.includes("createIsolatedPlatformPreviewSource") &&
    platformRoute.includes("expectedRevisionSchema") &&
    platformRoute.includes("hasExactAdminFormFields") &&
    !platformRoute.includes("preview-direct") &&
    !platformRoute.includes("youtubePreview"),
  "La ruta de preparación debe validar plataforma exacta, revisión y campos antes de descargar."
);

assert(
  isolatedStaging.includes("parsed.platform !== expectedPlatform") &&
    isolatedStaging.includes("createStagedRemotePreviewSource"),
  "El staging aislado debe rechazar una URL de otra red antes de entrar al importador compartido."
);

assert(
  staging.includes("downloadPlatformEditorialVideo") &&
    staging.includes("ensureStagedEditorialPreviewProxy") &&
    staging.includes("STAGING_TTL_MS") &&
    staging.includes("MAX_STAGED_SOURCES"),
  "La fuente externa debe vivir sólo en staging privado, con TTL/capacidad y proxy de edición opcional."
);

assert(
  platformSource.includes("yt-dlp") &&
    platformSource.includes("--no-playlist") &&
    platformSource.includes("--max-filesize") &&
    platformSource.includes("512M") &&
    platformSource.includes("shell: false") &&
    platformSource.includes("requireRemoteImportWorkerInProduction"),
  "Las redes deben obtener una copia editorial limitada mediante yt-dlp y usar worker aislado en producción."
);

assert(
  platformSource.includes("configuredYouTubeClients") &&
    platformSource.includes('configured.toLowerCase() === "auto"') &&
    platformSource.includes('configured.toLowerCase() === "default,web_embedded"') &&
    platformSource.includes('return "web_embedded,default"') &&
    !platformSource.includes('"--sleep-requests"') &&
    wrapper.includes("web_embedded,default") &&
    wrapper.includes("ejs:github"),
  "YouTube debe normalizar configuración vacía, auto o legado a web_embedded primero y usar la misma política en desarrollo/producción."
);

assert(
  proxyRoute.includes("ensureStagedEditorialPreviewProxy") &&
    proxyRoute.includes("no-store"),
  "El proxy de edición debe seguir autenticado y sin cache pública."
);

for (const route of [importRoute, uploadRoute]) {
  assert(
    route.includes("storeEditorialPreviewVideoFromPath") &&
      route.includes("previewClip: upload.publicPath") &&
      route.includes('previewMode: "webm"') &&
      route.includes("youtubePreview: undefined"),
    "Guardar una fuente local o remota debe terminar explícitamente en modo WebM interno."
  );
}

assert(
  transcoder.includes('"libvpx-vp9"') &&
    transcoder.includes('"-ss"') &&
    transcoder.includes('"-t"') &&
    transcoder.includes("shell: false"),
  "FFmpeg debe seguir recortando y convirtiendo a VP9/WebM sin shell."
);

assert(
  resolver.includes("const local = game.previewClip?.trim()") &&
    resolver.includes('return local ? { kind: "webm", src: local } : null') &&
    !resolver.includes("validateYouTubePreview") &&
    !resolver.includes("validateDirectPlatformPreview"),
  "La web pública debe resolver únicamente el WebM interno, nunca una URL externa."
);

assert(
  card.includes("resolveGameCardPreview") &&
    card.includes("PREVIEW_DELAY_MS = 1_000"),
  "La card debe conservar el hover diferido sobre el preview resuelto."
);

assert(
  workerClient.includes('kind: "platform"') &&
    worker.includes("downloadPlatformVideo") &&
    worker.includes("MAX_PLATFORM_SOURCE_BYTES") &&
    wrapper.includes("--remote-components") &&
    wrapper.includes("ejs:github"),
  "Producción debe conservar el worker multimedia y el wrapper moderno de yt-dlp/YouTube."
);

if (failures.length > 0) {
  console.error("");
  console.error("Preview de video en tarjetas: ERROR");
  console.error("");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Preview de video en tarjetas: OK (plataformas aisladas → staging privado → IN/OUT → WebM interno; cards sin iframes externos)."
);
