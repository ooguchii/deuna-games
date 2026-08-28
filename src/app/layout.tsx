import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import {
  siteConfig,
  siteUrl,
} from "@/lib/site";

import "./globals.css";
import "@/theme/deuna-theme.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "DeUna Games | Encuentra juegos para tu PC",
    template: "%s | DeUna Games",
  },

  description: siteConfig.description,

  applicationName: siteConfig.name,

  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: "DeUna Games | Encuentra juegos para tu PC",
    description: siteConfig.description,
  },

  twitter: {
    card: "summary_large_image",
    title: "DeUna Games | Encuentra juegos para tu PC",
    description: siteConfig.description,
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: siteConfig.themeColor,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.language}>
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
