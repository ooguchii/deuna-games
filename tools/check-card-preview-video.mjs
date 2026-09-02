import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_PREVIEW_QUALITY,
  DEFAULT_PREVIEW_VIEWPORT,
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_BYTES,
  MAX_PREVIEW_VIEWPORT_ZOOM,
  MIN_PREVIEW_VIEWPORT_ZOOM,
  PREVIEW_HERO_QUALITY_OPTIONS,
  PREVIEW_QUALITY_IDS,
  PREVIEW_VIEWPORT_ASPECT_IDS,
  parsePreviewQuality,
  parsePreviewTrimWindow,
  parsePreviewViewport,
  resolvePreviewViewportCrop,
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
assert(
  PREVIEW_HERO_QUALITY_OPTIONS.map((option) => `${option.id}:${option.targetWidth}:${option.targetFps}`).join(",") === "performance:640:15,balanced:960:18,high:1280:20",
  "El Hero debe usar perfiles acotados pero mayores que la Card para evitar un fondo borroso sin superar el límite duro."
);
assert(
  PREVIEW_VIEWPORT_ASPECT_IDS.join(",") === "source,16:9,1:1,4:5,9:16" &&
    DEFAULT_PREVIEW_VIEWPORT.x === 0.5 &&
    DEFAULT_PREVIEW_VIEWPORT.y === 0.5 &&
    DEFAULT_PREVIEW_VIEWPORT.zoom === 1 &&
    DEFAULT_PREVIEW_VIEWPORT.aspect === "source" &&
    MIN_PREVIEW_VIEWPORT_ZOOM === 1 &&
    MAX_PREVIEW_VIEWPORT_ZOOM === 3,
  "El encuadre debe conservar default original/centrado y límites 100%-300%."
);
const rightHalf = resolvePreviewViewportCrop(1920, 1080, { x: 1, y: 0.5, zoom: 2, aspect: "source" });
assert(
  rightHalf?.width === 960 && rightHalf?.height === 540 && rightHalf?.x === 960 && rightHalf?.y === 270,
  "El encuadre 200% a la derecha debe resolver la mitad derecha del video sin ambigüedad."
);
assert(
  parsePreviewViewport("1", "0.5", "2", "source")?.x === 1 &&
    parsePreviewViewport("1.01", "0.5", "2", "source") === null &&
    parsePreviewViewport("0.5", "0.5", "3.01", "source") === null &&
    parsePreviewViewport("0.5", "0.5", "2", "ultra-wide") === null,
  "X/Y, zoom y relación del encuadre deben validarse estrictamente."
);

const approvedProviders = [
  "youtube", "facebook", "instagram", "tiktok", "vimeo", "x", "twitch",
  "dailymotion", "streamable", "kick", "reddit", "pinterest", "snapchat",
];
const retiredProviderResidues = [
  ["ru", "mble"], ["ody", "see"], ["bili", "bili"], ["v", "k"],
  ["img", "ur"], ["tum", "blr"], ["lo", "om"], ["wis", "tia"],
  ["nico", "video"], ["nico", "nico"], ["b23", ".tv"], ["wi", ".st"], ["nico", ".ms"],
].map((parts) => parts.join(""));
const residuePattern = `(^|[^a-z0-9])(${retiredProviderResidues.slice(0, 10).join("|")})([^a-z0-9]|$)|${retiredProviderResidues.slice(10).map((value) => value.replace(".", "\\.")).join("|")}`;
const residueCheck = spawnSync("git", ["grep", "-I", "-n", "-i", "-E", residuePattern, "--", "."], {
  cwd: root,
  encoding: "utf8",
});
assert(
  residueCheck.status === 1,
  residueCheck.status === 0
    ? `Quedaron referencias de proveedores retirados:\n${residueCheck.stdout.trim()}`
    : `No se pudo verificar la ausencia de residuos de proveedores (git grep terminó con ${residueCheck.status ?? "error"}).`
);

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
  pinterest: "https://www.pinterest.com/pin/123456789/",
  snapchat: "https://www.snapchat.com/spotlight/example",
};

assert(
  PREVIEW_PROVIDER_IDS.join(",") === approvedProviders.join(","),
  "El catálogo explícito de previews debe contener sólo los proveedores aprobados."
);
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
  hoverPreview,
  framedVideo,
  heroSection,
  editorialVideo,
  videoMedia,
  validationCore,
  importRoute,
  uploadRoute,
  layoutRoute,
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
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("src/components/ui/FramedVideo.tsx"),
  source("src/components/home/HeroSection.tsx"),
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/admin/content-validation-core.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-remove/route.ts"),
]);

