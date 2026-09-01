export const siteBackgroundPages = [
  "home",
  "games",
  "updates",
  "finder",
  "about",
] as const;

export type SiteBackgroundPage =
  (typeof siteBackgroundPages)[number];

export type SiteBackgroundAsset = {
  id: string;
  name: string;
  image: string;
};

export type SiteBackgroundSetting = {
  assetId: string | null;
  colorMode: "brand" | "custom";
  customColor: string;
  tintOpacity: number;
};

export type SiteBackgroundMap = Partial<
  Record<SiteBackgroundPage, SiteBackgroundSetting>
>;

export const siteBackgroundPageOptions: ReadonlyArray<{
  key: SiteBackgroundPage;
  label: string;
}> = [
  { key: "home", label: "Inicio" },
  { key: "games", label: "Juegos" },
  { key: "updates", label: "Actualizaciones" },
  { key: "finder", label: "Requisitos" },
  { key: "about", label: "Quiénes somos" },
];

export const bundledSiteBackgrounds: ReadonlyArray<SiteBackgroundAsset> = [
  {
    id: "aurora-nocturna",
    name: "Aurora Nocturna",
    image: "/images/backgrounds/aurora-nocturna.webp",
  },
  {
    id: "nebulosa-profunda",
    name: "Nebulosa Profunda",
    image: "/images/backgrounds/nebulosa-profunda.webp",
  },
  {
    id: "ondas-sinteticas",
    name: "Ondas Sintéticas",
    image: "/images/backgrounds/ondas-sinteticas.webp",
  },
  {
    id: "bosque-sombrio",
    name: "Bosque Sombrío",
    image: "/images/backgrounds/bosque-sombrio.webp",
  },
  {
    id: "hexagonos-tech",
    name: "Hexágonos Tech",
    image: "/images/backgrounds/hexagonos-tech.webp",
  },
  {
    id: "espacio-minimal",
    name: "Espacio Minimal",
    image: "/images/backgrounds/espacio-minimal.jpg",
  },
];

export function createDefaultBackgroundSetting(
  brandColor: string
): SiteBackgroundSetting {
  return {
    assetId: null,
    colorMode: "brand",
    customColor: brandColor,
    tintOpacity: 35,
  };
}

export function getSiteBackgroundAssets(
  customAssets: ReadonlyArray<SiteBackgroundAsset> = []
) {
  const byId = new Map<string, SiteBackgroundAsset>();

  for (const asset of bundledSiteBackgrounds) {
    byId.set(asset.id, asset);
  }

  for (const asset of customAssets) {
    byId.set(asset.id, asset);
  }

  return Array.from(byId.values());
}

export function resolveBackgroundPage(
  pathname: string
): SiteBackgroundPage | null {
  if (pathname === "/") return "home";
  if (pathname === "/juegos" || pathname.startsWith("/juegos/")) {
    return "games";
  }
  if (
    pathname === "/actualizaciones" ||
    pathname.startsWith("/actualizaciones/")
  ) {
    return "updates";
  }
  if (pathname === "/requisitos" || pathname.startsWith("/requisitos/")) {
    return "finder";
  }
  if (
    pathname === "/quienes-somos" ||
    pathname.startsWith("/quienes-somos/")
  ) {
    return "about";
  }

  return null;
}
