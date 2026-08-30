import type { Metadata } from "next";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

import FeaturedCategories from "@/components/home/FeaturedCategories";
import FeaturedGenres from "@/components/home/FeaturedGenres";
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
  getPublicHomeConfig,
} from "@/lib/home/public-home-config";
import {
  absoluteUrl,
} from "@/lib/site";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import { safeJsonLd } from "@/lib/safe-json-ld";
import {
  getPublicResolvedUpdates,
} from "@/lib/updates/public-updates";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();

  return {
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      url: "/",
      siteName: config.name,
      title: `${config.name} | Encuentra juegos para tu PC`,
      description: config.description,
    },
  };
}

export default async function Home() {
  const [games, updates, config, homeConfig] = await Promise.all([
    getPublicGames(),
    getPublicResolvedUpdates(),
    getPublicSiteConfig(),
    getPublicHomeConfig(),
  ]);
  const collections =
    buildHomeGameCollections(games, homeConfig);
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.name,
    url: absoluteUrl("/"),
    description: config.description,
    inLanguage: config.language,
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.name,
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
        {collections.heroGames.length > 0 && (
          <HeroSection games={collections.heroGames} />
        )}
        {collections.popularGames.length > 0 && (
          <PopularGames games={collections.popularGames} />
        )}
        <GameFinderSection />
        {games.length > 0 && (
          <FeaturedCategories games={games} />
        )}
        {games.length > 0 && (
          <FeaturedGenres games={games} />
        )}
        {collections.recentGames.length > 0 && (
          <RecentlyAdded games={collections.recentGames} />
        )}
        {updates.length > 0 && (
          <LatestUpdates updates={updates.slice(0, 3)} />
        )}
        {collections.lowSpecGames.length > 0 && (
          <GamesForYourPC games={collections.lowSpecGames} />
        )}
        {collections.recommendedGames.length > 0 && (
          <RecommendedGames
            games={collections.recommendedGames}
          />
        )}
        <TrustSection />
      </main>

      <Footer />
    </>
  );
}
