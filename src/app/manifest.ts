import type { MetadataRoute } from "next";

import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getPublicSiteConfig();

  return {
    name: config.name,
    short_name: config.shortName,
    description: config.description,
    start_url: "/",
    display: "standalone",
    background_color: config.themeColor,
    theme_color: config.themeColor,
    lang: config.language,
  };
}
