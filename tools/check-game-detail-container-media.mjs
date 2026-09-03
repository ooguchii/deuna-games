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
  types,
  validation,
  requirements,
  videoMedia,
  integrity,
  readiness,
  libraryRoute,
  imageLayoutRoute,
  videoLayoutRoute,
  workspace,
  detailEditor,
  imageEditor,
  videoEditor,
  publicPage,
  publicRuntime,
  publicRuntimeCss,
] = await Promise.all([
  source("src/types/game.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/media/game-media-requirements.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameDetailMediaEditor.tsx"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/app/juegos/[slug]/page.tsx"),
  source("src/components/games/GameDetailContainerMedia.tsx"),
  source("src/components/games/GameDetailContainerMedia.module.css"),
]);

assert(
  has(
    types,
    "detailImage?: string",
    "detail?: GameImageViewport",
    "detail?: GameDestinationMediaMode",
    "export type GameDetailVideo = GameDestinationVideo",
    "detail?: GameDetailVideo"
  ),
  "Game debe modelar Contenedor como destino propio de imagen/modo/video/recorte."
);

assert(
  has(
    validation,
    "detail: fixedImageViewportSchema.optional()",
    "detail: mediaModeSchema.optional()",
    "detail: destinationVideoSchema.optional()",
    "const resolvedDetailImage = detailImage ?? game.heroImage ?? game.coverImage",
    "const legacyDetailMigration = detailImage === undefined && Boolean(resolvedDetailImage)",
    "inheritedDetailViewport",
    "detail: {",
    "confirmed: true as const",
    "detail: inferredMode("
  ) &&
    !validation.includes("storeEditorialWebp") &&
    !validation.includes("storeEditorialPreviewVideo"),
  "La compatibilidad histórica debe capturar Hero/Portada por referencia y metadata, sin copiar ni recodificar bytes."
);

assert(
  has(
    requirements,
    'GAME_DETAIL_VIEWPORT_ASPECT = "source"',
    'resolveGameDestinationMediaMode(game, "detail")',
    'resolveGameDestinationImage(game, "detail")',
    "game.imageMedia?.detail",
    "game.videoMedia?.detail?.clip",
    "detail.cropReady"
  ),
  "Contenedor debe ser adaptable y participar del gate según Imagen/Video/Imagen+hover."
);

assert(
  has(
    videoMedia,
    'GameVideoTarget = "cover" | "hero" | "card" | "detail"',
    'detail: "image"',
    'return game.detailImage ?? game.heroImage ?? game.coverImage',
    "resolveGameDetailVideo",
    'target === "detail"',
    "detail: {",
    "detail: undefined"
  ),
  "Los helpers compartidos de video deben tratar Contenedor como destino independiente con default Imagen."
);

assert(
  has(
    integrity,
    "game.detailImage",
    "game.videoMedia?.detail?.clip"
  ),
  "La integridad física debe proteger los bytes referenciados por Contenedor."
);

assert(
  has(
    readiness,
    'id: "detail-container-media"',
    "Contenedor de la ficha · adaptable",
    "complete: media.detail.cropReady",
    'priority: "essential"'
  ),
  "Publicación debe exigir un Contenedor completo después de la migración compatible."
);

assert(
  has(
    libraryRoute,
    '"detail-mode"',
    '"detail-image"',
    '"detail-video"',
    "detailImage: item.payload.detailImage ?? null",
    'detailMode: resolveGameDestinationMediaMode(item.payload, "detail")',
    "detailVideo: item.payload.videoMedia?.detail ?? null",
    "delete imageMedia.detail",
    "game.detailImage === resource",
    'target.data === "detail-image"',
    'target.data === "detail-video"',
    'requiredVideoViewport("detail")'
  ) &&
    !libraryRoute.includes("storeEditorialWebp") &&
    !libraryRoute.includes("storeEditorialPreviewVideo") &&
    !libraryRoute.includes("spawn("),
  "Biblioteca debe asignar/limpiar Contenedor por referencia sin trabajo físico."
);

assert(
  has(
    imageLayoutRoute,
    '"detail"',
    'target === "detail"',
    "Boolean(game.detailImage)",
    "saveGameMediaDraft"
  ) &&
    has(
      videoLayoutRoute,
      'target === "detail"',
      "GAME_DETAIL_VIEWPORT_ASPECT",
      'source !== "independent"',
      "withGameVideoLayout"
    ),
  "Imagen y video de Contenedor deben persistir X/Y/zoom mediante los endpoints compartidos."
);

assert(
  has(
    workspace,
    'import GameDetailMediaEditor from "@/components/admin/GameDetailMediaEditor"',
    "detailImage: string | null",
    "detailMode: GameDestinationMediaMode",
    "detailVideo: GameDetailVideo | null",
    "const detailCropReady = cropReady(",
    "coverCropReady && heroCropReady && cardCropReady && detailCropReady && galleryReady",
    'labels.push(detailMode === "hover-video" ? "Contenedor base" : "Contenedor")',
    'labels.push(detailMode === "hover-video" ? "Contenedor hover" : "Contenedor")',
    "<GameDetailMediaEditor",
    "<span>F</span><h3>Galería del juego</h3>"
  ),
  "Workspace debe incluir Contenedor en resumen/gate/Biblioteca y conservar Galería como destino F."
);

assert(
  has(
    detailEditor,
    "Contenedor de la ficha",
    "Obligatorio · recorte adaptable",
    "Imagen + hover",
    "Recurso independiente del Hero",
    "Recorte adaptable ·",
    "RECORTE ADAPTABLE CONFIRMADO",
    "RECORTE ADAPTABLE NO CONFIRMADO",
    "ImageViewportEditor",
    "GameVideoViewportEditor",
    'target="detail"'
  ) &&
    !detailEditor.includes("fetch(endpoint"),
  "La tarjeta debe reutilizar revisión/recursos del workspace y los editores comunes, sin segunda lectura de biblioteca."
);

assert(
  has(
    imageEditor,
    'type Target = "cover" | "hero" | "card" | "detail" | "gallery"',
    "GAME_DETAIL_VIEWPORT_ASPECT",
    'target === "detail"',
    '"Confirmar recorte adaptable"'
  ) &&
    has(
      videoEditor,
      'type Target = "cover" | "hero" | "card" | "detail"',
      "GAME_DETAIL_VIEWPORT_ASPECT",
      'target === "detail"',
      '"Confirmar recorte adaptable"'
    ),
  "Los adaptadores comunes deben aceptar detail=source sin habilitar recorte Libre fuera de Galería."
);

assert(
  has(
    publicPage,
    'import GameDetailContainerMedia from "@/components/games/GameDetailContainerMedia"',
    'resolveGameDestinationImage(game, "detail")',
    'resolveGameDestinationMediaMode(game, "detail")',
    "game.imageMedia?.detail",
    "data-game-detail-media-scope",
    "<GameDetailContainerMedia",
    "video={game.videoMedia?.detail}"
  ) &&
    !publicPage.includes('src={game.heroImage ?? game.coverImage}\n              alt=""\n              sizes="100vw"\n              priority'),
  "La ficha pública debe dejar de renderizar Hero directamente como fondo interno y consumir el destino detail."
);

assert(
  has(
    publicRuntime,
    "GameMedia",
    "FramedVideo",
    "FINE_POINTER_MEDIA",
    "REDUCED_MOTION_MEDIA",
    'INTERACTION_SCOPE = "[data-game-detail-media-scope]"',
    "documentVisible",
    "hoverActive",
    "failedVideo",
    'mode === "video" || (fineHover && hoverActive)',
    "pointerenter",
    "pointerleave",
    "focusin",
    "focusout",
    'preload="metadata"',
    "onError={() => setFailedVideo(video.clip)}"
  ) &&
    has(
      publicRuntimeCss,
      ".imageLayer",
      ".videoLayer",
      "@media (prefers-reduced-motion: reduce)"
    ),
  "Runtime debe mantener imagen fallback y montar video sólo cuando corresponda, respetando hover real, teclado, reduced-motion, visibilidad y error."
);

if (failures.length) {
  console.error("\nGame detail container media: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Game detail container media: OK (destino independiente, migración sin copias, recorte adaptable, tres modos y runtime con presupuesto de movimiento)."
);
