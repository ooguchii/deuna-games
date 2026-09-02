import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewTrimWindow,
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
const assert = (condition, message) => { if (!condition) failures.push(message); };
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const syntheticWebm = Buffer.alloc(160);
syntheticWebm.set([0x1a, 0x45, 0xdf, 0xa3], 0);
syntheticWebm.write("webm", 24, "ascii");
assert(inspectSafeEditorialWebm(syntheticWebm)?.bytes === syntheticWebm.length && inspectSafeEditorialWebm(Buffer.alloc(160)) === null, "El WebM editorial debe seguir validándose estrictamente.");
assert(MAX_EDITORIAL_PREVIEW_BYTES === 3 * 1024 * 1024 && MAX_PREVIEW_SOURCE_BYTES === 1024 * 1024 * 1024 && MAX_PREVIEW_DURATION_SECONDS === 30, "Los límites editoriales de video cambiaron inesperadamente.");
assert(parsePreviewTrimWindow("12", "42")?.durationSeconds === 30 && parsePreviewTrimWindow("12", "42.001") === null, "IN/OUT debe conservar máximo 30 segundos.");

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

const [form, providerRoute, directRoute, staging, platformSource, workerClient, resolver, card, importRoute, uploadRoute, removeRoute] = await Promise.all([
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-provider/[provider]/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-direct/route.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/platform-video-source.ts"),
  source("src/lib/media/media-import-worker-client.ts"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
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

const activePreviewSources = [
  form,
  providerRoute,
  directRoute,
  staging,
  platformSource,
  workerClient,
  resolver,
  importRoute,
  uploadRoute,
  removeRoute,
];
for (const legacyIdentifier of ["youtubePreview", "directPreview", "previewMode"]) {
  assert(
    activePreviewSources.every((text) => !text.includes(legacyIdentifier)),
    `El subsistema activo de previews no debe volver a usar ${legacyIdentifier}.`
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
  console.error("\nPreview de video por proveedor: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Preview de video por proveedor: OK (selección explícita → reproductor específico si existe → staging aislado → IN/OUT → WebM interno; sin rutas ni identificadores legacy en el subsistema activo).");
