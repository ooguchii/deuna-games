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
  { evaluateGameMediaRequirements },
  { reconcileGameImageMedia },
  { DEFAULT_GAME_MEDIA_MODES },
] = await Promise.all([
  import("../src/lib/media/game-media-requirements.ts"),
  import("../src/lib/media/game-image-media.ts"),
  import("../src/lib/media/game-video-media.ts"),
]);

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
  adminPreview,
  homeHero,
  homeHeroCss,
  latestUpdates,
  featuredUpdates,
  updatesCatalog,
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
  source("src/app/admin/(protected)/juegos/[slug]/vista-previa/page.tsx"),
  source("src/components/home/HeroSection.tsx"),
  source("src/components/home/HeroArtwork.module.css"),
  source("src/components/home/LatestUpdates.tsx"),
  source("src/components/updates/FeaturedUpdatesSlider.tsx"),
  source("src/components/updates/UpdatesCatalogClient.tsx"),
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
]);

assert(
  has(
    requirements,
    'cover: "4:5"',
    'hero: "16:9"',
    'card: "3:2"',
    "viewport?.confirmed === true",
    "viewport.aspect === requiredAspect",
    'resolveGameDestinationMediaMode(game, "cover")',
    'resolveGameDestinationMediaMode(game, "hero")',
    'resolveGameDestinationMediaMode(game, "card")',
    "imageAssigned && videoAssigned",
    "cover.cropReady && hero.cropReady && card.cropReady && galleryReady"
  ),
  "Los requisitos multimedia deben respetar el modo activo de Portada/Hero/Card y confirmar sus recortes obligatorios."
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
  "El contrato Game debe tener Card independiente y modos multimedia por destino."
);

assert(
  DEFAULT_GAME_MEDIA_MODES.cover === "video" &&
    DEFAULT_GAME_MEDIA_MODES.hero === "hover-video" &&
    DEFAULT_GAME_MEDIA_MODES.card === "hover-video",
  "Los defaults editoriales deben ser Portada=Video y Hero/Card=Imagen + hover."
);

assert(
  has(
    contentValidation,
    "const resolvedCardImage = cardImage ?? game.coverImage",
    "cover: inferredMode(",
    '"video"',
    "hero: inferredMode(",
    '"hover-video"',
    "card: inferredMode("
  ),
  "La lectura debe migrar Card históricas sin volver a acoplarlas a futuras modificaciones de Portada."
);

const assignmentIndex = workspace.indexOf("Asignación de destinos");
const libraryIndex = workspace.indexOf("Biblioteca multimedia compartida");
assert(
  assignmentIndex >= 0 && libraryIndex > assignmentIndex,
  "Asignación de destinos debe aparecer antes que la Biblioteca multimedia compartida."
);

for (const target of ["cover", "hero", "card"]) {
  assert(
    workspace.includes(`target=\"${target}\"`) &&
      workspace.includes(`target={\"${target}\"}`) === false,
    `El workspace debe renderizar un selector explícito para ${target}.`
  );
}

assert(
  has(
    workspace,
    'const coverMode = state?.assignments.coverMode ?? "video"',
    'const heroMode = state?.assignments.heroMode ?? "hover-video"',
    'const cardMode = state?.assignments.cardMode ?? "hover-video"',
    'target={`${destination}-image`}',
    'target={`${destination}-video`}',
    "cardImage",
    "Imagen + hover",
    "Recortar imagen 16:9",
    "Recortar video 16:9",
    "RECORTE PENDIENTE",
    "RECORTE CONFIRMADO",
    "Continuar a Descargas",
    "allRequirementsReady"
  ),
  "El workspace debe mostrar los tres modos, defaults pedidos y recortes por capa."
);

assert(
  !workspace.includes("Igualar al Hero") &&
    !workspace.includes("card-match-hero") &&
    !videoViewportEditor.includes("Usar imagen estática"),
  "Card no debe conservar botones especiales que vuelvan a acoplarla con Hero o cambien el modo por fuera del selector."
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
  "Galería debe permitir sólo Editar/Quitar; la eliminación destructiva no debe renderizarse dentro de sus capturas."
);

