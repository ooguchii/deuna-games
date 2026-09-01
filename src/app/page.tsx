import type { Metadata } from "next";

import Footer from "@/components/layout/Footer";

import FeaturedCategories from "@/components/home/FeaturedCategories";
import GameFinderSection from "@/components/home/GameFinderSection";
import GamesForYourPC from "@/components/home/GamesForYourPC";
import HomeShowcase from "@/components/home/HomeShowcase";
import LatestUpdates from "@/components/home/LatestUpdates";
import RecentlyAdded from "@/components/home/RecentlyAdded";
import RecommendedGames from "@/components/home/RecommendedGames";
import TrustSection from "@/components/home/TrustSection";

import {
  absoluteUrl,
  siteConfig,
} from "@/lib/site";
import { safeJsonLd } from "@/lib/safe-json-ld";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: "DeUna Games | Encuentra juegos para tu PC",
    description: siteConfig.description,
  },
};

export default function Home() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: absoluteUrl("/"),
    description: siteConfig.description,
    inLanguage: siteConfig.language,
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: absoluteUrl("/"),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            safeJsonLd(websiteJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            safeJsonLd(organizationJsonLd),
        }}
      />

      <HomeShowcase />

      <main
        id="main-content"
        className="main-content"
      >
        <GameFinderSection />
        <FeaturedCategories />
        <RecentlyAdded />
        <LatestUpdates />
        <GamesForYourPC />
        <RecommendedGames />
        <TrustSection />
      </main>

      <Footer />
    </>
  );
}
