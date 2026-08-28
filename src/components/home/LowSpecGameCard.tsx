import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { Game } from "@/types/game";

type LowSpecGameCardProps = {
  game: Game;
};

export default function LowSpecGameCard({
  game,
}: LowSpecGameCardProps) {
  return (
    <UniversalGameCard
      game={game}
      variant="lowSpec"
    />
  );
}
