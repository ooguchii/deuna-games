export const MAX_PREVIEW_SOURCE_BYTES = 1024 * 1024 * 1024;
export const MAX_PREVIEW_DURATION_SECONDS = 30;
export const MAX_PREVIEW_SOURCE_POSITION_SECONDS = 86_400;

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

export type PreviewTrimWindow = {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

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
