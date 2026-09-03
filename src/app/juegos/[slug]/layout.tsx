import type { ReactNode } from "react";

import GameDetailBackground from "@/components/games/GameDetailBackground";
import { getPublicGameBySlug } from "@/lib/games/public-catalog";

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function GameDetailLayout({ children, params }: Props) {
  const { slug } = await params;
  const game = await getPublicGameBySlug(slug);

  return (
    <GameDetailBackground game={game}>
      {children}
    </GameDetailBackground>
  );
}
