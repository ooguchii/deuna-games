import "server-only";

import { Buffer } from "node:buffer";

import { ImageResponse } from "next/og";
import { createElement } from "react";

import {
  buildSiteBrandLogoDataUri,
} from "@/lib/media/site-brand-logo";
import {
  resolveSiteLogoColor,
  resolveSiteLogoColorMode,
  type SiteLogoConfig,
} from "@/lib/site/logo";

export const socialImageAlt =
  "Imagen social del sitio de juegos para PC";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export const socialImageContentType = "image/png";

type SocialImageIdentity = SiteLogoConfig & {
  name: string;
  description: string;
  themeColor: string;
  headline: string;
};

function defaultLogoDataUri(color: string) {
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

export async function createSocialImage(
  identity: SocialImageIdentity
) {
  const logoColor = resolveSiteLogoColor(identity);
  const effectiveLogoColorMode = resolveSiteLogoColorMode(
    identity.logoAsset,
    identity.logoColorMode
  );
  let logoDataUri = defaultLogoDataUri(logoColor);

  if (identity.logoAsset) {
    try {
      logoDataUri =
        (await buildSiteBrandLogoDataUri(
          identity.logoAsset,
          effectiveLogoColorMode === "original"
            ? null
            : logoColor
        )) ?? logoDataUri;
    } catch {
      // El fallback local ya está listo y no depende del asset editorial.
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          color: "#f7f8fb",
          background:
            `linear-gradient(135deg, ${identity.themeColor} 0%, #0b0f19 52%, #160812 100%)`,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            right: -100,
            top: -180,
            borderRadius: 9999,
            background: `${identity.brandColor}2e`,
            filter: "blur(80px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            left: -120,
            bottom: -220,
            borderRadius: 9999,
            background: "rgba(123, 97, 255, 0.12)",
            filter: "blur(90px)",
          }}
        />

        <div
          style={{
            width: "100%",
            padding: "78px 88px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            <div
              style={{
                width: 36 * (identity.logoScale ?? 100) / 100,
                height: 36 * (identity.logoScale ?? 100) / 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: logoColor,
              }}
            >
              {createElement("img", {
                src: logoDataUri,
                alt: "",
                width: 36 * (identity.logoScale ?? 100) / 100,
                height: 36 * (identity.logoScale ?? 100) / 100,
                style: {
                  width: 36 * (identity.logoScale ?? 100) / 100,
                  height: 36 * (identity.logoScale ?? 100) / 100,
                  objectFit: "contain",
                },
              })}
            </div>

            <div style={{ display: "flex" }}>
              {identity.name}
            </div>
          </div>

          <div
            style={{
              maxWidth: 930,
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontSize: 76,
                lineHeight: 1.02,
                letterSpacing: "-0.045em",
                fontWeight: 900,
              }}
            >
              <span>{identity.headline}</span>
            </div>

            <div
              style={{
                display: "flex",
                maxWidth: 850,
                color: "#b8c1cf",
                fontSize: 27,
                lineHeight: 1.42,
              }}
            >
              {identity.description}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              color: "#7d8898",
              fontSize: 20,
            }}
          >
            <span>Juegos para PC</span>
            <span>•</span>
            <span>Compatibilidad</span>
            <span>•</span>
            <span>Actualizaciones</span>
          </div>
        </div>
      </div>
    ),
    socialImageSize
  );
}
