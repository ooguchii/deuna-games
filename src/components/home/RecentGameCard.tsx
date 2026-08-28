import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { Game } from "@/types/game";

type RecentGameCardProps = {
  game: Game;
};

export default function RecentGameCard({
  game,
}: RecentGameCardProps) {
  return (
    <UniversalGameCard
      game={game}
      variant="recent"
    />
  );
}
