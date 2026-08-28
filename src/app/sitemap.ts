import type { MetadataRoute } from "next";

import { games } from "@/data/games";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
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
