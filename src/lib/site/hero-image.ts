export type HeroImageTuning = {
  brightness: number;
  saturation: number;
  contrast: number;
  ambientBlur: number;
  ambientOpacity: number;
  overlayStrength: number;
};

export const defaultHeroImageTuning: HeroImageTuning = {
  brightness: 100,
  saturation: 100,
  contrast: 100,
  ambientBlur: 54,
  ambientOpacity: 42,
  overlayStrength: 100,
};

function clamp(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function resolveHeroImageTuning(
  tuning?: Partial<HeroImageTuning>
): HeroImageTuning {
  return {
    brightness: clamp(
      tuning?.brightness,
      50,
      220,
      defaultHeroImageTuning.brightness
    ),
    saturation: clamp(
      tuning?.saturation,
      0,
      200,
      defaultHeroImageTuning.saturation
    ),
    contrast: clamp(
      tuning?.contrast,
      70,
      160,
      defaultHeroImageTuning.contrast
    ),
    ambientBlur: clamp(
      tuning?.ambientBlur,
      0,
      90,
      defaultHeroImageTuning.ambientBlur
    ),
    ambientOpacity: clamp(
      tuning?.ambientOpacity,
      0,
      100,
      defaultHeroImageTuning.ambientOpacity
    ),
    overlayStrength: clamp(
      tuning?.overlayStrength,
      0,
      100,
      defaultHeroImageTuning.overlayStrength
    ),
  };
}
