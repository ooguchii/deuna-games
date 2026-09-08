import "server-only";

import { ImageResponse } from "next/og";
import { createElement } from "react";

import {
  safeThemeBackground,
} from "@/lib/site/brand-foreground";
import {
  resolveSiteLogoColorMode,
  type SiteLogoConfig,
} from "@/lib/site/logo";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  resolveSiteLogoImage,
} from "@/lib/site-logo-image";

export const siteAppIconSizes = [
  64,
  180,
  192,
  512,
] as const;

export type SiteAppIconSize =
  (typeof siteAppIconSizes)[number];

export function isSiteAppIconSize(
  value: number
): value is SiteAppIconSize {
  return siteAppIconSizes.includes(value as SiteAppIconSize);
}

export function siteAppIconVersion(
  identity: SiteLogoConfig
) {
  const assetDigest = identity.logoAsset?.match(
    /\/([a-f0-9]{64})\.(?:svg|png|jpg|webp|gif)$/
  )?.[1]?.slice(0, 16) ?? "default";
  const colorMode = resolveSiteLogoColorMode(
    identity.logoAsset,
    identity.logoColorMode
  );
  const color = (
    colorMode === "custom"
      ? identity.logoCustomColor
      : identity.brandColor
  )?.replace(/^#/, "").toLowerCase() ?? "none";
  const scale = Math.round(identity.logoScale ?? 100);

  return `${assetDigest}-${colorMode}-${color}-${scale}`;
}

export async function createSiteAppIcon(
  size: SiteAppIconSize
) {
  const config = await getPublicSiteConfig();
  const background = safeThemeBackground(config.themeColor);
  const { dataUri } = await resolveSiteLogoImage(config);
  const scale = Math.min(
    2,
    Math.max(0.5, (config.logoScale ?? 100) / 100)
  );
  const markSize = Math.round(
    Math.min(size * 0.78, size * 0.52 * scale)
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background,
        }}
      >
        {createElement("img", {
          src: dataUri,
          alt: "",
          width: markSize,
          height: markSize,
          style: {
            width: markSize,
            height: markSize,
            objectFit: "contain",
          },
        })}
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
