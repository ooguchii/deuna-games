import {
  safeThemeBackground,
} from "@/lib/site/brand-foreground";
import {
  resolveSiteLogoColor,
  resolveSiteLogoColorMode,
  type SiteLogoConfig,
} from "@/lib/site/logo";

export const siteAppIconSizes = [
  32,
  64,
  180,
  192,
  512,
] as const;

export type SiteAppIconSize =
  (typeof siteAppIconSizes)[number];

type SiteAppIconIdentity = SiteLogoConfig & {
  themeColor?: string;
};

export function isSiteAppIconSize(
  value: number
): value is SiteAppIconSize {
  return siteAppIconSizes.includes(value as SiteAppIconSize);
}

export function siteAppIconVersion(
  identity: SiteAppIconIdentity
) {
  const assetDigest = identity.logoAsset?.match(
    /\/([a-f0-9]{64})\.(?:svg|png|jpg|webp|gif)$/
  )?.[1]?.slice(0, 16) ?? "default";
  const colorMode = resolveSiteLogoColorMode(
    identity.logoAsset,
    identity.logoColorMode
  );
  const color = colorMode === "original"
    ? "original"
    : resolveSiteLogoColor(identity)
      .replace(/^#/, "")
      .toLowerCase();
  const scale = Math.round(identity.logoScale ?? 100);
  const background = safeThemeBackground(
    identity.themeColor ?? "#05080d"
  ).replace(/^#/, "").toLowerCase();

  return `${assetDigest}-${colorMode}-${color}-${scale}-${background}`;
}
