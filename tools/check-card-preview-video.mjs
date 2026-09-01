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
  buildDirectPlatformEmbedUrl,
  DIRECT_PREVIEW_OPTIONS,
  parseDirectPlatformPreview,
  parseDirectPlatformVideo,
} from "../src/lib/media/direct-platform-preview.ts";
import {
  parseYouTubePreview,
  parseYouTubeVideo,
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
  "Archivo local y previews directos deben conservar 1 GiB de origen local y 30 s máximos de preview."
);
assert(
  parsePreviewTrimWindow("0", "30")?.durationSeconds === 30 &&
    parsePreviewTrimWindow("0", "30.001") === null &&
    parsePreviewTrimWindow("20", "10") === null,
  "IN/OUT debe mantener una única política estricta de 30 segundos."
);

assert(
  parseYouTubeVideo("youtube.com/watch?v=dQw4w9WgXcQ")?.videoId ===
    "dQw4w9WgXcQ" &&
    parseYouTubePreview(
      "https://youtu.be/dQw4w9WgXcQ",
      4,
      24
    )?.endSeconds === 24,
  "YouTube directo debe seguir funcionando de forma independiente."
);

const directCases = [
  [
    "facebook",
    "https://www.facebook.com/watch/?v=123456789012345",
  ],
  [
    "instagram",
    "https://www.instagram.com/reel/ABCdef12345/",
  ],
  [
    "tiktok",
    "https://www.tiktok.com/@deuna/video/1234567890123456789",
  ],
  ["vimeo", "https://vimeo.com/123456789"],
  [
    "x",
    "https://x.com/deuna/status/1234567890123456789",
  ],
  ["twitch", "https://www.twitch.tv/videos/123456789"],
  [
    "dailymotion",
    "https://www.dailymotion.com/video/x9abcd1",
  ],
  ["streamable", "https://streamable.com/abc123"],
  ["kick", "https://kick.com/deuna"],
];

assert(
  DIRECT_PREVIEW_OPTIONS.length === 9,
  "Deben existir exactamente nueve adaptadores directos además de YouTube."
);

for (const [platform, url] of directCases) {
  const parsed = parseDirectPlatformVideo(platform, url);
  assert(
    parsed?.platform === platform,
    `El adaptador ${platform} debe aceptar sólo su formato directo.`
  );
  assert(
    parseDirectPlatformVideo(
      platform === "facebook" ? "instagram" : "facebook",
      url
    ) === null,
    `Una URL ${platform} no debe caer en otro adaptador.`
  );
}

assert(
  parseDirectPlatformPreview(
    "facebook",
    directCases[0][1],
    5,
    20
  ) === null &&
    parseDirectPlatformPreview(
      "facebook",
      directCases[0][1],
      0,
      20
    )?.endSeconds === 20,
  "Plataformas sin seek estable deben fijar IN en 0 en vez de simular recorte arbitrario."
);
assert(
  parseDirectPlatformPreview(
    "vimeo",
    "https://vimeo.com/123456789",
    10,
    28
  )?.startSeconds === 10 &&
    parseDirectPlatformPreview(
      "tiktok",
      directCases[2][1],
      10,
      41
    ) === null,
  "Plataformas con seek deben aceptar IN real manteniendo el máximo de 30 s."
);

const vimeoEmbed = buildDirectPlatformEmbedUrl(
  {
    platform: "vimeo",
    url: "https://vimeo.com/123456789",
    startSeconds: 8,
    endSeconds: 20,
  },
  { autoplay: true, muted: true }
);
const twitchEmbed = buildDirectPlatformEmbedUrl(
  {
    platform: "twitch",
    url: "https://www.twitch.tv/videos/123456789",
    startSeconds: 8,
    endSeconds: 20,
  },
  {
    autoplay: true,
    muted: true,
    parentHostname: "example.invalid",
  }
);
assert(
  vimeoEmbed?.startsWith("https://player.vimeo.com/video/") &&
    vimeoEmbed.includes("#t=8s") &&
    twitchEmbed?.includes("player.twitch.tv") &&
    twitchEmbed.includes("parent=example.invalid") &&
    twitchEmbed.includes("time=8s"),
  "Vimeo y Twitch VOD deben construir embeds directos con inicio y Twitch debe fijar parent."
);

