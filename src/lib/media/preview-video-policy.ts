export const MAX_PREVIEW_SOURCE_BYTES = 64 * 1024 * 1024;
export const MAX_PREVIEW_DURATION_SECONDS = 30;
export const MAX_PREVIEW_SOURCE_POSITION_SECONDS = 86_400;

export type PreviewTrimWindow = {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

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
