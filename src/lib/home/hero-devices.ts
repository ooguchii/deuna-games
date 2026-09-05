import type { HomeHeroDevice } from "@/data/home-config";

export type HomeHeroViewport = {
  width: number;
  height: number;
};

export const HOME_HERO_BREAKPOINTS = {
  mobileMax: 680,
  tabletMax: 1100,
} as const;

export const HOME_HERO_VIEWPORT_DEFAULTS: Record<
  HomeHeroDevice,
  HomeHeroViewport
> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 900, height: 1024 },
  mobile: { width: 390, height: 844 },
};

export const HOME_HERO_VIEWPORT_WIDTH_LIMITS: Record<
  HomeHeroDevice,
  readonly [number, number]
> = {
  desktop: [HOME_HERO_BREAKPOINTS.tabletMax + 1, 3840],
  tablet: [HOME_HERO_BREAKPOINTS.mobileMax + 1, HOME_HERO_BREAKPOINTS.tabletMax],
  mobile: [320, HOME_HERO_BREAKPOINTS.mobileMax],
};

export const HOME_HERO_VIEWPORT_HEIGHT_LIMITS = [
  320,
  2160,
] as const;

export function homeHeroDeviceForWidth(
  width: number
): HomeHeroDevice {
  if (width <= HOME_HERO_BREAKPOINTS.mobileMax) {
    return "mobile";
  }
  if (width <= HOME_HERO_BREAKPOINTS.tabletMax) {
    return "tablet";
  }
  return "desktop";
}

export function clampHomeHeroViewport(
  device: HomeHeroDevice,
  viewport: HomeHeroViewport
): HomeHeroViewport {
  const [minWidth, maxWidth] =
    HOME_HERO_VIEWPORT_WIDTH_LIMITS[device];
  const [minHeight, maxHeight] =
    HOME_HERO_VIEWPORT_HEIGHT_LIMITS;

  return {
    width: Math.min(
      maxWidth,
      Math.max(minWidth, Math.round(viewport.width))
    ),
    height: Math.min(
      maxHeight,
      Math.max(minHeight, Math.round(viewport.height))
    ),
  };
}
