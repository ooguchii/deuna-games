import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_PREVIEW_FPS,
  DEFAULT_PREVIEW_QUALITY,
  DEFAULT_PREVIEW_VIEWPORT,
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_FPS,
  MAX_PREVIEW_SOURCE_BYTES,
  MAX_PREVIEW_VIEWPORT_ZOOM,
  MIN_PREVIEW_VIEWPORT_ZOOM,
  PREVIEW_FPS_OPTIONS,
  PREVIEW_HERO_QUALITY_OPTIONS,
  PREVIEW_QUALITY_IDS,
  PREVIEW_VIEWPORT_ASPECT_IDS,
  parsePreviewFps,
  parsePreviewQuality,
  parsePreviewTrimWindow,
  parsePreviewViewport,
  resolvePreviewViewportCrop,
} from "../src/lib/media/preview-video-policy.ts";
import {
  PREVIEW_PROVIDER_IDS,
  parsePreviewProviderUrl,
} from "../src/lib/media/preview-providers.ts";
import {
  inspectSafeEditorialWebm,
  MAX_EDITORIAL_PREVIEW_BYTES,
} from "../src/lib/media/safe-webm.ts";

const root = process.cwd();
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const source = (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");
const has = (text, ...needles) => needles.every((needle) => text.includes(needle));

const syntheticWebm = Buffer.alloc(160);
syntheticWebm.set([0x1a, 0x45, 0xdf, 0xa3], 0);
syntheticWebm.write("webm", 24, "ascii");
assert(
  inspectSafeEditorialWebm(syntheticWebm)?.bytes === syntheticWebm.length &&
    inspectSafeEditorialWebm(Buffer.alloc(160)) === null,
  "El WebM editorial debe seguir validándose estrictamente."
);
assert(
  MAX_EDITORIAL_PREVIEW_BYTES === 32 * 1024 * 1024 &&
    MAX_PREVIEW_SOURCE_BYTES === 1024 * 1024 * 1024 &&
    MAX_PREVIEW_DURATION_SECONDS === 30,
  "Los límites editoriales HD deben conservar 32 MB de master, 1 GB de fuente y 30 s de duración."
);
assert(
  PREVIEW_QUALITY_IDS.join(",") === "720p,1080p" &&
    DEFAULT_PREVIEW_QUALITY === "1080p" &&
    parsePreviewQuality("1080p") === "1080p" &&
    parsePreviewQuality("high") === "1080p" &&
    parsePreviewQuality("ultra") === null,
  "La resolución debe ser 720p/1080p, con 1080p por defecto y compatibilidad de entrada heredada."
);
assert(
  PREVIEW_FPS_OPTIONS.join(",") === "24,25,30,50,60" &&
    DEFAULT_PREVIEW_FPS === 50 &&
    MAX_PREVIEW_FPS === 60 &&
    parsePreviewFps("60") === 60 &&
    parsePreviewFps("61") === null,
  "Los FPS deben ofrecer 24/25/30/50/60, usar 50 por defecto y bloquear más de 60."
);
assert(
  PREVIEW_HERO_QUALITY_OPTIONS.map(
    (option) => `${option.id}:${option.targetWidth}:${option.targetFps}`
  ).join(",") === "720p:1280:60,1080p:1920:60",
  "Los masters deben mapear HD a 1280 y Full HD a 1920 sin perfiles opacos."
);
assert(
  parsePreviewTrimWindow("12", "42")?.durationSeconds === 30 &&
    parsePreviewTrimWindow("12", "42.001") === null,
  "IN/OUT debe conservar máximo 30 segundos."
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
const rightHalf = resolvePreviewViewportCrop(1920, 1080, {
  x: 1,
  y: 0.5,
  zoom: 2,
  aspect: "source",
});
assert(
  rightHalf?.width === 960 &&
    rightHalf?.height === 540 &&
    rightHalf?.x === 960 &&
    rightHalf?.y === 270,
  "El encuadre 200% a la derecha debe resolver la mitad derecha del video."
);
assert(
  parsePreviewViewport("1", "0.5", "2", "source")?.x === 1 &&
    parsePreviewViewport("1.01", "0.5", "2", "source") === null,
  "X/Y y zoom del viewport deben seguir validados estrictamente."
);

const approvedProviders = [
  "youtube", "facebook", "instagram", "tiktok", "vimeo", "x", "twitch",
  "dailymotion", "streamable", "kick", "reddit", "pinterest", "snapchat",
];
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
  "El catálogo explícito de proveedores cambió inesperadamente."
);
for (const provider of PREVIEW_PROVIDER_IDS) {
  assert(Boolean(parsePreviewProviderUrl(provider, cases[provider])), `${provider} debe aceptar su propio enlace.`);
  const foreign = provider === "youtube" ? cases.instagram : cases.youtube;
  assert(parsePreviewProviderUrl(provider, foreign) === null, `${provider} no debe aceptar una URL ajena.`);
}

const retiredProviderResidues = [
  ["ru", "mble"], ["ody", "see"], ["bili", "bili"], ["v", "k"],
  ["img", "ur"], ["tum", "blr"], ["lo", "om"], ["wis", "tia"],
  ["nico", "video"], ["nico", "nico"], ["b23", ".tv"], ["wi", ".st"],
  ["nico", ".ms"],
].map((parts) => parts.join(""));
const residuePattern =
  `(^|[^a-z0-9])(${retiredProviderResidues.slice(0, 10).join("|")})([^a-z0-9]|$)|` +
  retiredProviderResidues.slice(10).map((value) => value.replace(".", "\\.")).join("|");
const residueCheck = spawnSync(
  "git",
  ["grep", "-I", "-n", "-i", "-E", residuePattern, "--", ".", ":!package-lock.json"],
  { cwd: root, encoding: "utf8" }
);
assert(
  residueCheck.status === 1,
  residueCheck.status === 0
    ? `Quedaron referencias de proveedores retirados:\n${residueCheck.stdout.trim()}`
    : `No se pudo verificar la ausencia de residuos de proveedores (git grep terminó con ${residueCheck.status ?? "error"}).`
);

const [
  libraryEditor,
  trimEditor,
  workspace,
  libraryRoute,
  viewportEditor,
  providerRoute,
  directRoute,
  sourceRoute,
  staging,
  platformSource,
  workerClient,
  importWorker,
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
  source("src/components/admin/GameVideoLibraryEditor.tsx"),
  source("src/components/admin/VideoTrimEditor.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-provider/[provider]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-direct/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-source/[token]/route.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/platform-video-source.ts"),
  source("src/lib/media/media-import-worker-client.ts"),
  source("ops/worker/media-import-worker.mjs"),
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

assert(
  has(libraryEditor, "preview-provider/", "preview-direct", "preview-source-upload", "VideoTrimEditor", "PREVIEW_FPS_OPTIONS", '"X-Deuna-Preview-Fps"', 'fps: String(fps)', "DEFAULT_PREVIEW_FPS") &&
    has(libraryRoute, 'source: "hero"', 'source: "independent"') &&
    has(workspace, '"hero-video"', '"hero-image"', 'target="card-video"', 'target="card-match-hero"', "GameVideoViewportEditor"),
  "La biblioteca debe crear masters con resolución/FPS explícitos y mantener asignaciones Hero/Card por referencia."
);
assert(
  has(viewportEditor, "layoutOnly", "preview-layout", "Guardar encuadre") &&
    !viewportEditor.includes("preview-import") &&
    !viewportEditor.includes("preview-upload"),
  "Editar destino debe modificar sólo metadata y nunca recodificar."
);
assert(
  has(trimEditor, "requestAnimationFrame", "scheduleDrag", "scheduleViewportDraft", "resultCanvasRef", "layoutOnly"),
  "El editor debe conservar drag por animation frame y viewport reutilizable sin seeks por píxel."
);
assert(
  has(
    editorialVideo,
    "qualityProfiles",
    '"720p"',
    '"1080p"',
    "probeSourceFps",
    "ffprobeExecutable",
    "Math.min(requestedFps, sourceFps)",
    "effectiveFps",
    "profile.compression",
    "MAX_EDITORIAL_PREVIEW_BYTES"
  ) &&
    !editorialVideo.includes("cardQualityProfiles") &&
    !editorialVideo.includes("heroQualityProfiles") &&
    !editorialVideo.includes("crop=w=") &&
    !editorialVideo.includes("buildViewportCropFilter"),
  "FFmpeg debe mantener resolución/FPS elegidos, limitar a los FPS reales de fuente y variar sólo compresión antes de fallar."
);
assert(
  has(uploadRoute, "parsePreviewFps", "DEFAULT_PREVIEW_FPS", "x-deuna-preview-fps", "storeEditorialPreviewVideoFromPath") &&
    has(importRoute, "parsePreviewFps", "DEFAULT_PREVIEW_FPS", "targetViewportFpsFields", "storeEditorialPreviewVideoFromPath"),
  "Upload e import remoto deben revalidar FPS en servidor y conservar default seguro para requests antiguos."
);
assert(
  has(videoMedia, 'source: "hero"', 'source: "independent"', "src: hero.clip", "withGameVideoLayout", "withoutGameVideoTarget") &&
    has(validationCore, "gameVideoMediaSchema", 'source: z.literal("hero")', 'source: z.literal("independent")'),
  "Hero/Card deben seguir compartiendo bytes físicos con layouts independientes."
);
assert(
  resolver.includes("resolveGameCardVideo") &&
    card.includes("previewViewport={resolvedPreview?.viewport}") &&
    has(hoverPreview, "FramedVideo", 'preload="none"', "active && previewClip") &&
    has(framedVideo, "resolvePreviewViewportCrop", "ResizeObserver"),
  "La Card pública debe mantener carga diferida y encuadre sin segunda variante física."
);
assert(
  has(heroSection, "resolveGameHeroVideo", "HeroVideoLayer", 'preload="metadata"', "documentVisible"),
  "Hero debe conservar montaje controlado, metadata preload y visibilidad de documento."
);
assert(
  has(staging, "probeViaMediaImportWorker", 'kind: "remote"', "downloadSegmentViaMediaImportWorker") &&
    has(sourceRoute, "openMediaImportWorkerPreviewStream", "Readable.toWeb") &&
    has(workerClient, 'workerEndpoint(`/stream/${sessionId}`)') &&
    has(importWorker, 'parts[0] === "probe"', 'parts[0] === "segment"', 'parts[0] === "stream"'),
  "El fast path remoto debe conservar probe, Range/stream privado y extracción parcial en worker aislado."
);
assert(
  has(providerRoute, "parsePreviewProviderUrl(provider", "createStagedPlatformPreviewSource") &&
    has(directRoute, "createStagedDirectPreviewSource") &&
    has(platformSource, "provider: PreviewProviderId", "parsePreviewProviderUrl(provider"),
  "Cada proveedor y URL directa deben mantener rutas explícitas y validación aislada."
);
assert(
  has(layoutRoute, "withGameVideoLayout", "hasExactAdminFormFields") &&
    !layoutRoute.includes("storeEditorialPreviewVideo") &&
    has(removeRoute, "withoutGameVideoTarget"),
  "Layout/remove deben seguir siendo metadata-only."
);

const activePreviewSources = [
  libraryEditor,
  workspace,
  libraryRoute,
  viewportEditor,
  providerRoute,
  directRoute,
  sourceRoute,
  staging,
  platformSource,
  workerClient,
  importWorker,
  resolver,
  importRoute,
  uploadRoute,
  layoutRoute,
  removeRoute,
];
for (const legacyIdentifier of ["youtubePreview", "directPreview", "previewMode"]) {
  assert(
    activePreviewSources.every((text) => !text.includes(legacyIdentifier)),
    `El subsistema activo de video no debe volver a usar ${legacyIdentifier}.`
  );
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
  console.error("\nVideo editorial contextual: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(
  "Video editorial contextual: OK (master 720p/1080p → default 1080p50 → máximo 60 FPS → cadencia limitada a la fuente → biblioteca única → Hero/Card por referencia → encuadres metadata-only → worker/Range privados)."
);
