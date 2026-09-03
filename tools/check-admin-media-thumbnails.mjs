import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const has = (text, ...needles) => needles.every((needle) => text.includes(needle));

const [
  packageJson,
  thumbnail,
  thumbnailCss,
  frameCache,
  framedLayout,
  framedVideo,
  workspace,
  detailEditor,
  backgroundEditor,
] = await Promise.all([
  source("package.json"),
  source("src/components/admin/AdminMediaThumbnail.tsx"),
  source("src/components/admin/AdminMediaThumbnail.module.css"),
  source("src/lib/media/admin-video-frame-cache.ts"),
  source("src/lib/media/framed-media-layout.ts"),
  source("src/components/ui/FramedVideo.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameDetailMediaEditor.tsx"),
  source("src/components/admin/GameBackgroundMediaEditor.tsx"),
]);

assert(
  packageJson.includes("check-admin-media-thumbnails.mjs"),
  "El checker de miniaturas administrativas debe formar parte del pipeline principal."
);

assert(
  has(
    thumbnail,
    'mode: "source" | "destination"',
    "normalizeGameImageViewport",
    "destinationImageViewport",
    "IntersectionObserver",
    'rootMargin: "200px"',
    "subscribeAdminVideoFrame",
    "resolveFramedMediaLayout",
    'data-admin-media-mode={mode}',
    "Vista no disponible",
    "retryAdminVideoFrame"
  ) &&
    !thumbnail.includes("ThumbnailBadge") &&
    !thumbnail.includes("Vista comprobada") &&
    !thumbnail.includes("playIndicator" + " size"),
  "Debe existir un único thumbnail lazy, limpio y fiel que distinga fuente/destino sin overlays sobre la imagen."
);

assert(
  has(
    thumbnailCss,
    ".destinationImageViewport",
    "transform: scale(var(--admin-image-zoom, 1))",
    ".destinationImage",
    "object-position: var(--admin-image-position, 50% 50%)",
    '.root[data-admin-media-kind="image"][data-admin-media-mode="source"] .sourceImage',
    "transform: scale(1.015)"
  ) &&
    !thumbnailCss.includes(".badge") &&
    !thumbnailCss.includes(".playIndicator") &&
    !thumbnailCss.includes(".verification"),
  "Las imágenes deben aplicar el viewport guardado en destino y un relleno mínimo sólo en previews de fuente, sin etiquetas superpuestas."
);

assert(
  has(
    frameCache,
    "MAX_ADMIN_VIDEO_FRAME_DIMENSION = 640",
    "MAX_ADMIN_VIDEO_FRAME_CACHE_ENTRIES = 72",
    "MAX_ADMIN_VIDEO_FRAME_DECODES = 2",
    'document.createElement("video")',
    'document.createElement("canvas")',
    "requestVideoFrameCallback",
    "ADMIN_VIDEO_FRAME_CALLBACK_GRACE_MS",
    "frameFallbackTimeoutId = window.setTimeout",
    "settled || drawStarted",
    "canvas.toBlob",
    "URL.createObjectURL",
    "URL.revokeObjectURL",
    'window.addEventListener("pagehide"',
    "if (!event.persisted) clearAdminVideoFrameCache()",
    "entry.listeners.size === 0",
    "decodeQueue",
    "disposeVideo(video)"
  ),
  "Los WebM deben generar un frame reducido, efímero, acotado por LRU y con máximo dos decodificaciones simultáneas."
);

for (const forbidden of [
  "localStorage",
  "indexedDB",
  "serviceWorker",
  "toDataURL",
  "ffmpeg",
  "writeFile",
]) {
  assert(
    !frameCache.toLowerCase().includes(forbidden.toLowerCase()),
    `La caché temporal no puede usar persistencia ni procesamiento físico: ${forbidden}.`
  );
}

assert(
  has(
    framedLayout,
    "resolvePreviewViewportCrop",
    "export function resolveFramedMediaLayout",
    "frameWidth / crop.width",
    "frameHeight / crop.height"
  ) &&
    framedVideo.includes("resolveFramedMediaLayout") &&
    !framedVideo.includes("resolvePreviewViewportCrop"),
  "FramedVideo y las miniaturas deben compartir una sola matemática de encuadre de video sin cambiar el runtime público."
);

assert(
  has(
    workspace,
    'import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail"',
    "DestinationThumbnailSet",
    'mode="source"',
    'mode="destination"',
    "imageMedia?.cover",
    "imageMedia?.hero",
    "imageMedia?.card",
    "imageMedia?.gallery?.[src]",
    "resolveGameImageCropAspectRatio(galleryViewport)",
    "activeCardVideoViewport",
    "summaryMediaSet",
    "summaryThumb"
  ) &&
    !workspace.includes("No se reproduce hasta abrir un editor.") &&
    !workspace.includes('badge="FUENTE"') &&
    !workspace.includes('badge={adaptive'),
  "Workspace debe mostrar fuentes limpias, recortes reales y miniaturas visuales también en el resumen obligatorio."
);

assert(
  has(
    workspace,
    'mode === "hover-video"',
    'kind="image"',
    'kind="video"',
    "showImage && showVideo"
  ),
  "Imagen + hover debe enseñar por separado imagen y frame de video sin taparlos con etiquetas internas."
);

for (const [name, editor] of [
  ["Contenedor", detailEditor],
  ["Fondo", backgroundEditor],
]) {
  assert(
    has(
      editor,
      "AdminMediaThumbnail",
      'mode="source"',
      'mode="destination"',
      "assignment.imageViewport",
      "assignment.video?.viewport",
      'frameAspect={16 / 9}'
    ),
    `${name} debe diferenciar fuentes de su vista adaptable representativa y aplicar el viewport de cada capa.`
  );
}

if (failures.length > 0) {
  console.error("\nMiniaturas multimedia administrativas: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Miniaturas multimedia administrativas: OK (fuente limpia · recorte fiel · resumen visual · WebM efímero compartido · lazy/LRU/cola)."
);
