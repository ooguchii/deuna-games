import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_PREVIEW_QUALITY,
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_BYTES,
  PREVIEW_QUALITY_IDS,
  parsePreviewQuality,
  parsePreviewTrimWindow,
} from "../src/lib/media/preview-video-policy.ts";
import { PREVIEW_PROVIDER_IDS, parsePreviewProviderUrl } from "../src/lib/media/preview-providers.ts";
import { inspectSafeEditorialWebm, MAX_EDITORIAL_PREVIEW_BYTES } from "../src/lib/media/safe-webm.ts";

const root = process.cwd();
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const syntheticWebm = Buffer.alloc(160);
syntheticWebm.set([0x1a, 0x45, 0xdf, 0xa3], 0);
syntheticWebm.write("webm", 24, "ascii");
assert(inspectSafeEditorialWebm(syntheticWebm)?.bytes === syntheticWebm.length && inspectSafeEditorialWebm(Buffer.alloc(160)) === null, "El WebM editorial debe seguir validándose estrictamente.");
assert(MAX_EDITORIAL_PREVIEW_BYTES === 3 * 1024 * 1024 && MAX_PREVIEW_SOURCE_BYTES === 1024 * 1024 * 1024 && MAX_PREVIEW_DURATION_SECONDS === 30, "Los límites editoriales de video cambiaron inesperadamente.");
assert(parsePreviewTrimWindow("12", "42")?.durationSeconds === 30 && parsePreviewTrimWindow("12", "42.001") === null, "IN/OUT debe conservar máximo 30 segundos.");
assert(PREVIEW_QUALITY_IDS.join(",") === "performance,balanced,high" && DEFAULT_PREVIEW_QUALITY === "balanced" && parsePreviewQuality("high") === "high" && parsePreviewQuality("ultra") === null, "La política de calidad debe conservar Ligera/Equilibrada/Alta con Equilibrada como default seguro.");

const cases = {
  youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  facebook: "https://www.facebook.com/watch/?v=123456789012345",
  instagram: "https://www.instagram.com/reel/ABCdef12345/",
  tiktok: "https://www.tiktok.com/@deuna/video/1234567890123456789",
  vimeo: "https://vimeo.com/123456789",
  x: "https://x.com/deuna/status/1234567890123456789",
  twitch: "https://www.twitch.tv/videos/123456789",
  dailymotion: "https://www.dailymotion.com/video/x9abcd1",
  streamable: "https://streamable.com/abc123",
  kick: "https://kick.com/deuna",
  reddit: "https://www.reddit.com/r/gaming/comments/abc123/example/",
  rumble: "https://rumble.com/v123abc-example.html",
  odysee: "https://odysee.com/@deuna:1/video:2",
  bilibili: "https://www.bilibili.com/video/BV1xx411c7mD",
  vk: "https://vk.com/video-1_123456",
  imgur: "https://imgur.com/abc123",
  pinterest: "https://www.pinterest.com/pin/123456789/",
  tumblr: "https://www.tumblr.com/deuna/123456789/example",
  snapchat: "https://www.snapchat.com/spotlight/example",
  loom: "https://www.loom.com/share/0123456789abcdef0123456789abcdef",
  wistia: "https://fast.wistia.net/embed/iframe/abc123def4",
  nicovideo: "https://www.nicovideo.jp/watch/sm12345678",
};

assert(PREVIEW_PROVIDER_IDS.length === 22, "Deben existir 22 proveedores externos explícitos.");
for (const provider of PREVIEW_PROVIDER_IDS) {
  assert(Boolean(parsePreviewProviderUrl(provider, cases[provider])), `La ruta explícita de ${provider} debe aceptar su propio enlace.`);
  const foreign = provider === "youtube" ? cases.instagram : cases.youtube;
  assert(parsePreviewProviderUrl(provider, foreign) === null, `${provider} no debe aceptar una URL de otra plataforma.`);
}

