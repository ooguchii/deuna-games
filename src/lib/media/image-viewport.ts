import type { GameImageViewport } from "@/types/game";

export const MIN_GAME_IMAGE_ZOOM = 1;
export const MAX_GAME_IMAGE_ZOOM = 3;

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

export function parseGameImageViewport(
  xValue: unknown,
  yValue: unknown,
  zoomValue: unknown
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

  return {
    x: round(x),
    y: round(y),
    zoom: round(zoom),
  };
}

export function normalizeGameImageViewport(
  viewport: GameImageViewport | null | undefined
): GameImageViewport {
  return (
    parseGameImageViewport(
      viewport?.x,
      viewport?.y,
      viewport?.zoom
    ) ?? { ...DEFAULT_GAME_IMAGE_VIEWPORT }
  );
}

export function gameImageObjectPosition(
  viewport: GameImageViewport | null | undefined
) {
  const normalized = normalizeGameImageViewport(viewport);
  return `${(normalized.x * 100).toFixed(2)}% ${(normalized.y * 100).toFixed(2)}%`;
}
