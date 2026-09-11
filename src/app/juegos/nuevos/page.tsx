import { redirect } from "next/navigation";

import {
  getCatalogCapabilities,
} from "@/lib/games/catalog-capabilities";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";

export default async function NewGamesPage() {
  const games = await getPublicGames();
  const capabilities = getCatalogCapabilities(games);

  redirect(
    capabilities.releaseDates
      ? "/juegos?estado=recent&orden=recientes"
      : "/juegos"
  );
}