const [
  formEntry,
  form,
  directEditor,
  directRoute,
  directAdapters,
  directHover,
  youtubeRoute,
  youtubeEditor,
  youtubeHover,
  resolver,
  card,
  previewState,
  removeRoute,
  uploadRoute,
  importRoute,
  streamedSource,
  transcoder,
  validation,
  validationCore,
  gameTypes,
  publicationChanges,
  nextConfig,
  packageJson,
] = await Promise.all([
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/admin/GamePreviewClipUploadFormV2.tsx"),
  source("src/components/admin/DirectPlatformPreviewEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-direct/[platform]/route.ts"),
  source("src/lib/media/direct-platform-preview.ts"),
  source("src/lib/media/shared-direct-platform-hover-player.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-youtube/route.ts"),
  source("src/components/admin/YouTubeTrimEditor.tsx"),
  source("src/lib/media/shared-youtube-hover-player.ts"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-state/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-remove/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/lib/media/streamed-preview-source.ts"),
  source("src/lib/media/editorial-video.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/admin/content-validation-core.ts"),
  source("src/types/game.ts"),
  source("src/lib/admin/game-publication-changes.ts"),
  source("next.config.ts"),
  source("package.json"),
]);

assert(
  formEntry.includes('export { default } from "./GamePreviewClipUploadFormV2"'),
  "La entrada histórica del formulario debe apuntar a la implementación aislada sin cambiar imports externos."
);

for (const [value, label] of [
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["vimeo", "Vimeo"],
  ["x", "X / Twitter"],
  ["twitch", "Twitch"],
  ["dailymotion", "Dailymotion"],
  ["streamable", "Streamable"],
  ["kick", "Kick"],
]) {
  assert(
    form.includes(`<option value="${value}">${label}</option>`),
    `El selector debe tener una línea exclusiva para ${label}.`
  );
}
assert(
  form.includes('<option value="file">Archivo de mi equipo</option>') &&
    form.includes("/preview-youtube") &&
    form.includes("/preview-direct/") &&
    !form.includes("prepareRemoteSource") &&
    !form.includes("URL / YouTube / redes") &&
    !form.includes("parseSupportedPlatformVideoUrl"),
  "La UI visible debe ser archivo + plataformas explícitas; nunca un importador universal."
);
assert(
  form.includes("preview-source-upload") &&
    form.includes("probeBrowserPlayback") &&
    form.includes("prepareLocalCodecFallback") &&
    form.includes("/preview-import") &&
    !form.includes("new FormData()"),
  "La carga local debe conservar streaming, fallback de códec y recorte desde original."
);

assert(
  directRoute.includes("isGameDirectPreviewPlatform") &&
    directRoute.includes("parseDirectPlatformPreview") &&
    directRoute.includes("hasExactAdminFormFields") &&
    directRoute.includes("expectedRevisionSchema") &&
    directRoute.includes("saveGameMediaDraft") &&
    directRoute.includes("directPreview: preview") &&
    !directRoute.includes("preview-source") &&
    !directRoute.includes("yt-dlp") &&
    !directRoute.includes("ffmpeg") &&
    !directRoute.includes("downloadPlatformEditorialVideo"),
  "Cada plataforma directa debe guardarse sin staging, descarga, yt-dlp ni FFmpeg."
);
assert(
  youtubeRoute.includes('previewMode: "youtube"') &&
    youtubeRoute.includes("parseYouTubePreview") &&
    !youtubeRoute.includes("preview-source") &&
    !youtubeRoute.includes("yt-dlp"),
  "YouTube debe conservar su camino directo independiente ya probado."
);

assert(
  directEditor.includes("DirectPlatformPreviewEditor") &&
    directEditor.includes("supportsStartOffset") &&
    directEditor.includes("Probar recorte") &&
    directEditor.includes("MAX_PREVIEW_DURATION_SECONDS") &&
    directEditor.includes('type: "seekTo"') &&
    directEditor.includes('type: "mute"') &&
    directEditor.includes('type: "play"'),
  "El editor directo debe distinguir capacidades reales y usar seek de TikTok sin fingirlo en las demás redes."
);
assert(
  youtubeEditor.includes("youtube-nocookie.com") &&
    youtubeEditor.includes("Marcar IN aquí") &&
    youtubeEditor.includes("Marcar OUT aquí"),
  "El editor YouTube existente debe permanecer intacto."
);

for (const signature of [
  "www.facebook.com/plugins/video.php",
  "www.instagram.com",
  "www.tiktok.com/player/v1",
  "player.vimeo.com/video",
  "platform.twitter.com/embed/Tweet.html",
  "player.twitch.tv",
  "clips.twitch.tv/embed",
  "geo.dailymotion.com/player.html",
  "streamable.com/e/",
  "player.kick.com",
]) {
  assert(
    directAdapters.includes(signature),
    `Falta el adaptador directo oficial/específico: ${signature}`
  );
}

assert(
  resolver.includes('kind: "webm"') &&
    resolver.includes('kind: "youtube"') &&
    resolver.includes('kind: "direct"') &&
    resolver.includes("validateDirectPlatformPreview"),
  "La card debe resolver WebM, YouTube o una plataforma directa explícita."
);
assert(
  card.includes("activateSharedYouTubeHoverPlayer") &&
    card.includes("activateSharedDirectPlatformHoverPlayer") &&
    card.includes("PREVIEW_DELAY_MS = 1_000") &&
    card.includes("prefers-reduced-motion: reduce") &&
    card.includes("(hover: hover) and (pointer: fine)"),
  "Las cards deben conservar 1 s de intención, accesibilidad y reproductores compartidos separados."
);
assert(
  directHover.includes("buildDirectPlatformEmbedUrl") &&
    directHover.includes("IDLE_DESTROY_MS") &&
    directHover.includes("about:blank") &&
    directHover.includes("durationMs") &&
    directHover.includes('type: "seekTo"') &&
    directHover.includes("window.location.hostname"),
  "Las redes directas deben compartir un único iframe, detenerse en OUT y resolver Twitch parent en runtime."
);
assert(
  youtubeHover.includes("youtube-nocookie.com") &&
    youtubeHover.includes("loadVideoById") &&
    youtubeHover.includes("startSeconds") &&
    youtubeHover.includes("endSeconds"),
  "El reproductor YouTube compartido debe seguir separado del resto."
);

assert(
  previewState.includes("directPreview") &&
    previewState.includes("private, no-store"),
  "El estado privado del editor debe incluir el preview directo sin cache."
);
assert(
  removeRoute.includes("directPreview: undefined") &&
    removeRoute.includes("youtubePreview: undefined") &&
    removeRoute.includes("previewClip: undefined"),
  "Quitar preview debe limpiar local, YouTube y plataforma directa."
);
assert(
  gameTypes.includes("GameDirectPreviewPlatform") &&
    gameTypes.includes("GameDirectPreview") &&
    gameTypes.includes("directPreview?: GameDirectPreview"),
  "El modelo debe representar la plataforma directa de forma discriminada."
);
assert(
  validation.includes("parseDirectPlatformPreview") &&
    validation.includes("directPreview") &&
    validationCore.includes("editorialGameSchema"),
  "La validación editorial debe conservar el núcleo previo y validar la extensión directa antes de persistirla."
);
assert(
  publicationChanges.includes("directPreview") &&
    publicationChanges.includes("reproductor directo aislado por plataforma"),
  "Publicación debe detectar cambios de URL/plataforma/tramo directo."
);

for (const origin of [
  "https://www.youtube-nocookie.com",
  "https://www.facebook.com",
  "https://www.instagram.com",
  "https://www.tiktok.com",
  "https://player.vimeo.com",
  "https://platform.twitter.com",
  "https://player.twitch.tv",
  "https://clips.twitch.tv",
  "https://geo.dailymotion.com",
  "https://streamable.com",
  "https://player.kick.com",
]) {
  assert(
    nextConfig.includes(origin),
    `CSP debe permitir sólo el origen de iframe declarado: ${origin}`
  );
}
assert(
  !nextConfig.includes('frame-src https:') &&
    !nextConfig.includes("frame-src *"),
  "CSP no debe abrir frame-src con comodines para soportar redes."
);

assert(
  streamedSource.includes("pipeline") &&
    streamedSource.includes("MAX_PREVIEW_SOURCE_BYTES") &&
    !streamedSource.includes("arrayBuffer"),
  "El archivo local de hasta 1 GiB debe seguir transmitiéndose a disco sin materializarse en RAM."
);
assert(
  transcoder.includes('"libvpx-vp9"') &&
    transcoder.includes('"-ss"') &&
    transcoder.includes('"-t"') &&
    transcoder.includes("shell: false"),
  "FFmpeg local debe conservar recorte y conversión segura sin shell."
);
assert(
  uploadRoute.includes("storeEditorialPreviewVideoFromPath") &&
    importRoute.includes("storeEditorialPreviewVideoFromPath"),
  "Ambos caminos locales deben seguir terminando en el conversor WebM validado."
);
assert(
  packageJson.includes(
    "node --import ./tools/register-ts-paths.mjs ./tools/check-card-preview-video.mjs"
  ),
  "El checker multimedia debe ejecutarse con el resolver TypeScript oficial del repositorio."
);

if (failures.length > 0) {
  console.error("");
  console.error("Preview de video en tarjetas: ERROR");
  console.error("");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Preview de video en tarjetas: OK (archivo local aislado + YouTube directo + Facebook/Instagram/TikTok/Vimeo/X/Twitch/Dailymotion/Streamable/Kick separados, sin importador universal)."
);
