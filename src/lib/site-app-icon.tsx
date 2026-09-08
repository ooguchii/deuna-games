import "server-only";

import { ImageResponse } from "next/og";
import { createElement } from "react";

import {
  safeThemeBackground,
} from "@/lib/site/brand-foreground";
import {
  type SiteAppIconSize,
} from "@/lib/site/app-icon";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  resolveSiteLogoImage,
} from "@/lib/site-logo-image";

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