assert(
  workspace.includes("<DeleteImageResourceForm") &&
    libraryIndex >= 0 &&
    workspace.indexOf("<DeleteImageResourceForm", libraryIndex) > libraryIndex,
  "La eliminación destructiva debe permanecer disponible en la Biblioteca compartida."
);

assert(
  has(
    mediaLibraryRoute,
    '"cover-mode"',
    '"hero-mode"',
    '"card-mode"',
    '"card-image"',
    '"cover-video"',
    'target.data === "cover-video"',
    'target.data === "hero-video"',
    'target.data === "card-video"',
    'source: "independent"',
    "mediaModeUpdate"
  ) &&
    !mediaLibraryRoute.includes("card-match-hero"),
  "La API de asignación debe tratar Portada, Hero y Card como destinos independientes con modos propios."
);

assert(
  has(
    imageLayoutRoute,
    'resolveGameDestinationMediaMode(game, target) === "video"',
    "Boolean(game.cardImage)",
    "confirmed: true",
    "saveGameMediaDraft"
  ) &&
    !imageLayoutRoute.includes("resolveGameCardVideo"),
  "El recorte de Card debe validar cardImage y permitir coexistencia imagen+video en hover."
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
  "Portada/Hero/Card video deben guardar recorte por metadata sin recodificar."
);

assert(
  videoMedia.includes("confirmed: true") &&
    videoMedia.includes('GameVideoTarget = "cover" | "hero" | "card"') &&
    videoMedia.includes("resolveGameCoverVideo") &&
    videoMedia.includes("resolveGameDestinationMediaMode") &&
    videoMedia.includes("withGameVideoLayout"),
  "La capa de video debe soportar los tres destinos y persistir recortes confirmados."
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
  "El editor de imagen debe mostrar el marco real requerido para Portada/Hero/Card."
);

for (const id of ["cover-crop", "hero-crop", "card-crop", "gallery-minimum"]) {
  assert(publicationReadiness.includes(`id: "${id}"`), `Publicación debe exigir ${id}.`);
}
assert(
  publicationReadiness.includes("La Card tiene asignación independiente de la Portada") &&
    publicationReadiness.match(/priority: "essential"/g)?.length >= 5,
  "La preparación debe documentar y exigir la independencia de Card."
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
  "La publicación y restauración deben seguir bloqueando fichas incompletas."
);

assert(
  has(
    mediaIntegrity,
    "game.cardImage",
    "game.videoMedia?.cover?.clip",
    "game.videoMedia?.hero?.clip",
    'game.videoMedia?.card?.source === "independent"'
  ),
  "La integridad física debe incluir imagen Card y videos de Portada/Hero/Card."
);

assert(
  has(
    homeHero,
    'resolveGameDestinationMediaMode(game, "hero")',
    'heroMode === "hover-video"',
    'heroMode !== "image"',
    "--hero-mobile-image-zoom",
    "game.imageMedia?.cover"
  ) &&
    has(
      homeHeroCss,
      "--hero-mobile-image-zoom",
      "--hero-mobile-image-position"
    ),
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
    has(
      cardPreview,
      'resolveGameDestinationMediaMode(game, "card") === "image"',
      "resolveGameCardVideo"
    ),
  "UniversalGameCard debe consumir cardImage y el modo Card explícito."
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
    featuredUpdates,
    "backdropViewport",
    "?.hero",
    "?.card ??",
    "viewport={",
    "imageClassName="
  ),
  "El carrusel destacado debe mantener los encuadres Hero/fallback existentes."
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
  has(
    gameImageMedia,
    "game.coverImage !== assignments.coverImage",
    "delete imageMedia.cover",
    "game.cardImage !== assignments.cardImage",
    "delete imageMedia.card",
    "game.heroImage !== assignments.heroImage",
    "delete imageMedia.hero"
  ) &&
    mediaRoute.includes("cardImage: item.payload.cardImage") &&
    mediaUploadRoute.includes("cardImage: item.payload.cardImage"),
  "Las rutas alternativas deben conservar Card y sólo invalidar el recorte del destino cuyo recurso cambió."
);

