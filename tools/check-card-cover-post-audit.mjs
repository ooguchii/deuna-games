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
  presentation,
  accessibility,
  accessibilityEditor,
  readiness,
  backgroundRoute,
  backgroundEditor,
  detailEditor,
  galleryDomain,
  galleryEditor,
  legacyMediaRoute,
  contentService,
  mediaLibraryRoute,
  galleryRoute,
  finder,
  accountPage,
  notifications,
  publicPage,
] = await Promise.all([
  source("src/lib/media/game-card-presentation.ts"),
  source("src/lib/media/game-media-accessibility.ts"),
  source("src/components/admin/GameMediaAccessibilityEditor.tsx"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/app/api/admin/content/games/[slug]/background-media/route.ts"),
  source("src/components/admin/GameBackgroundMediaEditor.tsx"),
  source("src/components/admin/GameDetailMediaEditor.tsx"),
  source("src/lib/media/game-gallery-media.ts"),
  source("src/components/admin/GameGalleryMediaManager.tsx"),
  source("src/app/api/admin/content/games/[slug]/media/route.ts"),
  source("src/lib/admin/content-service.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/gallery-media/route.ts"),
  source("src/features/game-finder/GameFinderClient.tsx"),
  source("src/app/cuenta/page.tsx"),
  source("src/lib/accounts/update-notifications.ts"),
  source("src/app/juegos/[slug]/page.tsx"),
]);

assert(
  has(
    presentation,
    "resolveGameCoverAlt",
    "resolveGameCardAlt",
    "alt: resolveGameCoverAlt(game)",
    "alt: resolveGameCardAlt(game)"
  ) &&
    !presentation.includes(
      "game.mediaAccessibility?.cover ??\n        game.mediaAccessibility?.card"
    ),
  "Card y Portada deben mantener textos alternativos contextuales independientes."
);

assert(
  has(
    accessibility,
    "resolveGameCoverImage",
    "resolveGameCardBaseImage",
    "const cardImage = resolveGameCardBaseImage(game)"
  ) &&
    !accessibility.includes('resolveGameDestinationMediaMode(game, "card")') &&
    has(
      accessibilityEditor,
      "const hasCard = Boolean(assignments.cardImage)",
      "imagen base 3:2 de la Card"
    ) &&
    readiness.includes("Portada, la imagen base de Card"),
  "La accesibilidad de la imagen base de Card debe seguir activa en modo Video."
);

assert(
  has(
    backgroundRoute,
    "source: match.src",
    "source: current.backgroundImage",
    "confirmed: true"
  ) &&
    has(backgroundEditor, "isImageCropConfirmed", "assignment.image ?? undefined") &&
    has(detailEditor, "isImageCropConfirmed", "assignment.image ?? undefined"),
  "Fondo y Contenedor deben ligar el recorte adaptable a su asset activo y mostrar el mismo readiness que dominio."
);

assert(
  has(
    galleryDomain,
    "viewport.source === undefined || viewport.source === item.src"
  ) &&
    has(
      galleryEditor,
      "isGameGalleryItemConfirmed",
      "{ imageMedia: imageMedia ?? undefined }"
    ),
  "Galería debe rechazar provenance obsoleta sin romper snapshots históricos sin source."
);

assert(
  has(
    legacyMediaRoute,
    "resolveGameCardBaseImage",
    "const coverArtworkSource =",
    'input.coverImage === cardImage ? "card" : "custom"',
    "coverArtworkSource,"
  ),
  "La ruta multimedia legacy debe traducir escrituras directas de Portada a intención shared/custom."
);

for (const field of [
  '"coverArtworkSource"',
  '"cardImage"',
  '"detailImage"',
  '"backgroundImage"',
  '"galleryMedia"',
  '"mediaModes"',
  '"directPreview"',
]) {
  assert(
    contentService.includes(field),
    `GameMediaDraftInput debe incluir ${field}.`
  );
}
assert(
  has(mediaLibraryRoute, "type GameMediaDraftInput", "type MediaDraftUpdate = GameMediaDraftInput") &&
    has(galleryRoute, "type GameMediaDraftInput", "satisfies GameMediaDraftInput"),
  "Las rutas multimedia deben consumir el contrato central de persistencia en vez de ampliarlo localmente."
);

assert(
  has(
    finder,
    "resolveGameCoverImage",
    "resolveGameCoverAlt",
    "function FinderDetailCover"
  ),
  "El detalle de Finder debe resolver la Portada efectiva y su alt contextual."
);

assert(
  has(accountPage, "resolveGameCoverImage", "coverImage: resolveGameCoverImage(game)") &&
    has(notifications, "resolveGameCardBaseImage", "gameCoverImage: resolveGameCardBaseImage(update.game)"),
  "Cuenta y avisos deben usar los resolvers canónicos de Portada/Card."
);

assert(
  has(
    publicPage,
    "resolveGameCoverImage",
    "resolveGameCoverAlt",
    "const resolvedCoverImage = resolveGameCoverImage(game)",
    "image: resolvedCoverImage"
  ),
  "Metadata social y JSON-LD deben consumir la Portada efectiva, no el campo de compatibilidad crudo."
);

if (failures.length) {
  console.error("Post-audit Card/Portada: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Post-audit Card/Portada: OK (accesibilidad, provenance, legacy, persistencia, SEO, Finder y Cuenta)."
);