assert(form.includes("preview-provider/") && form.includes("preview-direct") && form.includes("buildPreviewProviderEmbed") && form.includes("VideoTrimEditor"), "La UI debe mantener fuentes explícitas y el editor interno por rutas aisladas.");
assert(providerRoute.includes("parsePreviewProviderUrl(provider") && providerRoute.includes("createStagedPlatformPreviewSource"), "Cada proveedor debe validarse por el identificador elegido antes del staging.");
assert(directRoute.includes("createStagedDirectPreviewSource") && !directRoute.includes("createStagedPlatformPreviewSource"), "URL directa debe tener ruta propia y no reutilizar el staging de plataformas.");
assert(staging.includes("createStagedPlatformPreviewSource") && staging.includes("createStagedDirectPreviewSource") && !staging.includes("parseSupportedPlatformVideoUrl"), "Staging no debe detectar plataformas automáticamente.");
assert(platformSource.includes("provider: PreviewProviderId") && platformSource.includes("parsePreviewProviderUrl(provider") && workerClient.includes("provider: PreviewProviderId"), "El proveedor explícito debe viajar hasta el worker multimedia.");
assert(
  approvedProviders.every((provider) => importWorker.includes(`${provider}:`)),
  "El worker debe conservar una allowlist explícita para todos los proveedores aprobados."
);

assert(
  form.includes("VIDEO EDITORIAL · HERO + CARD") &&
    form.includes("Usar video del Hero") &&
    form.includes("0 copias extra") &&
    form.includes("Usar video propio") &&
    form.includes("editorMode === \"layout\"") &&
    form.includes("X-Deuna-Preview-Target") &&
    form.includes("target: activeTarget"),
  "El panel debe separar Hero/Card, permitir compartir o usar video propio y enviar el destino explícito al servidor."
);
assert(
  form.includes('video.preload = "auto"') &&
    form.includes('video.addEventListener("loadeddata"') &&
    form.includes("disableRemotePlayback"),
  "El sondeo del navegador debe abortarse tras el primer frame decodificable y evitar reproducción remota innecesaria."
);
assert(
  trimEditor.includes("requestAnimationFrame") &&
    trimEditor.includes("scheduleDrag") &&
    trimEditor.includes("updateStart(value, false)") &&
    trimEditor.includes("updateEnd(value, false)") &&
    trimEditor.includes("finishPointerDrag") &&
    trimEditor.includes("cancelPointerDrag"),
  "Arrastrar IN/OUT debe actualizar visualmente por animation frame, hacer seek al finalizar y tolerar pointercancel."
);
assert(
  trimEditor.includes("layoutOnly") &&
    trimEditor.includes("no se ejecuta FFmpeg") &&
    trimEditor.includes("qualityOptions.map") &&
    trimEditor.includes("resolvePreviewViewportCrop") &&
    trimEditor.includes("viewportFrame") &&
    trimEditor.includes("viewportMoveHandle") &&
    trimEditor.includes("resultCanvasRef") &&
    trimEditor.includes("scheduleViewportDraft"),
  "El mismo editor debe reutilizar el encuadre en modo metadata-only sin presentar controles de recodificación."
);
assert(
  editorialVideo.includes("cardQualityProfiles") &&
    editorialVideo.includes("heroQualityProfiles") &&
    editorialVideo.includes('PreviewVideoPurpose = "card" | "hero"') &&
    editorialVideo.includes('purpose === "hero"') &&
    editorialVideo.includes("profile.preferredBytes") &&
    editorialVideo.includes("MAX_EDITORIAL_PREVIEW_BYTES") &&
    !editorialVideo.includes("crop=w=") &&
    !editorialVideo.includes("buildViewportCropFilter"),
  "FFmpeg debe recortar sólo el tiempo, conservar el fotograma completo y seleccionar calidad según Card/Hero sin quemar el encuadre."
);
assert(
  videoMedia.includes('source: "hero"') &&
    videoMedia.includes('source: "independent"') &&
    videoMedia.includes("return hero.clip") === false &&
    videoMedia.includes("src: hero.clip") &&
    videoMedia.includes("previewClip: clip") &&
    videoMedia.includes("withGameVideoLayout") &&
    videoMedia.includes("withoutGameVideoTarget"),
  "La resolución editorial debe compartir la ruta física del Hero, conservar un video propio como fallback y permitir layouts sin copiar archivos."
);
assert(
  validationCore.includes("gameVideoMediaSchema") &&
    validationCore.includes('source: z.literal("hero")') &&
    validationCore.includes('source: z.literal("independent")') &&
    validationCore.includes("La Card sólo puede compartir el video del Hero") &&
    validationCore.includes("videoMedia: gameVideoMediaSchema.optional()"),
  "El payload debe validar estrictamente Hero/Card y prohibir una Card compartida sin Hero existente."
);
assert(
  uploadRoute.includes("x-deuna-preview-target") &&
    uploadRoute.includes("withSavedGameVideoClip") &&
    importRoute.includes("targetViewportFields") &&
    importRoute.includes("withSavedGameVideoClip") &&
    importRoute.includes("legacyFields") &&
    importRoute.includes("isLegacyRequest"),
  "Upload/import deben aceptar destino explícito y conservar compatibilidad con requests históricos que siguen siendo Card."
);
assert(
  layoutRoute.includes("export async function GET") &&
    layoutRoute.includes("Cache-Control") &&
    layoutRoute.includes("withGameVideoLayout") &&
    layoutRoute.includes("hasExactAdminFormFields") &&
    !layoutRoute.includes("storeEditorialPreviewVideo") &&
    !layoutRoute.includes("FFmpeg"),
  "Cambiar fuente compartida/encuadre debe ser una operación metadata-only autenticada, exacta y sin transcodificación."
);
assert(
  removeRoute.includes("withoutGameVideoTarget") &&
    removeRoute.includes('value="hero"') === false &&
    removeRoute.includes("targetFields"),
  "La eliminación debe distinguir Hero/Card y no borrar implícitamente el otro destino."
);

