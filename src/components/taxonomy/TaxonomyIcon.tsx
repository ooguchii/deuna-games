import {
  Bike,
  Box,
  Brain,
  Car,
  Castle,
  Compass,
  Crosshair,
  Crown,
  Dices,
  Gamepad2,
  Ghost,
  Hammer,
  Plane,
  Puzzle,
  Rocket,
  Shield,
  Ship,
  Skull,
  Sparkles,
  Sword,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { CSSProperties } from "react";

import type {
  GameTaxonomyIcon,
} from "@/types/game-taxonomy";

const iconMap = {
  gamepad: Gamepad2,
  zap: Zap,
  compass: Compass,
  sword: Sword,
  car: Car,
  puzzle: Puzzle,
  box: Box,
  sparkles: Sparkles,
  shield: Shield,
  target: Target,
  crosshair: Crosshair,
  ghost: Ghost,
  skull: Skull,
  crown: Crown,
  rocket: Rocket,
  plane: Plane,
  ship: Ship,
  bike: Bike,
  trophy: Trophy,
  castle: Castle,
  dices: Dices,
  users: Users,
  hammer: Hammer,
  brain: Brain,
} satisfies Record<GameTaxonomyIcon, typeof Gamepad2>;

export default function TaxonomyIcon({
  icon,
  asset,
  size = 28,
  strokeWidth = 1.9,
}: {
  icon: GameTaxonomyIcon;
  asset?: string;
  size?: number;
  strokeWidth?: number;
}) {
  if (asset) {
    const mask = `url("${asset}")`;
    const customStyle = {
      width: size,
      height: size,
      display: "inline-block",
      flex: "0 0 auto",
      backgroundColor:
        "var(--taxonomy-accent, currentColor)",
      WebkitMaskImage: mask,
      maskImage: mask,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
    } as CSSProperties;

    return (
      <span
        style={customStyle}
        aria-hidden="true"
      />
    );
  }

  const Icon = iconMap[icon] ?? Gamepad2;

  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      style={{
        color:
          "var(--taxonomy-accent, currentColor)",
      }}
      aria-hidden="true"
    />
  );
}