assert(
  adminPreview.includes("game.imageMedia?.cover") &&
    adminPreview.includes("game.imageMedia?.hero"),
  "La vista previa administrativa debe mantener los encuadres principales del borrador."
);

assert(
  updatesCatalog.includes('import GameMedia from "@/components/ui/GameMedia"'),
  "El catálogo de actualizaciones debe conservar su superficie multimedia validada."
);

const confirmedImageViewport = {
  x: 0.5,
  y: 0.5,
  zoom: 1,
  confirmed: true,
};
const mediaReadyGame = {
  id: "media-check",
  slug: "media-check",
  title: "Media check",
  description: "Verificación de integración multimedia.",
  category: "Acción",
  imageAlt: "Media check",
  coverImage: "/images/cover.webp",
  heroImage: "/images/hero.webp",
  cardImage: "/images/card.webp",
  screenshots: ["/images/gallery.webp"],
  mediaModes: {
    cover: "image",
    hero: "image",
    card: "image",
  },
  imageMedia: {
    cover: confirmedImageViewport,
    hero: confirmedImageViewport,
    card: confirmedImageViewport,
  },
};

assert(
  evaluateGameMediaRequirements(mediaReadyGame).ready,
  "Tres imágenes independientes confirmadas más Galería deben completar los requisitos."
);

const wrongAspectGame = {
  ...mediaReadyGame,
  mediaModes: {
    ...mediaReadyGame.mediaModes,
    hero: "video",
  },
  videoMedia: {
    hero: {
      clip: `/media/editorial/media-check/${"a".repeat(64)}.webm`,
      viewport: {
        x: 0.5,
        y: 0.5,
        zoom: 1,
        aspect: "source",
        confirmed: true,
      },
    },
  },
};
const correctAspectGame = {
  ...wrongAspectGame,
  videoMedia: {
    hero: {
      ...wrongAspectGame.videoMedia.hero,
      viewport: {
        ...wrongAspectGame.videoMedia.hero.viewport,
        aspect: "16:9",
      },
    },
  },
};

assert(
  !evaluateGameMediaRequirements(wrongAspectGame).hero.cropReady &&
    evaluateGameMediaRequirements(correctAspectGame).hero.cropReady,
  "Un video confirmado con relación incorrecta no debe superar la preparación del destino."
);

const hoverGame = {
  ...mediaReadyGame,
  mediaModes: {
    ...mediaReadyGame.mediaModes,
    card: "hover-video",
  },
  videoMedia: {
    card: {
      source: "independent",
      clip: `/media/editorial/media-check/${"b".repeat(64)}.webm`,
      viewport: {
        x: 0.5,
        y: 0.5,
        zoom: 1,
        aspect: "3:2",
        confirmed: true,
      },
    },
  },
};
assert(
  evaluateGameMediaRequirements(hoverGame).card.cropReady,
  "Imagen + hover debe exigir y aceptar ambos recortes Card independientes."
);

const reconciledImageMedia = reconcileGameImageMedia(
  {
    ...mediaReadyGame,
    imageMedia: {
      ...mediaReadyGame.imageMedia,
      gallery: {
        "/images/gallery.webp": confirmedImageViewport,
      },
    },
  },
  {
    coverImage: "/images/new-cover.webp",
    heroImage: mediaReadyGame.heroImage,
    cardImage: mediaReadyGame.cardImage,
    screenshots: [],
  }
);

assert(
  !reconciledImageMedia?.cover &&
    Boolean(reconciledImageMedia?.card) &&
    !reconciledImageMedia?.gallery &&
    Boolean(reconciledImageMedia?.hero),
  "Cambiar Portada no debe borrar ni modificar el recorte independiente de Card."
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
  "Destinos multimedia independientes: OK (Portada/Hero/Card, modos, recortes, publicación e integración pública)."
);
