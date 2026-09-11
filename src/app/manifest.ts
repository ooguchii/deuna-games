import type { MetadataRoute } from "next";

import {
  siteAppIconVersion,
} from "@/lib/site/app-icon";
import {
  safeThemeBackground,
} from "@/lib/site/brand-foreground";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getPublicSiteConfig();
  const iconVersion = siteAppIconVersion(config);
  const themeColor = safeThemeBackground(config.themeColor);

  return {
    name: config.name,
    short_name: config.shortName,
    description: config.description,
    start_url: "/",
    display: "standalone",
    background_color: themeColor,
    theme_color: themeColor,
    lang: config.language,
    icons: [
      {
        src: `/app-icon/192?v=${iconVersion}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/app-icon/512?v=${iconVersion}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
