export const SITE_BRAND_LOGO_SLUG = "site-brand-logo";

export const siteBrandLogoAssetPattern =
  /^\/media\/editorial\/site-brand-logo\/[a-f0-9]{64}\.svg$/;

export const siteLogoColorModes = [
  "original",
  "brand",
  "custom",
] as const;

export type SiteLogoColorMode =
  (typeof siteLogoColorModes)[number];

export type SiteLogoConfig = {
  logoAsset?: string;
  logoScale?: number;
  logoColorMode?: SiteLogoColorMode;
  logoCustomColor?: string;
  brandColor: string;
};

export function isSiteBrandLogoAsset(
  value: string
) {
  return siteBrandLogoAssetPattern.test(value);
}

export function resolveSiteLogoColor(
  config: SiteLogoConfig
) {
  return config.logoColorMode === "custom" &&
    /^#[0-9a-f]{6}$/i.test(config.logoCustomColor ?? "")
    ? config.logoCustomColor!
    : config.brandColor;
}