const [
  form,
  trimEditor,
  providerRoute,
  directRoute,
  sourceRoute,
  staging,
  platformSource,
  workerClient,
  importWorker,
  workerEnv,
  ytDlpWrapper,
  potSetup,
  lanHttps,
  packageJson,
  resolver,
  card,
  editorialVideo,
  importRoute,
  uploadRoute,
  removeRoute,
] = await Promise.all([
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-provider/[provider]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-direct/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/route.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/platform-video-source.ts"),
  source("src/lib/media/media-import-worker-client.ts"),
  source("ops/worker/media-import-worker.mjs"),
  source("ops/systemd/media-import.env.example"),
  source("ops/worker/yt-dlp-node-wrapper.sh"),
  source("tools/setup-youtube-pot-provider.mjs"),
  source("tools/run-lan-https.mjs"),
  source("package.json"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/lib/media/editorial-video.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-remove/route.ts"),
]);

assert(form.includes("No hay detección automática") && form.includes("preview-provider/") && form.includes("preview-direct") && form.includes("buildPreviewProviderEmbed") && form.includes("VideoTrimEditor"), "La UI debe obligar a elegir fuente y mantener reproductor/recorte por ruta explícita.");
assert(providerRoute.includes("parsePreviewProviderUrl(provider") && providerRoute.includes("createStagedPlatformPreviewSource"), "Cada proveedor debe validarse por el identificador elegido antes del staging.");
assert(directRoute.includes("createStagedDirectPreviewSource") && !directRoute.includes("createStagedPlatformPreviewSource"), "URL directa debe tener ruta propia y no reutilizar el staging de plataformas.");
assert(staging.includes("createStagedPlatformPreviewSource") && staging.includes("createStagedDirectPreviewSource") && !staging.includes("parseSupportedPlatformVideoUrl"), "Staging no debe detectar plataformas automáticamente.");
assert(platformSource.includes("provider: PreviewProviderId") && platformSource.includes("parsePreviewProviderUrl(provider") && workerClient.includes("provider: PreviewProviderId"), "El proveedor explícito debe viajar hasta el worker multimedia.");
assert(resolver.includes("const local = game.previewClip?.trim()") && card.includes("resolveGameCardPreview"), "La web pública debe seguir usando sólo el WebM interno.");

assert(
  form.includes("currentPreview && !preparedSource") &&
    form.includes("{!preparedSource && (") &&
    form.includes("EDITOR ACTIVO") &&
    form.includes("El editor interno es la única vista activa") &&
    form.includes("Cambiar fuente"),
  "Al preparar una fuente debe desmontarse la previsualización externa/anterior y quedar un único editor activo."
);
assert(
  form.includes('video.preload = "metadata"') &&
    form.includes('video.addEventListener("loadeddata"') &&
    form.includes("disableRemotePlayback"),
  "El sondeo del navegador debe pedir sólo lo necesario y evitar capacidades de reproducción remota innecesarias."
);
assert(
  trimEditor.includes("requestAnimationFrame") &&
    trimEditor.includes("scheduleDrag") &&
    trimEditor.includes("updateStart(value, false)") &&
    trimEditor.includes("updateEnd(value, false)") &&
    trimEditor.includes("finishPointerDrag"),
  "Arrastrar IN/OUT debe actualizar visualmente por animation frame y hacer seek real sólo al finalizar el gesto."
);
assert(
  trimEditor.includes("PREVIEW_QUALITY_OPTIONS") &&
    trimEditor.includes("Calidad del preview guardado") &&
    form.includes("X-Deuna-Preview-Quality") &&
    form.includes("quality,") &&
    importRoute.includes("parsePreviewQuality") &&
    uploadRoute.includes("parsePreviewQuality") &&
    editorialVideo.includes("qualityProfiles") &&
    editorialVideo.includes("performance:") &&
    editorialVideo.includes("balanced:") &&
    editorialVideo.includes("high:") &&
    editorialVideo.includes("profile.preferredBytes"),
  "La calidad Ligera/Equilibrada/Alta debe validarse de UI a servidor y degradarse automáticamente para respetar el límite de peso."
);
assert(
  importRoute.includes("legacyFields") &&
    importRoute.includes("isLegacyRequest") &&
    importRoute.includes("DEFAULT_PREVIEW_QUALITY"),
  "El endpoint remoto debe mantener compatibilidad con pestañas anteriores usando calidad Equilibrada por defecto."
);

assert(
  staging.includes("probeViaMediaImportWorker") &&
    staging.includes('kind: "remote"') &&
    staging.includes("downloadSegmentViaMediaImportWorker") &&
    staging.includes("materializeRemoteSource") &&
    importRoute.includes("prepareStagedEditorialPreviewForTrim") &&
    providerRoute.includes('delivery: staged.kind === "remote" ? "stream" : "staged"') &&
    directRoute.includes('delivery: staged.kind === "remote" ? "stream" : "staged"'),
  "El fast path debe guardar sólo un descriptor remoto, extraer IN/OUT bajo demanda y conservar materialización completa como fallback."
);
assert(
  sourceRoute.includes("openMediaImportWorkerPreviewStream") &&
    sourceRoute.includes("Readable.toWeb") &&
    workerClient.includes('workerEndpoint(`/stream/${sessionId}`)') &&
    importWorker.includes('parts[0] === "stream"') &&
    importWorker.includes('parts[0] === "internal-stream"') &&
    importWorker.includes("MAX_STREAM_CHUNK_BYTES") &&
    importWorker.includes('Range: `bytes=${range.start}-${range.end}`'),
  "La previsualización remota debe viajar por Range a través del worker aislado y nunca exponer la URL resuelta al navegador."
);
assert(
  importWorker.includes('parts[0] === "probe"') &&
    importWorker.includes('parts[0] === "segment"') &&
    importWorker.includes('"--skip-download"') &&
    importWorker.includes("probeSeekableUrl") &&
    importWorker.includes("runSegmentFfmpeg") &&
    importWorker.includes("internal-stream") &&
    workerEnv.includes("DEUNA_FFMPEG_PATH=/usr/bin/ffmpeg") &&
    form.includes("streaming parcial") &&
    form.includes('result.delivery === "stream"'),
  "Probe debe ser sin descarga; el guardado debe recortar sólo el tramo mediante FFmpeg sobre loopback y la UI debe comunicar el modo parcial."
);

assert(
  platformSource.includes('[null, "web_safari", "web_embedded", "mweb"]') &&
    platformSource.includes('youtubeClients === "web_safari"') &&
    platformSource.includes('b[protocol^=m3u8]') &&
    platformSource.includes('"--plugin-dirs", YTDLP_PLUGIN_DIR') &&
    platformSource.includes("youtubepot-bgutilhttp:base_url=") &&
    platformSource.includes("poTokenProviderConfigured") &&
    !platformSource.includes('return "web_embedded,default"'),
  "YouTube debe conservar auto → web_safari/HLS → web_embedded y añadir mweb sólo cuando el PO Token Provider esté configurado."
);
assert(
  importWorker.includes("youtubeProbeAttempts") &&
    importWorker.includes('return poTokenProviderConfigured() ? [null, "web_embedded", "mweb"] : [null, "web_embedded"]') &&
    importWorker.includes("youtubeClientAttempts") &&
    importWorker.includes('"--plugin-dirs", YTDLP_PLUGIN_DIR'),
  "El worker debe intentar HTTP seekable para lazy preview sin perder los fallbacks completos ni el PO Token opcional."
);
assert(
  potSetup.includes('PROVIDER_VERSION = "1.3.2"') &&
    potSetup.includes('d51cf1c54e487137df749bd8778cceaa62304e6c5054c955b95f028f93ad6d57') &&
    potSetup.includes('"127.0.0.1:4416:4416"') &&
    potSetup.includes('"--restart", "unless-stopped"') &&
    potSetup.includes("sha256(buffer)"),
  "El setup local del PO Token debe fijar versión, verificar SHA-256 y publicar el proveedor sólo sobre loopback."
);
assert(
  lanHttps.includes("YOUTUBE_POT_PLUGIN_FILE") &&
    lanHttps.includes("youtubePotProviderReady") &&
    lanHttps.includes("DEUNA_YTDLP_PLUGIN_DIR") &&
    lanHttps.includes("DEUNA_YTDLP_POT_PROVIDER_URL") &&
    packageJson.includes('"media:youtube:setup": "node ./tools/setup-youtube-pot-provider.mjs"'),
  "mobile:secure debe detectar el proveedor local sin convertirlo en una dependencia obligatoria del arranque."
);
assert(
  importWorker.includes("--js-runtimes") && importWorker.includes("--remote-components") && importWorker.includes("classifyYtDlpFailure"),
  "El worker aislado debe conservar Node/EJS y errores sanitizados."
);
assert(
  !ytDlpWrapper.includes("YOUTUBE_CLIENTS") &&
    !ytDlpWrapper.includes("player_client=") &&
    ytDlpWrapper.includes("Node 22 o superior") &&
    ytDlpWrapper.includes("--remote-components") &&
    ytDlpWrapper.includes("--plugin-dirs") &&
    ytDlpWrapper.includes("127\\.0\\.0\\.1") &&
    ytDlpWrapper.includes("youtubepot-bgutilhttp:base_url="),
  "El wrapper no debe imponer clientes y sólo puede habilitar el PO Token Provider explícito sobre loopback."
);

const activePreviewSources = [form, providerRoute, directRoute, sourceRoute, staging, platformSource, workerClient, importWorker, resolver, importRoute, uploadRoute, removeRoute];
for (const legacyIdentifier of ["youtubePreview", "directPreview", "previewMode"]) {
  assert(activePreviewSources.every((text) => !text.includes(legacyIdentifier)), `El subsistema activo de previews no debe volver a usar ${legacyIdentifier}.`);
}

const forbidden = [
  "src/components/admin/GamePreviewAutoUrlEditor.tsx",
  "src/components/admin/GamePreviewClipUploadFormV3.tsx",
  "src/app/api/admin/content/games/[slug]/preview-url/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-platform/[platform]/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-youtube/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-direct/[platform]/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-state/route.ts",
  "src/app/api/admin/content/games/[slug]/preview-source/route.ts",
  "src/lib/media/platform-video-url.ts",
  "src/lib/media/direct-platform-preview.ts",
  "src/lib/media/direct-platform-validation.ts",
  "src/lib/media/isolated-platform-preview-source.ts",
  "src/lib/media/youtube-preview.ts",
  "tools/check-card-preview-auto-url.mjs",
];
for (const relative of forbidden) {
  try {
    await access(path.join(root, relative));
    failures.push(`Archivo obsoleto todavía presente: ${relative}`);
  } catch {}
}

if (failures.length) {
  console.error("\nPreview de video por proveedor: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Preview de video por proveedor: OK (un solo editor activo → Range privado → IN/OUT sin seek continuo → calidad adaptativa → WebM interno; staging completo permanece sólo como fallback compatible).");
