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
  requirements,
  workspace,
  workspaceCss,
  imageEditor,
  imageLayoutRoute,
  mediaLibraryRoute,
  videoLayoutRoute,
  videoMedia,
  publicationReadiness,
  publicationWorkspace,
  publishRoute,
  restoreRoute,
  mediaIntegrity,
  homeHero,
  homeHeroCss,
  latestUpdates,
  accountPage,
  accountDashboard,
  downloadPage,
  gameImageMedia,
  mediaRoute,
  mediaUploadRoute,
  types,
  universalCard,
  cardPreview,
  coverMedia,
  contentValidation,
  videoViewportEditor,
  previewUploadRoute,
  previewImportRoute,
] = await Promise.all([
  source("src/lib/media/game-media-requirements.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.module.css"),
  source("src/components/admin/ImageViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/components/admin/GamePublicationWorkspace.tsx"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/app/api/admin/content/publications/[publicationId]/restore/route.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/components/home/HeroSection.tsx"),
  source("src/components/home/HeroArtwork.module.css"),
  source("src/components/home/LatestUpdates.tsx"),
  source("src/app/cuenta/page.tsx"),
  source("src/app/cuenta/AccountDashboardClient.tsx"),
  source("src/app/juegos/[slug]/descargar/page.tsx"),
  source("src/lib/media/game-image-media.ts"),
  source("src/app/api/admin/content/games/[slug]/media/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-upload/route.ts"),
  source("src/types/game.ts"),
  source("src/components/ui/UniversalGameCard.tsx"),
  source("src/lib/media/game-card-preview.ts"),
  source("src/components/ui/GameCoverMedia.tsx"),
  source("src/lib/admin/content-validation.ts"),
  source("src/components/admin/GameVideoViewportEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
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
    "Boolean(game.cardImage ?? game.coverImage)",
    "ready: cover.cropReady && hero.cropReady && card.cropReady && galleryReady"
  ),
  "Los requisitos multimedia deben respetar Imagen/Video/Imagen+hover, los aspectos 4:5/16:9/3:2 y exigir ambas capas en hover."
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
  "El contrato Game debe exponer Card independiente, modos por destino y video de Portada."
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
  "Los defaults deben ser Portada=Video y Hero/Card=Imagen+hover, con soporte de video y recorte para los tres destinos."
);

assert(
  has(
    contentValidation,
    "const resolvedCardImage = cardImage ?? game.coverImage",
    "cover: inferredMode(",
    "hero: inferredMode(",
    "card: inferredMode("
  ),
  "La normalización histórica debe capturar la imagen anterior de Card sin mantenerla acoplada a futuras Portadas."
);

const assignmentIndex = workspace.indexOf("Asignación de destinos");
const libraryIndex = workspace.indexOf("Biblioteca multimedia compartida");
assert(
  assignmentIndex >= 0 && libraryIndex > assignmentIndex,
  "Asignación de destinos debe aparecer antes que la Biblioteca multimedia compartida."
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
    "Continuar a Descargas",
    "allRequirementsReady"
  ) &&
    !workspace.includes("Igualar al Hero") &&
    !workspace.includes("card-match-hero") &&
    !videoViewportEditor.includes("Usar imagen estática"),
  "El workspace debe ofrecer los tres modos con los defaults pedidos, Card independiente y sin controles especiales de acoplamiento."
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
  "Galería debe permitir Editar/Quitar sin eliminación destructiva dentro de sus capturas."
);

assert(
  workspace.includes("<DeleteImageResourceForm") &&
    libraryIndex >= 0 &&
    workspace.indexOf("<DeleteImageResourceForm", libraryIndex) > libraryIndex,
  "La eliminación destructiva debe permanecer exclusivamente en la Biblioteca compartida."
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
    'target.data === "cover-video"',
    'target.data === "hero-video"',
    'target.data === "card-video"',
    'source: "independent"',
    "cardImage: item.payload.cardImage"
  ) &&
    !mediaLibraryRoute.includes("card-match-hero"),
  "La API de biblioteca debe tratar Portada, Hero y Card como destinos independientes con modos y recursos propios."
);

