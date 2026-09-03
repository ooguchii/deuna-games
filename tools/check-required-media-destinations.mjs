import { access, readFile } from "node:fs/promises";
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
  requirements,
  types,
  videoMedia,
  workspace,
  workspaceCss,
  mediaViewportEditor,
  imageEditor,
  videoViewportEditor,
  imageLayoutRoute,
  videoLayoutRoute,
  mediaLibraryRoute,
  publicationReadiness,
  publicationWorkspace,
  publishRoute,
  restoreRoute,
  mediaIntegrity,
  gameImageMedia,
  mediaRoute,
  mediaUploadRoute,
  previewUploadRoute,
  previewImportRoute,
  homeHero,
  homeHeroCss,
  universalCard,
  cardPreview,
  coverMedia,
  latestUpdates,
  accountPage,
  accountDashboard,
  downloadPage,
  contentValidation,
] = await Promise.all([
  source("src/lib/media/game-media-requirements.ts"),
  source("src/types/game.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.module.css"),
  source("src/components/admin/MediaViewportEditor.tsx"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/components/admin/GamePublicationWorkspace.tsx"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/app/api/admin/content/publications/[publicationId]/restore/route.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/media/game-image-media.ts"),
  source("src/app/api/admin/content/games/[slug]/media/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/components/home/HeroSection.tsx"),
  source("src/components/home/HeroArtwork.module.css"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/GameCoverMedia.tsx"),
  source("src/components/home/LatestUpdates.tsx"),
  source("src/app/cuenta/page.tsx"),
  source("src/app/cuenta/AccountDashboardClient.tsx"),
  source("src/app/juegos/[slug]/descargar/page.tsx"),
  source("src/lib/admin/content-validation.ts"),
]);

assert(
  has(
    requirements,
    'cover: "4:5"',
    'hero: "16:9"',
    'card: "3:2"',
    "viewport?.confirmed === true",
    "viewport.aspect === requiredAspect",
    'if (mode === "image")',
    'if (mode === "video")',
    "assigned: imageAssigned && videoAssigned",
    "cropReady: imageReady && videoReady",
    'resolveGameDestinationMediaMode(game, "cover")',
    'resolveGameDestinationMediaMode(game, "hero")',
    'resolveGameDestinationMediaMode(game, "card")',
    "ready: cover.cropReady && hero.cropReady && card.cropReady && galleryReady"
  ),
  "Los requisitos multimedia deben exigir 4:5/16:9/3:2 y ambas capas cuando el modo es Imagen + hover."
);

assert(
  has(
    types,
    "confirmed?: true",
    '| "3:2"',
    "cardImage?: string",
    "export type GameDestinationMediaMode",
    "mediaModes?: GameMediaModes",
    "cover?: GameCoverVideo"
  ),
  "Game debe modelar Card independiente, modos por destino y video de Portada."
);

assert(
  has(
    videoMedia,
    "export const DEFAULT_GAME_MEDIA_MODES",
    'cover: "video"',
    'hero: "hover-video"',
    'card: "hover-video"',
    'export type GameVideoTarget = "cover" | "hero" | "card"',
    "resolveGameCoverVideo",
    "resolveGameDestinationMediaMode",
    "withGameVideoLayout",
    "confirmed: true"
  ),
  "Los defaults deben ser Portada=Video y Hero/Card=Imagen+hover con recortes independientes."
);

assert(
  has(
    contentValidation,
    "const resolvedCardImage = cardImage ?? game.coverImage",
    "cover: inferredMode(",
    "hero: inferredMode(",
    "card: inferredMode("
  ),
  "La compatibilidad histórica debe capturar la Card antigua sin volver a acoplarla a Portada."
);

const assignmentIndex = workspace.indexOf("Asignación de destinos");
const libraryIndex = workspace.indexOf("Biblioteca multimedia compartida");
assert(
  assignmentIndex >= 0 && libraryIndex > assignmentIndex,
  "Asignación de destinos debe aparecer antes que la Biblioteca compartida."
);

assert(
  has(
    workspace,
    "MODE_OPTIONS",
    '{ value: "image", label: "Imagen" }',
    '{ value: "video", label: "Video" }',
    '{ value: "hover-video", label: "Imagen + hover" }',
    'const coverMode = state?.assignments.coverMode ?? "video"',
    'const heroMode = state?.assignments.heroMode ?? "hover-video"',
    'const cardMode = state?.assignments.cardMode ?? "hover-video"',
    'target="cover"',
    'target="hero"',
    'target="card"',
    'target={`${destination}-image`}',
    'target={`${destination}-video`}',
    "const cardImage = state?.assignments.cardImage ?? null",
    "Recurso independiente",
    "Reutilizar sin acoplar",
    "RECORTE PENDIENTE",
    "RECORTE CONFIRMADO",
    "allRequirementsReady"
  ) &&
    !workspace.includes("Igualar al Hero") &&
    !workspace.includes("card-match-hero") &&
    !videoViewportEditor.includes("Usar imagen estática"),
  "El workspace debe conservar modos/defaults, Card independiente y no reintroducir acoplamientos especiales."
);

assert(
  has(
    workspace,
    "setState(parsed)",
    "const coverResource = imageBySrc(coverImage)",
    "const heroResource = imageBySrc(heroImage)",
    "const cardResource = imageBySrc(cardImage)",
    "const firstGalleryResource = imageBySrc(screenshots[0] ?? null)",
    "coverResource.src",
    "heroResource.src",
    "cardResource.src",
    "firstGalleryResource.src"
  ) &&
    has(
      mediaLibraryRoute,
      '"Cache-Control"',
      '"no-store"',
      "coverImage: item.payload.coverImage ?? null",
      "heroImage: item.payload.heroImage ?? null",
      "cardImage: item.payload.cardImage ?? null",
      "screenshots: item.payload.screenshots ?? []"
    ),
  "Las mini-previsualizaciones deben alimentarse de las asignaciones actuales devueltas sin caché por el servidor."
);

assert(
  has(
    mediaViewportEditor,
    'type MediaKind = "image" | "video"',
    "resolvePreviewViewportCrop",
    "viewportFrame",
    "viewportMoveHandle",
    "requestAnimationFrame",
    "scheduleViewportDraft",
    "Posición X",
    "Posición Y",
    "Zoom",
    "Relación del encuadre · obligatoria",
    "requiredAspect",
    "Izquierda",
    "Centro",
    "Derecha",
    "Restablecer encuadre",
    "resultCanvasRef",
    "Resultado final",
    'kind === "image"',
    'kind === "video"',
    'objectFit: "contain"',
    'onLoadedData={requestPreviewRedraw}',
    'onSeeked={requestPreviewRedraw}'
  ),
  "Debe existir un único motor espacial para imagen/video, con fuente completa, marco, drag, zoom, presets y resultado final."
);

assert(
  has(
    imageEditor,
    "MediaViewportEditor",
    'kind="image"',
    'target === "cover"',
    'target === "hero"',
    'target === "card"',
    'return "16:9"',
    "image-layout",
    "Confirmar recorte"
  ) &&
    !imageEditor.includes("<Image") &&
    !imageEditor.includes("resolvePreviewViewportCrop"),
  "Portada/Hero/Card/Galería de imagen deben delegar el encuadre al motor común, no implementar uno paralelo."
);

assert(
  has(
    videoViewportEditor,
    "MediaViewportEditor",
    'kind="video"',
    'type Target = "cover" | "hero" | "card"',
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "preview-layout",
    "Confirmar recorte"
  ) &&
    !videoViewportEditor.includes("VideoTrimEditor") &&
    !videoViewportEditor.includes("preview-remove") &&
    !videoViewportEditor.includes("Usar imagen estática"),
  "Portada/Hero/Card de video deben delegar el mismo motor espacial y guardar sólo su metadata."
);

try {
  await access(path.join(root, "src/components/admin/ImageViewportEditor.module.css"));
  failures.push("No debe sobrevivir el stylesheet del editor espacial de imagen anterior.");
} catch {
  // Correcto: el editor paralelo de imagen fue retirado.
}

assert(
  has(
    imageLayoutRoute,
    'const targetSchema = z.enum(["cover", "hero", "card", "gallery"])',
    'resolveGameDestinationMediaMode(game, target) === "video"',
    "Boolean(game.cardImage)",
    "confirmed: true",
    "saveGameMediaDraft"
  ) &&
    !imageLayoutRoute.includes("storeEditorialWebp") &&
    !imageLayoutRoute.includes("spawn("),
  "El recorte de imagen debe confirmar sólo metadata para Portada/Hero/Card/Galería."
);

assert(
  has(
    videoLayoutRoute,
    'value === "cover" || value === "hero" || value === "card"',
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "submittedAspect !== requiredAspect",
    "withGameVideoLayout"
  ) &&
    !videoLayoutRoute.includes("storeEditorialPreviewVideo") &&
    !videoLayoutRoute.includes("FFmpeg"),
  "El recorte de video debe exigir el aspecto del destino y guardar sólo metadata, sin recodificar."
);

assert(
  has(
    mediaLibraryRoute,
    '"cover-mode"',
    '"cover-image"',
    '"cover-video"',
    '"hero-mode"',
    '"hero-image"',
    '"hero-video"',
    '"card-mode"',
    '"card-image"',
    '"card-video"',
    "mediaModeUpdate",
    'source: "independent"',
    "cardImage: item.payload.cardImage"
  ) &&
    !mediaLibraryRoute.includes("card-match-hero"),
  "La API de biblioteca debe mantener recursos y modos independientes por destino."
);

const galleryRendererStart = workspace.indexOf("function renderGalleryAssignedItems");
const workspaceReturn = workspace.indexOf("\n  return (", galleryRendererStart);
const galleryRenderer = galleryRendererStart >= 0 && workspaceReturn > galleryRendererStart
  ? workspace.slice(galleryRendererStart, workspaceReturn)
  : "";
assert(
  galleryRenderer.includes('value="gallery-remove"') &&
    galleryRenderer.includes("Editar") &&
    !galleryRenderer.includes("DeleteImageResourceForm") &&
    !galleryRenderer.includes('value="image-delete"'),
  "Galería debe permitir Editar/Quitar sin hacer eliminación física desde sus capturas."
);

for (const id of ["cover-crop", "hero-crop", "card-crop", "gallery-minimum"]) {
  assert(publicationReadiness.includes(`id: "${id}"`), `Publicación debe exigir ${id}.`);
}
assert(
  publicationReadiness.match(/priority: "essential"/g)?.length >= 5 &&
    has(publishRoute, "evaluateGamePublicationReadiness", "readiness.essentialsReady", "preparacion-incompleta") &&
    has(restoreRoute, "evaluateGamePublicationReadiness", "readiness.essentialsReady", "restauracion-incompleta") &&
    publicationWorkspace.includes("!readiness.essentialsReady"),
  "Publicación/restauración deben bloquear destinos esenciales incompletos."
);

assert(
  has(
    mediaIntegrity,
    "game.coverImage",
    "game.heroImage",
    "game.cardImage",
    "game.videoMedia?.cover?.clip",
    "game.videoMedia?.hero?.clip",
    'game.videoMedia?.card?.source === "independent"'
  ),
  "La integridad física debe cubrir imágenes y videos independientes de los tres destinos."
);

assert(
  has(
    gameImageMedia,
    '"coverImage" | "heroImage" | "cardImage" | "screenshots"',
    "game.coverImage !== assignments.coverImage",
    "delete imageMedia.cover",
    "game.heroImage !== assignments.heroImage",
    "delete imageMedia.hero",
    "game.cardImage !== assignments.cardImage",
    "delete imageMedia.card"
  ),
  "Cambiar un recurso debe invalidar sólo el recorte del destino afectado."
);

assert(
  mediaRoute.includes("cardImage: item.payload.cardImage") &&
    mediaUploadRoute.includes("cardImage: item.payload.cardImage") &&
    !mediaUploadRoute.includes("withoutGameVideoTarget"),
  "Las rutas alternativas de imagen deben conservar Card y videos coexistentes."
);

for (const route of [previewUploadRoute, previewImportRoute]) {
  assert(
    has(
      route,
      'GameVideoTarget | "library"',
      'normalized === "cover"',
      'normalized === "library"',
      'target === "card" ? "card" : "hero"',
      "withSavedGameVideoClip",
      "recurso-subido"
    ),
    "Las rutas de video deben admitir Portada y library sin asignación automática del master."
  );
}

assert(
  has(
    homeHero,
    'resolveGameDestinationMediaMode(game, "hero")',
    'heroMode === "hover-video"',
    'heroMode !== "image"',
    "--hero-mobile-image-zoom",
    "game.imageMedia?.cover"
  ) &&
    has(homeHeroCss, "--hero-mobile-image-zoom", "--hero-mobile-image-position"),
  "Hero público debe respetar modo y encuadres sin perder comportamiento móvil."
);

assert(
  has(
    universalCard,
    'resolveGameDestinationMediaMode(game, "card")',
    "game.cardImage ?? game.coverImage",
    'cardMode === "video"',
    'cardMode === "hover-video"',
    "game.imageMedia?.card"
  ) && has(cardPreview, "resolveGameCardVideo"),
  "UniversalGameCard debe consumir Card independiente y su modo explícito."
);

assert(
  has(
    coverMedia,
    'resolveGameDestinationMediaMode(game, "cover")',
    "resolveGameCoverVideo(game)",
    'mode === "video"',
    'mode === "hover-video"',
    "game.imageMedia?.cover"
  ),
  "La ficha pública debe consumir Portada Imagen/Video/Imagen+hover con su recorte."
);

assert(
  has(latestUpdates, "update.game.cardImage ??", "update.game.coverImage", "?.card ??", "?.cover") &&
    has(
      accountPage,
      "game.cardImage ?? game.coverImage",
      "update.game.cardImage ?? update.game.coverImage",
      "entry.game.cardImage ?? entry.game.coverImage",
      "gameImageViewport:"
    ) &&
    has(
      accountDashboard,
      "viewport={game.imageViewport}",
      "viewport={recommendation.imageViewport}",
      "viewport={notification.gameImageViewport}"
    ) &&
    downloadPage.includes("viewport={game.imageMedia?.cover}"),
  "Actualizaciones, Mi DeUna y Descargas deben propagar las imágenes/encuadres independientes correctos."
);

assert(
  has(workspaceCss, ".requirementReady", ".requirementPending", ".continueGate", ".galleryManageGrid"),
  "El workspace debe conservar estados de requisitos y gestión de Galería visibles."
);

if (failures.length) {
  console.error("\nDestinos multimedia independientes: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Destinos multimedia independientes: OK (4:5/16:9/3:2 obligatorios → motor único imagen/video → previews actuales → publicación y consumo público coherentes)."
);
