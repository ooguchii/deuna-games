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

export function homeHeroSlotX(
  position: HomeHeroVisualPosition,
  responsive: HomeHeroResponsiveStyle
) {
  if (position === "left2") {
    return -(responsive.cardWidth * .72 + responsive.gap * 2);
  }
  if (position === "left1") {
    return -(responsive.cardWidth * .42 + responsive.gap);
  }
  if (position === "right1") {
    return responsive.cardWidth * .42 + responsive.gap;
  }
  if (position === "right2") {
    return responsive.cardWidth * .72 + responsive.gap * 2;
  }
  return 0;
}

/** Resolve offsets from the rendered width, including responsive width limits. */
export function homeHeroSlotCSS(position: HomeHeroVisualPosition) {
  const offset = homeHeroPositionOffset(position);
  if (!offset) return "0px";
  const factor = Math.abs(offset) === 1 ? .42 : .72;
  return `calc((var(--hero-card-width) * ${factor} + var(--hero-gap) * ${Math.abs(offset)}) * ${Math.sign(offset)})`;
}

function defaultVisiblePositions(
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

/** The main card always remains visible; hiding a slot never removes a game. */
export function homeHeroVisiblePositions(
  responsive: HomeHeroResponsiveStyle,
  direction: HomeHeroPresentation["direction"],
  totalGames = Number.POSITIVE_INFINITY
): readonly HomeHeroVisualPosition[] {
  const count = Math.min(responsive.visibleCards, Math.max(1, totalGames));
  const positions: readonly HomeHeroVisualPosition[] = responsive.alignment === "left"
    ? ["main", "right1", "right2"]
    : responsive.alignment === "right"
      ? ["left2", "left1", "main"]
      : defaultVisiblePositions(responsive, direction, totalGames);
  const limited = responsive.alignment === "right" ? positions.slice(-count) : positions.slice(0, count);
  return limited.filter((id) => id === "main" || !responsive.hiddenPositions?.includes(id));
}

export function homeHeroAnchor(responsive: HomeHeroResponsiveStyle) {
  if (responsive.alignment === "left") return "calc(var(--hero-card-width) / 2 + 24px)";
  if (responsive.alignment === "right") return "calc(100% - var(--hero-card-width) / 2 - 24px)";
  return "50%";
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

export type HeroBounds = { left: number; top: number; right: number; bottom: number };

/** Fit the complete visible composition, including perspective, inside its stage. */
export function fitHomeHeroBounds(bounds: HeroBounds, width: number, height: number, alignment: HomeHeroResponsiveStyle["alignment"] = "center") {
  const padding = 24;
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - 96);
  const contentWidth = Math.max(1, bounds.right - bounds.left);
  const contentHeight = Math.max(1, bounds.bottom - bounds.top);
  const centeredWidth = Math.max(contentWidth, 2 * Math.max(width / 2 - bounds.left, bounds.right - width / 2));
  const fittedWidth = alignment === "center" ? centeredWidth : contentWidth;
  const scale = Math.min(1, availableWidth / fittedWidth, availableHeight / contentHeight);
  const originX = alignment === "left" ? padding : alignment === "right" ? width - padding : width / 2;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  // Preserve user translations whenever they already fit; only compensate for
  // scaling or overflow. Re-centering the bounds would cancel editor controls.
  return {
    scale,
    x: clamp((1 - scale) * originX, padding - bounds.left * scale, width - padding - bounds.right * scale),
    y: clamp((1 - scale) * height / 2, 48 - bounds.top * scale, height - 48 - bounds.bottom * scale),
  };
}
