export const MAX_PREVIEW_SOURCE_BYTES = 1024 * 1024 * 1024;
export const MAX_PREVIEW_DURATION_SECONDS = 30;
export const MAX_PREVIEW_SOURCE_POSITION_SECONDS = 86_400;
export const MIN_PREVIEW_VIEWPORT_ZOOM = 1;
export const MAX_PREVIEW_VIEWPORT_ZOOM = 3;

export const PREVIEW_QUALITY_IDS = [
  "performance",
  "balanced",
  "high",
] as const;

export type PreviewQualityId =
  (typeof PREVIEW_QUALITY_IDS)[number];

export const DEFAULT_PREVIEW_QUALITY: PreviewQualityId =
  "balanced";

export type PreviewQualityOption = {
  id: PreviewQualityId;
  label: string;
  detail: string;
  targetWidth: number;
  targetFps: number;
};

export const PREVIEW_QUALITY_OPTIONS: readonly PreviewQualityOption[] = [
  {
    id: "performance",
    label: "Ligera",
    detail: "Menor consumo y peso. Ideal para muchas tarjetas o equipos modestos.",
    targetWidth: 360,
    targetFps: 12,
  },
  {
    id: "balanced",
    label: "Equilibrada",
    detail: "Recomendada. Prioriza fluidez, nitidez y carga rápida.",
    targetWidth: 480,
    targetFps: 15,
  },
  {
    id: "high",
    label: "Alta",
    detail: "Más detalle y movimiento, con mayor costo de codificación y descarga.",
    targetWidth: 640,
    targetFps: 20,
  },
];

export const PREVIEW_VIEWPORT_ASPECT_IDS = [
  "source",
  "16:9",
  "1:1",
  "4:5",
  "9:16",
] as const;

export type PreviewViewportAspectId =
  (typeof PREVIEW_VIEWPORT_ASPECT_IDS)[number];

export type PreviewViewportAspectOption = {
  id: PreviewViewportAspectId;
  label: string;
  ratio: number | null;
};

export const PREVIEW_VIEWPORT_ASPECT_OPTIONS: readonly PreviewViewportAspectOption[] = [
  { id: "source", label: "Original", ratio: null },
  { id: "16:9", label: "16:9 · Horizontal", ratio: 16 / 9 },
  { id: "1:1", label: "1:1 · Cuadrado", ratio: 1 },
  { id: "4:5", label: "4:5 · Vertical", ratio: 4 / 5 },
  { id: "9:16", label: "9:16 · Historia", ratio: 9 / 16 },
];

export type PreviewViewport = {
  x: number;
  y: number;
  zoom: number;
  aspect: PreviewViewportAspectId;
};

export const DEFAULT_PREVIEW_VIEWPORT: PreviewViewport = {
  x: 0.5,
  y: 0.5,
  zoom: 1,
  aspect: "source",
};

export type ResolvedPreviewViewportCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreviewTrimWindow = {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

function roundViewportNumber(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function parsePreviewQuality(
  value: string | null | undefined
): PreviewQualityId | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;

  return PREVIEW_QUALITY_IDS.includes(
    normalized as PreviewQualityId
  )
    ? (normalized as PreviewQualityId)
    : null;
}

export function parsePreviewViewportAspect(
  value: string | null | undefined
): PreviewViewportAspectId | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;

  return PREVIEW_VIEWPORT_ASPECT_IDS.includes(
    normalized as PreviewViewportAspectId
  )
    ? (normalized as PreviewViewportAspectId)
    : null;
}

export function parsePreviewViewport(
  xValue: string | null | undefined,
  yValue: string | null | undefined,
  zoomValue: string | null | undefined,
  aspectValue: string | null | undefined
): PreviewViewport | null {
  if (
    xValue === null || xValue === undefined || xValue.trim() === "" ||
    yValue === null || yValue === undefined || yValue.trim() === "" ||
    zoomValue === null || zoomValue === undefined || zoomValue.trim() === ""
  ) {
    return null;
  }

  const x = Number(xValue);
  const y = Number(yValue);
  const zoom = Number(zoomValue);
  const aspect = parsePreviewViewportAspect(aspectValue);

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(zoom) ||
    x < 0 || x > 1 ||
    y < 0 || y > 1 ||
    zoom < MIN_PREVIEW_VIEWPORT_ZOOM ||
    zoom > MAX_PREVIEW_VIEWPORT_ZOOM ||
    !aspect
  ) {
    return null;
  }

  return {
    x: roundViewportNumber(x),
    y: roundViewportNumber(y),
    zoom: roundViewportNumber(zoom),
    aspect,
  };
}

export function resolvePreviewViewportCrop(
  sourceWidth: number,
  sourceHeight: number,
  viewport: PreviewViewport
): ResolvedPreviewViewportCrop | null {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return null;
  }

  const parsed = parsePreviewViewport(
    String(viewport.x),
    String(viewport.y),
    String(viewport.zoom),
    viewport.aspect
  );
  if (!parsed) return null;

  const aspectOption = PREVIEW_VIEWPORT_ASPECT_OPTIONS.find(
    (option) => option.id === parsed.aspect
  );
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = aspectOption?.ratio ?? sourceRatio;

  let baseWidth = sourceWidth;
  let baseHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    baseWidth = sourceHeight * targetRatio;
  } else if (sourceRatio < targetRatio) {
    baseHeight = sourceWidth / targetRatio;
  }

  const width = Math.min(sourceWidth, baseWidth / parsed.zoom);
  const height = Math.min(sourceHeight, baseHeight / parsed.zoom);
  const x = (sourceWidth - width) * parsed.x;
  const y = (sourceHeight - height) * parsed.y;

  return { x, y, width, height };
}

export function parsePreviewTrimWindow(
  startValue: string | null,
  endValue: string | null
): PreviewTrimWindow | null {
  if (
    startValue === null ||
    endValue === null ||
    startValue.trim() === "" ||
    endValue.trim() === ""
  ) {
    return null;
  }

  const rawStart = Number(startValue);
  const rawEnd = Number(endValue);

  if (
    !Number.isFinite(rawStart) ||
    !Number.isFinite(rawEnd) ||
    rawStart < 0 ||
    rawEnd <= rawStart ||
    rawStart > MAX_PREVIEW_SOURCE_POSITION_SECONDS ||
    rawEnd > MAX_PREVIEW_SOURCE_POSITION_SECONDS
  ) {
    return null;
  }

  const startMilliseconds = Math.round(rawStart * 1_000);
  const endMilliseconds = Math.round(rawEnd * 1_000);
  const durationMilliseconds =
    endMilliseconds - startMilliseconds;

  if (
    durationMilliseconds <= 0 ||
    durationMilliseconds >
      MAX_PREVIEW_DURATION_SECONDS * 1_000
  ) {
    return null;
  }

  return {
    startSeconds: startMilliseconds / 1_000,
    endSeconds: endMilliseconds / 1_000,
    durationSeconds: durationMilliseconds / 1_000,
  };
}
