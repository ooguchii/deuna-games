import "server-only";

import { Buffer } from "node:buffer";

import {
  buildSiteBrandLogoDataUri,
} from "@/lib/media/site-brand-logo";
import {
  resolveSiteLogoColor,
  resolveSiteLogoColorMode,
  type SiteLogoConfig,
} from "@/lib/site/logo";

function defaultSiteLogoDataUri(color: string) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color)
    ? color
    : "#ff0847";
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"',
    ` stroke="${safeColor}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">`,
    '<line x1="6" x2="10" y1="11" y2="11"/>',
    '<line x1="8" x2="8" y1="9" y2="13"/>',
    '<line x1="15" x2="15.01" y1="12" y2="12"/>',
    '<line x1="18" x2="18.01" y1="10" y2="10"/>',
    '<path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
    "</svg>",
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export async function resolveSiteLogoImage(
  identity: SiteLogoConfig
) {
  const color = resolveSiteLogoColor(identity);
  const colorMode = resolveSiteLogoColorMode(
    identity.logoAsset,
    identity.logoColorMode
  );
  let dataUri = defaultSiteLogoDataUri(color);

  if (identity.logoAsset) {
    try {
      dataUri =
        (await buildSiteBrandLogoDataUri(
          identity.logoAsset,
          colorMode === "original" ? null : color
        )) ?? dataUri;
    } catch {
      // El fallback local no depende del asset editorial y mantiene la marca usable.
    }
  }

  return {
    color,
    colorMode,
    dataUri,
  };
}
