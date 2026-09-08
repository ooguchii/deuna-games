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
  types,
  assignments,
  multimediaEditor,
  imageLayoutRoute,
  mediaLibraryRoute,
  contentValidation,
  gameCover,
  publicationReadiness,
  publicationWorkspace,
  publishRoute,
  restoreRoute,
  cardPresentation,
  homeConfig,
  homeEditor,
  homePage,
] = await Promise.all([
  source("src/lib/media/game-media-requirements.ts"),
  source("src/types/game.ts"),
  source("src/components/admin/GameMediaAssignmentsWorkspace.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/image-layout/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/components/ui/GameCoverMedia.tsx"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/components/admin/GamePublicationWorkspace.tsx"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/app/api/admin/content/publications/[publicationId]/restore/route.ts"),
  source("src/lib/media/game-card-presentation.ts"),
  source("src/data/home-config.ts"),
  source("src/components/admin/HomePresentationEditor.tsx"),
  source("src/app/page.tsx"),
]);

assert(
  has(
    requirements,
    'cover: "4:5"',
    'hero: "3:1"',
    'card: "3:2"',
    'const coverMode = "image" as const',
    "cover.cropReady &&",
    "card.cropReady &&",
    "galleryCropReady"
  ),
  "El contrato central debe tratar cover como poster image-only 4:5 de Card, conservar Hero 3:1 y detalle Card 3:2, y exigir ambos layers."
);

assert(
  has(
    assignments,
    "Card es la presentación principal del juego",
    "Card del juego",
    "Portada inicial",
    "Vista informativa",
    'target="cover-image"',
    'target="card"',
    'target="card-image"',
    'target="card-video"',
    'aspect="4:5"',
    'aspect="3:2"',
    "La Home decide por fila si usa Portada, Info + imagen o Info + video"
  ) &&
    !assignments.includes("<h3>Portada del juego</h3>") &&
    !assignments.includes('target="cover"\n                mode='),
  "Asignación de destinos debe exponer una sola Card con poster 4:5 image-only y detalle 3:2, sin revivir Portada como destino con modo propio."
);

assert(
  multimediaEditor.includes("GameMediaAssignmentsWorkspace") &&
    !multimediaEditor.includes("GameMultimediaWorkspaceContextual") &&
    multimediaEditor.includes("GameGalleryMediaManager") &&
    multimediaEditor.includes("GameMediaAccessibilityEditor"),
  "El editor multimedia visible debe usar el workspace unificado sin perder Galería ni accesibilidad."
);

assert(
  has(
    imageLayoutRoute,
    'const fixedImageTargets = ["cover", "hero", "card"] as const',
    "REQUIRED_DESTINATION_ASPECTS[target.data]",
    "viewport.aspect !== REQUIRED_DESTINATION_ASPECTS[target.data]",
    "confirmed: true"
  ),
  "La API de crop debe conservar las claves compatibles cover/hero/card y validar la relación exigida en servidor."
);

assert(
  has(
    mediaLibraryRoute,
    '"cover-image"',
    '"hero-mode"',
    '"card-mode"',
    '"card-image"',
    '"card-video"',
    "expectedRevision",
    "hasExactAdminFormFields",
    "authorizeAdminFormRequest"
  ),
  "La biblioteca debe conservar autorización, revisión optimista y asignaciones de los dos layers internos de Card."
);

assert(
  has(
    contentValidation,
    "imageViewportAspectSchema",
    '"3:1"',
    '"3:2"',
    '"4:5"',
    "cardVideoSchema",
    "mediaModesSchema"
  ),
  "La validación editorial debe seguir aceptando snapshots históricos y metadata de Card/Hero segura."
);

assert(
  has(
    gameCover,
    "game.coverImage ?? game.cardImage",
    "game.imageMedia?.cover ?? game.imageMedia?.card",
    'aspectRatio: "4 / 5"'
  ) &&
    !gameCover.includes("resolveGameCoverVideo") &&
    !gameCover.includes("FramedVideo") &&
    !gameCover.includes("onMouseEnter"),
  "La portada de la ficha debe consumir el poster image-only de Card, sin un segundo contrato de video Cover."
);

assert(
  publicationReadiness.includes('id: "card-crop"') &&
    publicationReadiness.includes("complete: media.cover.cropReady && media.card.cropReady") &&
    publicationReadiness.includes("Card · portada") &&
    !publicationReadiness.includes('id: "cover-crop"'),
  "Publicación debe presentar Card como un solo requisito compuesto, no Portada y Card como destinos separados."
);

assert(
  publicationWorkspace.includes("!readiness.essentialsReady") &&
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
    ),
  "Publicar y restaurar deben seguir bloqueando snapshots que no cumplen el contrato multimedia esencial."
);

assert(
  has(
    cardPresentation,
    '"poster"',
    '"detail-image"',
    '"detail-video"',
    'DEFAULT_HOME_GAME_CARD_PRESENTATION',
    '"popular"',
    '"recent"',
    '"lowSpec"',
    '"recommended"'
  ),
  "La presentación de Card debe tener un contrato único y limitar la configuración por fila a colecciones de juegos."
);

assert(
  homeConfig.includes("cardPresentation?: GameCardPresentationMode") &&
    homeEditor.includes("GAME_CARD_PRESENTATION_MODES.map") &&
    homeEditor.includes("Info + imagen") &&
    homeEditor.includes("Info + video") &&
    homePage.includes("section.cardPresentation") &&
    homePage.includes("DEFAULT_HOME_GAME_CARD_PRESENTATION"),
  "Home debe editar y consumir la presentación por fila dentro de su snapshot editorial publicado."
);

assert(
  types.includes("coverImage?: string") &&
    types.includes("cardImage?: string") &&
    types.includes("cover?: GameImageViewport") &&
    types.includes("card?: GameImageViewport"),
  "Las claves históricas deben permanecer parseables durante la migración para no romper revisiones ni restauraciones."
);

if (failures.length) {
  console.error("Destinos multimedia unificados: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Destinos multimedia unificados: OK (Card poster 4:5 + detalle 3:2 · Hero 3:1 · Home por fila · compatibilidad histórica)."
);
