import type {
  HomeHeroPosition,
  HomeHeroPositionStyle,
  HomeHeroPresentation,
  HomeHeroResponsiveStyle,
} from "@/data/home-config";

export const HOME_HERO_VISUAL_POSITIONS = [
  "left2",
  "left1",
  "main",
  "right1",
  "right2",
] as const satisfies readonly Exclude<HomeHeroPosition, "all">[];

export type HomeHeroVisualPosition =
  (typeof HOME_HERO_VISUAL_POSITIONS)[number];

const positionOffsets: Record<HomeHeroVisualPosition, number> = {
  left2: -2,
  left1: -1,
  main: 0,
  right1: 1,
  right2: 2,
};

export function homeHeroPositionOffset(
  position: HomeHeroVisualPosition
) {
  return positionOffsets[position];
}

export function homeHeroVisiblePositions(
  responsive: HomeHeroResponsiveStyle,
  direction: HomeHeroPresentation["direction"],
  totalGames = Number.POSITIVE_INFINITY
): readonly HomeHeroVisualPosition[] {
  const visibleCount = Math.min(responsive.visibleCards, Math.max(1, totalGames));

  if (visibleCount <= 1) return ["main"];
  if (visibleCount === 2) {
    return direction === "reverse"
      ? ["left1", "main"]
      : ["main", "right1"];
  }
  if (visibleCount === 3) return ["left1", "main", "right1"];
  if (visibleCount === 4) {
    return direction === "reverse"
      ? ["left2", "left1", "main", "right1"]
      : ["left1", "main", "right1", "right2"];
  }

  return HOME_HERO_VISUAL_POSITIONS;
}

export function homeHeroPositionDisplay(
  position: HomeHeroVisualPosition,
  responsive: HomeHeroResponsiveStyle,
  direction: HomeHeroPresentation["direction"],
  totalGames = Number.POSITIVE_INFINITY
) {
  return homeHeroVisiblePositions(
    responsive,
    direction,
    totalGames
  ).includes(position)
    ? "block"
    : "none";
}

export function homeHeroPositionTransform(
  style: HomeHeroPositionStyle
) {
  return `translate3d(calc(-50% + var(--hero-slot-x) + ${style.translateX}px), calc(-50% + ${style.translateY}px), ${style.translateZ}px) rotateX(${style.rotateX}deg) rotateY(${style.rotateY}deg) rotateZ(${style.rotateZ}deg) scale(${style.scale})`;
}
