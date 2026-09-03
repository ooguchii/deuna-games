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
] = await Promise.all([
  import("../src/lib/media/game-media-requirements.ts"),
  import("../src/lib/media/game-image-media.ts"),
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
]);

assert(
  has(
    requirements,
    'cover: "4:5"',
    'hero: "16:9"',
    'card: "3:2"',
    "viewport?.confirmed === true",
    "viewport.aspect === requiredAspect",
    "REQUIRED_DESTINATION_ASPECTS.hero",
    "REQUIRED_DESTINATION_ASPECTS.card",
    "game.screenshots?.length",
    "coverCropReady && heroCropReady && cardCropReady && galleryReady"
  ),
  "Los requisitos multimedia deben fijar Portada 4:5, Hero 16:9, Card 3:2 y Galería mínima 1 con confirmación explícita."
);

assert(
  types.includes("confirmed?: true") && types.includes('| "3:2"'),
  "Los tipos deben distinguir un viewport asignado de un recorte confirmado y admitir 3:2 para Card."
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
    "RECORTE PENDIENTE",
    "RECORTE CONFIRMADO",
    "Recortar 4:5",
    "Recortar 16:9",
    "Recortar 3:2",
    "IMAGEN REQUERIDA · MÍNIMO 1",
    "Continuar a Descargas",
    "allRequirementsReady"
  ),
  "El workspace debe mostrar estados obligatorios y bloquear el avance mientras falte un requisito."
);

assert(
  workspace.includes('heroDraftMode === "hover-video"') &&
    workspace.includes("heroImageCropReady && heroVideoCropReady") &&
    workspace.includes("Recortar imagen 16:9") &&
    workspace.includes("Recortar video 16:9"),
  "Imagen + hover debe exigir recorte 16:9 independiente para la imagen y el video."
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
    "requiredVideoViewport",
    'REQUIRED_DESTINATION_ASPECTS[target]',
    'target.data === "cover-image"',
    'target.data === "hero-video"',
    'target.data === "card-video"'
  ) &&
    !mediaLibraryRoute.includes("confirmed: true"),
  "Asignar/cambiar un recurso debe crear un viewport pendiente, nunca marcar el recorte como confirmado automáticamente."
);

assert(
  imageLayoutRoute.includes("confirmed: true") &&
    imageLayoutRoute.includes("saveGameMediaDraft") &&
    !imageLayoutRoute.includes("storeEditorialWebp") &&
    !imageLayoutRoute.includes("FFmpeg"),
  "Guardar un recorte de imagen debe confirmar sólo metadata y no modificar/copiar el archivo físico."
);

assert(
  has(
    videoLayoutRoute,
    "REQUIRED_DESTINATION_ASPECTS[target]",
    "submittedAspect !== requiredAspect",
    "withGameVideoLayout"
  ) &&
    !videoLayoutRoute.includes("storeEditorialPreviewVideo") &&
    !videoLayoutRoute.includes("FFmpeg"),
  "Hero/Card video deben validar su relación obligatoria en servidor y guardar el recorte sin recodificar."
);

assert(
  videoMedia.includes("confirmed: true") &&
    videoMedia.includes("withGameVideoLayout") &&
    videoMedia.includes("normalizeGameVideoViewport"),
  "Confirmar un layout de video debe persistir explícitamente su estado de recorte confirmado."
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
  publicationReadiness.match(/priority: "essential"/g)?.length >= 5,
  "Los cuatro requisitos multimedia deben ser esenciales junto con la ficha principal."
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
  "La publicación y la restauración deben bloquear en servidor y UI cualquier ficha sin esenciales completos."
);

assert(
  has(
    mediaIntegrity,
    "listGameVideoReferences",
    "game.videoMedia?.hero?.clip",
    'game.videoMedia?.card?.source === "independent"',
    "...listGameVideoReferences(game)"
  ),
  "La integridad de publicación debe comprobar Hero, Card independiente y preview histórico, además de las imágenes."
);

assert(
  has(
    adminPreview,
    "game.imageMedia?.cover",
    "game.imageMedia?.hero",
    "game.imageMedia?.gallery?.[image]"
  ),
  "La vista previa administrativa debe aplicar los mismos encuadres de imagen que la ficha pública."
);

assert(
  has(
    homeHero,
    "--hero-mobile-image-zoom",
    "--hero-mobile-image-position",
    "desktopSrc === game.coverImage",
    "mobileSrc === game.coverImage",
    "game.imageMedia?.cover"
  ) &&
    has(
      homeHeroCss,
      "--hero-mobile-image-zoom",
      "--hero-mobile-image-position"
    ),
  "El Hero móvil debe usar el encuadre de la Portada cuando cambia al archivo vertical de Portada."
);

assert(
  has(
    latestUpdates,
    "update.game",
    ".imageMedia",
    "?.card ??",
    "?.cover"
  ) &&
    has(
      updatesCatalog,
      'import GameMedia from "@/components/ui/GameMedia"',
      "update.game",
      ".imageMedia",
      "?.card ??",
      "?.cover"
    ),
  "Las tarjetas de actualizaciones de Home y catálogo deben consumir el recorte Card con fallback a Portada."
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
  "El carrusel destacado debe aplicar Hero al archivo Hero y un encuadre publicado compatible al fallback de Portada."
);

assert(
  has(
    accountPage,
    "imageViewport:",
    "game.imageMedia?.card ?? game.imageMedia?.cover",
    "gameImageViewport:",
    "update.game.imageMedia?.card ??",
    "entry.game.imageMedia?.card ??"
  ) &&
    has(
      accountDashboard,
      "viewport={game.imageViewport}",
      "viewport={recommendation.imageViewport}",
      "viewport={notification.gameImageViewport}"
    ),
  "Mi DeUna debe transportar y aplicar el encuadre Card en biblioteca, recomendaciones y avisos."
);

assert(
  downloadPage.includes("viewport={game.imageMedia?.cover}"),
  "La pantalla de descarga debe aplicar el recorte Portada 4:5 confirmado en el panel."
);

assert(
  has(
    gameImageMedia,
    "game.coverImage !== assignments.coverImage",
    "delete imageMedia.cover",
    "delete imageMedia.card",
    "game.heroImage !== assignments.heroImage",
    "delete imageMedia.hero"
  ) &&
    mediaRoute.includes("reconcileGameImageMedia") &&
    mediaUploadRoute.includes("reconcileGameImageMedia"),
  "Cambiar una imagen por rutas administrativas alternativas debe invalidar los recortes confirmados del recurso anterior."
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
  screenshots: ["/images/gallery.webp"],
  imageMedia: {
    cover: confirmedImageViewport,
    hero: confirmedImageViewport,
    card: confirmedImageViewport,
  },
};
const wrongAspectGame = {
  ...mediaReadyGame,
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
    screenshots: [],
  }
);

assert(
  !reconciledImageMedia?.cover &&
    !reconciledImageMedia?.card &&
    !reconciledImageMedia?.gallery &&
    Boolean(reconciledImageMedia?.hero),
  "La reconciliación real debe retirar encuadres obsoletos sin perder los que todavía pertenecen al mismo recurso."
);

assert(
  has(workspaceCss, ".requirementPending", ".continueGate", ".continueButton"),
  "Los estados pendientes y el bloqueo de avance deben tener estilos explícitos."
);

if (failures.length) {
  console.error("\nDestinos multimedia obligatorios: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Destinos multimedia obligatorios: OK (panel, persistencia, publicación, integridad física y consumo público conectados)."
);
