import "server-only";

import { Gamepad2 } from "lucide-react";
import { ImageResponse } from "next/og";

import {
  buildSiteBrandLogoDataUri,
} from "@/lib/media/site-brand-logo";
import {
  resolveSiteLogoColor,
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

export async function createSocialImage(
  identity: SocialImageIdentity
) {
  const logoColor = resolveSiteLogoColor(identity);
  let logoDataUri: string | null = null;

  if (identity.logoAsset) {
    try {
      logoDataUri = await buildSiteBrandLogoDataUri(
        identity.logoAsset,
        logoColor
      );
    } catch {
      logoDataUri = null;
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
                width: 66,
                height: 66,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 18,
                border: `1px solid ${identity.brandColor}`,
                background: `${identity.brandColor}14`,
                color: logoColor,
              }}
            >
              {logoDataUri ? (
                <img
                  src={logoDataUri}
                  alt=""
                  width={36}
                  height={36}
                  style={{
                    width: 36,
                    height: 36,
                    objectFit: "contain",
                  }}
                />
              ) : (
                <Gamepad2
                  size={36}
                  strokeWidth={2.1}
                  color={logoColor}
                  aria-hidden="true"
                />
              )}
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
