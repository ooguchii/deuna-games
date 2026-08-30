import type { Metadata } from "next";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

import FeaturedCategories from "@/components/home/FeaturedCategories";
import GameFinderSection from "@/components/home/GameFinderSection";
import GamesForYourPC from "@/components/home/GamesForYourPC";
import HeroSection from "@/components/home/HeroSection";
import LatestUpdates from "@/components/home/LatestUpdates";
import PopularGames from "@/components/home/PopularGames";
import RecentlyAdded from "@/components/home/RecentlyAdded";
import RecommendedGames from "@/components/home/RecommendedGames";
import TrustSection from "@/components/home/TrustSection";
import {
  buildHomeGameCollections,
} from "@/data/home";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";
import {
  absoluteUrl,
  siteConfig,
} from "@/lib/site";
import { safeJsonLd } from "@/lib/safe-json-ld";
import {
  getPublicResolvedUpdates,
} from "@/lib/updates/public-updates";

export const dynamic = "force-dynamic";

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

export default async function Home() {
  const [games, updates] = await Promise.all([
    getPublicGames(),
    getPublicResolvedUpdates(),
  ]);
  const collections =
    buildHomeGameCollections(games);
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

      <Header />

      <main
        id="main-content"
        className="main-content"
      >
        <HeroSection games={collections.heroGames} />
        <PopularGames games={collections.popularGames} />
        <GameFinderSection />
        <FeaturedCategories games={games} />
        <RecentlyAdded games={collections.recentGames} />
        <LatestUpdates updates={updates.slice(0, 3)} />
        <GamesForYourPC games={collections.lowSpecGames} />
        <RecommendedGames
          games={collections.recommendedGames}
        />
        <TrustSection />
      </main>

      <Footer />
    </>
  );
}
