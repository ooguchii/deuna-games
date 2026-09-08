import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";

import PublicPageBackground from "@/components/site/PublicPageBackground";
import {
  getPublicHomeConfig,
} from "@/lib/home/public-home-config";
import {
  readStoredSiteBrandLogo,
} from "@/lib/media/site-brand-logo";
import {
  siteUrl,
} from "@/lib/site";
import {
  brandForeground,
  safeThemeBackground,
} from "@/lib/site/brand-foreground";
import {
  resolveSiteLogoColor,
  resolveSiteLogoColorMode,
} from "@/lib/site/logo";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  siteAppIconVersion,
} from "@/lib/site-app-icon";

import "./globals.css";
import "@/theme/deuna-theme.css";
import "@/theme/public-theme-contract.css";
import "@/theme/public-route-theme-contract.css";
import "@/theme/public-touch-contract.css";
import "@/theme/mobile-interaction-contract.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [config, homeConfig] = await Promise.all([
    getPublicSiteConfig(),
    getPublicHomeConfig(),
  ]);
  const homeTitle =
    `${config.name} | ${homeConfig.copy.hero.accessibleTitle}`;
  const iconVersion = siteAppIconVersion(config);

  return {
    metadataBase: new URL(siteUrl),

    title: {
      default: homeTitle,
      template: `%s | ${config.name}`,
    },

    description: config.description,

    applicationName: config.name,

    icons: {
      icon: [
        {
          url: `/app-icon/32?v=${iconVersion}`,
          type: "image/png",
          sizes: "32x32",
        },
        {
          url: `/app-icon/64?v=${iconVersion}`,
          type: "image/png",
          sizes: "64x64",
        },
      ],
      apple: [
        {
          url: `/app-icon/180?v=${iconVersion}`,
          type: "image/png",
          sizes: "180x180",
        },
      ],
    },

    openGraph: {
      type: "website",
      siteName: config.name,
      title: homeTitle,
      description: config.description,
    },

    twitter: {
      card: "summary_large_image",
      title: homeTitle,
      description: config.description,
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },

    category: "games",
  };
}

export async function generateViewport(): Promise<Viewport> {
  const config = await getPublicSiteConfig();

  return {
    width: "device-width",
    initialScale: 1,
    themeColor: safeThemeBackground(config.themeColor),
    colorScheme: "dark",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getPublicSiteConfig();
  const readableBrandText = brandForeground(config.brandColor);
  const readableThemeBackground = safeThemeBackground(config.themeColor);
  const logoColor = resolveSiteLogoColor(config);
  let logoAsset: string | null = null;

  if (config.logoAsset) {
    try {
      logoAsset = (await readStoredSiteBrandLogo(config.logoAsset))
        ? config.logoAsset
        : null;
    } catch {
      logoAsset = null;
    }
  }

  const logoColorMode = resolveSiteLogoColorMode(
    logoAsset,
    config.logoColorMode
  );

  return (
    <html
      lang={config.language}
      data-scroll-behavior="smooth"
      data-site-logo={logoAsset ? "custom" : "default"}
      data-site-logo-color-mode={logoColorMode}
      style={{
        "--theme-bg": readableThemeBackground,
        "--theme-brand": config.brandColor,
        "--theme-on-brand": readableBrandText,
        "--text-on-brand": readableBrandText,
        "--site-logo-color": logoColor,
        "--site-logo-scale": (config.logoScale ?? 100) / 100,
        "--site-logo-image": logoAsset
          ? `url("${logoAsset}")`
          : "none",
      } as CSSProperties}
    >
      <body>
        <a
          href="#main-content"
          className="skip-link"
        >
          Saltar al contenido principal
        </a>

        <PublicPageBackground
          brandColor={config.brandColor}
          customAssets={config.backgroundLibrary ?? []}
          pageBackgrounds={config.pageBackgrounds ?? {}}
        >
          {children}
        </PublicPageBackground>
      </body>
    </html>
  );
}
