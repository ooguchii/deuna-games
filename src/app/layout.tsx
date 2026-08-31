import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import {
  getPublicHomeConfig,
} from "@/lib/home/public-home-config";
import {
  siteUrl,
} from "@/lib/site";
import {
  brandForeground,
  safeThemeBackground,
} from "@/lib/site/brand-foreground";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";

import "./globals.css";
import "@/theme/deuna-theme.css";
import "@/theme/public-theme-contract.css";
import "@/theme/public-route-theme-contract.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [config, homeConfig] = await Promise.all([
    getPublicSiteConfig(),
    getPublicHomeConfig(),
  ]);
  const homeTitle =
    `${config.name} | ${homeConfig.copy.hero.accessibleTitle}`;

  return {
    metadataBase: new URL(siteUrl),

    title: {
      default: homeTitle,
      template: `%s | ${config.name}`,
    },

    description: config.description,

    applicationName: config.name,

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

  return (
    <html
      lang={config.language}
      style={{
        "--theme-bg": readableThemeBackground,
        "--theme-brand": config.brandColor,
        "--theme-on-brand": readableBrandText,
        "--text-on-brand": readableBrandText,
      } as CSSProperties}
    >
      <body className={inter.className}>
        <a
          href="#main-content"
          className="skip-link"
        >
          Saltar al contenido principal
        </a>

        {children}
      </body>
    </html>
  );
}
