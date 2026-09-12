import { readFile } from "node:fs/promises";

const files = {
  categories: "src/components/home/FeaturedCategories.tsx",
  categoriesCss: "src/components/home/FeaturedCategories.module.css",
  latest: "src/components/home/LatestUpdates.tsx",
  coverMedia: "src/components/ui/GameCoverMedia.tsx",
  featuredUpdates: "src/components/updates/FeaturedUpdatesSlider.tsx",
  updatesCatalog: "src/components/updates/UpdatesCatalogClient.tsx",
};

const entries = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [
      key,
      await readFile(path, "utf8"),
    ])
  )
);

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const has = (text, ...needles) =>
  needles.every((needle) => text.includes(needle));

expect(
  has(
    entries.categories,
    'import CardCarousel from "@/components/ui/CardCarousel"',
    "<CardCarousel",
    "itemsDesktop={6}"
  ) && !entries.categories.includes("styles.categories"),
  "Clasificaciones destacadas debe reutilizar CardCarousel en una sola pista horizontal."
);

expect(
  !entries.categoriesCss.includes(".categories"),
  "El CSS de Clasificaciones no debe conservar la grilla multilínea anterior al carrusel."
);

expect(
  has(
    entries.coverMedia,
    "resolveGameCoverImage",
    "viewport={game.imageMedia?.cover}",
    "fallbackClassName={fallbackClassName}",
    "alt={alt ?? game.mediaAccessibility?.cover ?? game.imageAlt}"
  ),
  "GameCoverMedia debe seguir siendo la fuente canónica del recurso y recorte de Portada."
);

expect(
  has(
    entries.latest,
    'import GameCoverMedia from "@/components/ui/GameCoverMedia"',
    "<GameCoverMedia",
    "game={update.game}"
  ) &&
    !entries.latest.includes("cardImage") &&
    !entries.latest.includes("?.card ??"),
  "Últimas actualizaciones de Inicio debe renderizar Portada, no el recurso/recorte de Card."
);

expect(
  has(
    entries.featuredUpdates,
    "resolveGameCoverImage",
    "const coverSrc =",
    "?.cover;"
  ) && !entries.featuredUpdates.includes("?.card ??"),
  "El fallback de Actualizaciones destacadas debe resolver la Portada canónica y su crop."
);

expect(
  has(
    entries.updatesCatalog,
    'import GameCoverMedia from "@/components/ui/GameCoverMedia"',
    "game={update.game}",
    'alt=""',
    'sizes="46px"'
  ) &&
    !entries.updatesCatalog.includes("?.card ??") &&
    !entries.updatesCatalog.includes('import GameMedia from "@/components/ui/GameMedia"'),
  "El catálogo público de Actualizaciones debe reutilizar Portada canónica en lista y recientes."
);

if (failures.length > 0) {
  console.error("Home/Actualizaciones · contrato visual: REGRESIÓN\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Home/Actualizaciones · contrato visual: OK (clasificaciones en carrusel y Portada 4:5 canónica en superficies de updates)."
);
