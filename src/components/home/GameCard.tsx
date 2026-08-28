import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { Game } from "@/types/game";

type GameCardProps = {
  game: Game;
};

export default function GameCard({
  game,
}: GameCardProps) {
  return (
    <UniversalGameCard
      game={game}
      variant="standard"
    />
  );
}
