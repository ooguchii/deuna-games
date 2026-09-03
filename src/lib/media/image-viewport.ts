import type {
  GameImageViewport,
  GameImageViewportAspect,
} from "@/types/game";

export const MIN_GAME_IMAGE_ZOOM = 1;
export const MAX_GAME_IMAGE_ZOOM = 3;
export const DEFAULT_GALLERY_IMAGE_ASPECT = "16:9" as const;
export const MIN_FREE_IMAGE_ASPECT_RATIO = 0.1;
export const MAX_FREE_IMAGE_ASPECT_RATIO = 10;

export const GAME_IMAGE_CROP_ASPECTS: readonly GameImageViewportAspect[] = [
  "16:9",
  "3:2",
  "1:1",
  "4:5",
  "9:16",
  "free",
];

const FIXED_IMAGE_ASPECT_RATIOS: Record<Exclude<GameImageViewportAspect, "free">, number> = {
  "16:9": 16 / 9,
  "3:2": 3 / 2,
  "1:1": 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
};

export const DEFAULT_GAME_IMAGE_VIEWPORT: GameImageViewport = {
  x: 0.5,
  y: 0.5,
  zoom: 1,
};

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function parseGameImageViewportAspect(
  value: unknown
): GameImageViewportAspect | null {
  if (typeof value !== "string") return null;
  return GAME_IMAGE_CROP_ASPECTS.includes(value as GameImageViewportAspect)
    ? value as GameImageViewportAspect
    : null;
}

export function parseGameImageViewport(
  xValue: unknown,
  yValue: unknown,
  zoomValue: unknown,
  aspectValue?: unknown,
  aspectRatioValue?: unknown
): GameImageViewport | null {
  const x = finiteNumber(xValue);
  const y = finiteNumber(yValue);
  const zoom = finiteNumber(zoomValue);

  if (
    x === null ||
    y === null ||
    zoom === null ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1 ||
    zoom < MIN_GAME_IMAGE_ZOOM ||
    zoom > MAX_GAME_IMAGE_ZOOM
  ) {
    return null;
  }

  const viewport: GameImageViewport = {
    x: round(x),
    y: round(y),
    zoom: round(zoom),
  };

  if (aspectValue === undefined || aspectValue === null || aspectValue === "") {
    return viewport;
  }

  const aspect = parseGameImageViewportAspect(aspectValue);
  if (!aspect) return null;

  if (aspect === "free") {
    const aspectRatio = finiteNumber(aspectRatioValue);
    if (
      aspectRatio === null ||
      aspectRatio < MIN_FREE_IMAGE_ASPECT_RATIO ||
      aspectRatio > MAX_FREE_IMAGE_ASPECT_RATIO
    ) {
      return null;
    }
    return {
      ...viewport,
      aspect,
      aspectRatio: round(aspectRatio),
    };
  }

  if (
    aspectRatioValue !== undefined &&
    aspectRatioValue !== null &&
    String(aspectRatioValue).trim() !== ""
  ) {
    return null;
  }

  return {
    ...viewport,
    aspect,
  };
}

export function normalizeGameImageViewport(
  viewport: GameImageViewport | null | undefined
): GameImageViewport {
  const parsed = parseGameImageViewport(
    viewport?.x,
    viewport?.y,
    viewport?.zoom,
    viewport?.aspect,
    viewport?.aspectRatio
  );
  if (parsed) {
    return viewport?.confirmed === true
      ? { ...parsed, confirmed: true }
      : parsed;
  }
  return { ...DEFAULT_GAME_IMAGE_VIEWPORT };
}

export function resolveGameImageCropAspect(
  viewport: GameImageViewport | null | undefined,
  fallback: Exclude<GameImageViewportAspect, "free"> = DEFAULT_GALLERY_IMAGE_ASPECT
): GameImageViewportAspect {
  return viewport?.aspect ?? fallback;
}

export function resolveGameImageCropAspectRatio(
  viewport: GameImageViewport | null | undefined,
  fallback: Exclude<GameImageViewportAspect, "free"> = DEFAULT_GALLERY_IMAGE_ASPECT
) {
  const aspect = resolveGameImageCropAspect(viewport, fallback);
  if (aspect === "free") {
    const ratio = viewport?.aspectRatio;
    return typeof ratio === "number" &&
      Number.isFinite(ratio) &&
      ratio >= MIN_FREE_IMAGE_ASPECT_RATIO &&
      ratio <= MAX_FREE_IMAGE_ASPECT_RATIO
      ? ratio
      : FIXED_IMAGE_ASPECT_RATIOS[fallback];
  }
  return FIXED_IMAGE_ASPECT_RATIOS[aspect];
}

export function gameImageCropAspectLabel(
  viewport: GameImageViewport | null | undefined,
  fallback: Exclude<GameImageViewportAspect, "free"> = DEFAULT_GALLERY_IMAGE_ASPECT
) {
  const aspect = resolveGameImageCropAspect(viewport, fallback);
  if (aspect !== "free") return aspect;
  const ratio = resolveGameImageCropAspectRatio(viewport, fallback);
  return `Libre · ${ratio.toFixed(2)}:1`;
}

export function gameImageObjectPosition(
  viewport: GameImageViewport | null | undefined
) {
  const normalized = normalizeGameImageViewport(viewport);
  return `${(normalized.x * 100).toFixed(2)}% ${(normalized.y * 100).toFixed(2)}%`;
}