assert(
  has(
    imageLayoutRoute,
    'const targetSchema = z.enum(["cover", "hero", "card", "gallery"])',
    'resolveGameDestinationMediaMode(game, target) === "video"',
    "Boolean(game.cardImage)",
    "confirmed: true",
    "saveGameMediaDraft"
  ),
  "El recorte de imagen debe reconocer cardImage y permitir imagen junto a video cuando el modo es hover."
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
  "Portada/Hero/Card video deben confirmar sólo metadata de encuadre, sin recodificación."
);

assert(
  has(
    imageEditor,
    "RECORTE REQUERIDO",
    "Confirmar recorte",
    'css: "4 / 5"',
    'css: "16 / 9"',
    'css: "3 / 2"'
  ),
  "El editor de imagen debe presentar los marcos 4:5, 16:9 y 3:2."
);

assert(
  has(
    videoViewportEditor,
    'type Target = "cover" | "hero" | "card"',
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "layoutOnly",
    "preview-layout",
    "Confirmar recorte"
  ) &&
    !videoViewportEditor.includes("preview-remove") &&
    !videoViewportEditor.includes("Usar imagen estática"),
  "El editor de video debe recortar Portada/Hero/Card y dejar el cambio de modo al selector de destinos."
);

for (const id of ["cover-crop", "hero-crop", "card-crop", "gallery-minimum"]) {
  assert(publicationReadiness.includes(`id: "${id}"`), `Publicación debe exigir ${id}.`);
}
assert(
  publicationReadiness.match(/priority: "essential"/g)?.length >= 5,
  "Los destinos multimedia obligatorios deben seguir siendo esenciales para publicar."
);

assert(
  has(
    publishRoute,
    "evaluateGamePublicationReadiness",
    "readiness.essentialsReady",
    "preparacion-incompleta"
  ) &&
    has(
      restoreRoute,
      "evaluateGamePublicationReadiness",
      "readiness.essentialsReady",
      "restauracion-incompleta"
    ) &&
    publicationWorkspace.includes("!readiness.essentialsReady"),
  "Publicación y restauración deben bloquear fichas sin esenciales completos."
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
  "La integridad física debe cubrir imágenes y videos independientes de Portada/Hero/Card."
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
  "La reconciliación debe invalidar sólo el recorte del destino cuyo archivo cambió; Portada no debe limpiar Card."
);

assert(
  mediaRoute.includes("cardImage: item.payload.cardImage") &&
    mediaUploadRoute.includes("cardImage: item.payload.cardImage") &&
    !mediaUploadRoute.includes("withoutGameVideoTarget"),
  "Las rutas alternativas de imagen deben conservar Card y los videos coexistentes."
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
    "Las rutas de video local/remoto deben admitir Portada y mantener library como almacenamiento sin asignación automática."
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
  "Hero público debe respetar Imagen/Video/Imagen+hover sin perder el encuadre móvil."
);

assert(
  has(
    universalCard,
    'resolveGameDestinationMediaMode(game, "card")',
    "game.cardImage ?? game.coverImage",
    'cardMode === "video"',
    'cardMode === "hover-video"',
    "game.imageMedia?.card"
  ) &&
    has(cardPreview, "resolveGameCardVideo"),
  "UniversalGameCard debe consumir cardImage y el modo Card explícito, con fallback sólo para contenido histórico."
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
  "La Portada pública debe consumir Imagen/Video/Imagen+hover con su recorte 4:5."
);

assert(
  has(
    latestUpdates,
    "update.game.cardImage ??",
    "update.game.coverImage",
    "?.card ??",
    "?.cover"
  ),
  "Las tarjetas de actualizaciones de Home deben usar la imagen Card independiente con fallback histórico."
);

assert(
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
    ),
  "Mi DeUna debe transportar la imagen y el encuadre Card independientes."
);

assert(
  downloadPage.includes("viewport={game.imageMedia?.cover}"),
  "La pantalla de descarga debe mantener el recorte Portada confirmado."
);

assert(
  has(workspaceCss, ".requirementPending", ".continueGate", ".continueButton"),
  "Los estados pendientes y el bloqueo de avance deben tener estilos explícitos."
);

if (failures.length) {
  console.error("\nDestinos multimedia independientes: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Destinos multimedia independientes: OK (contrato, defaults, Card propia, modos, recortes, publicación e integración pública)."
);
