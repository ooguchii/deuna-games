import type { MetadataRoute } from "next";

import {
  getPublicGames,
} from "@/lib/games/public-catalog";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const games = await getPublicGames();
  const gameEntries: MetadataRoute.Sitemap = games.map(
    (game) => ({
      url: absoluteUrl(`/juegos/${game.slug}`),
      changeFrequency: "weekly",
      priority: 0.75,
    })
  );

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/juegos"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/requisitos"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/actualizaciones"),
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/quienes-somos"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...gameEntries,
  ];
}