assert(
  resolver.includes("resolveGameCardVideo") &&
    card.includes("previewViewport={resolvedPreview?.viewport}") &&
    hoverPreview.includes("FramedVideo") &&
    hoverPreview.includes('preload="none"') &&
    hoverPreview.includes("active && previewClip"),
  "La Card pública debe resolver video compartido/independiente, aplicar viewport y conservar carga diferida sólo tras hover."
);
assert(
  framedVideo.includes("resolvePreviewViewportCrop") &&
    framedVideo.includes("bounds.width / crop.width") &&
    framedVideo.includes("bounds.height / crop.height") &&
    framedVideo.includes("ResizeObserver") &&
    framedVideo.includes("opacity: layout ? 1 : 0"),
  "La presentación pública debe aplicar encuadre por geometría del navegador sin crear otra variante física."
);
assert(
  heroSection.includes("resolveGameHeroVideo") &&
    heroSection.includes("HeroVideoLayer") &&
    heroSection.includes("!trackSlide.clone") &&
    heroSection.includes("!reducedMotion") &&
    heroSection.includes('preload="metadata"') &&
    heroSection.includes("documentVisible"),
  "El Hero sólo debe montar el master en la diapositiva real activa, respetar reduced-motion y desmontarse con la pestaña oculta."
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
  "Probe debe ser sin descarga; el guardado remoto debe recortar sólo el tramo mediante FFmpeg sobre loopback."
);

assert(
  platformSource.includes('[null, "web_safari", "web_embedded", "mweb"]') &&
    platformSource.includes('youtubeClients === "web_safari"') &&
    platformSource.includes('b[protocol^=m3u8]') &&
    platformSource.includes('"--plugin-dirs", YTDLP_PLUGIN_DIR') &&
    platformSource.includes("youtubepot-bgutilhttp:base_url=") &&
    platformSource.includes("poTokenProviderConfigured") &&
    !platformSource.includes('return "web_embedded,default"'),
  "YouTube debe conservar auto → web_safari/HLS → web_embedded y añadir mweb sólo con PO Token Provider."
);
assert(
  importWorker.includes("youtubeProbeAttempts") &&
    importWorker.includes('return poTokenProviderConfigured() ? [null, "web_embedded", "mweb"] : [null, "web_embedded"]') &&
    importWorker.includes("youtubeClientAttempts") &&
    importWorker.includes('"--plugin-dirs", YTDLP_PLUGIN_DIR'),
  "El worker debe intentar HTTP seekable sin perder fallbacks completos ni PO Token opcional."
);
assert(
  potSetup.includes('PROVIDER_VERSION = "1.3.2"') &&
    potSetup.includes('d51cf1c54e487137df749bd8778cceaa62304e6c5054c955b95f028f93ad6d57') &&
    potSetup.includes('"127.0.0.1:4416:4416"') &&
    potSetup.includes('"--restart", "unless-stopped"') &&
    potSetup.includes("sha256(buffer)"),
  "El setup local del PO Token debe fijar versión, verificar SHA-256 y publicar sólo sobre loopback."
);
assert(
  lanHttps.includes("YOUTUBE_POT_PLUGIN_FILE") &&
    lanHttps.includes("youtubePotProviderReady") &&
    lanHttps.includes("DEUNA_YTDLP_PLUGIN_DIR") &&
    lanHttps.includes("DEUNA_YTDLP_POT_PROVIDER_URL") &&
    packageJson.includes('"media:youtube:setup": "node ./tools/setup-youtube-pot-provider.mjs"'),
  "mobile:secure debe detectar el proveedor local sin convertirlo en dependencia obligatoria."
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

const activePreviewSources = [form, providerRoute, directRoute, sourceRoute, staging, platformSource, workerClient, importWorker, resolver, importRoute, uploadRoute, layoutRoute, removeRoute];
for (const legacyIdentifier of ["youtubePreview", "directPreview", "previewMode"]) {
  assert(activePreviewSources.every((text) => !text.includes(legacyIdentifier)), `El subsistema activo de video no debe volver a usar ${legacyIdentifier}.`);
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
  console.error("\nVideo editorial Hero/Card: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Video editorial Hero/Card: OK (un master compartible → dos encuadres metadata → Card opcional independiente → Hero activo único → Range privado → IN/OUT sin seek continuo → WebM interno; fallback compatible intacto).");
