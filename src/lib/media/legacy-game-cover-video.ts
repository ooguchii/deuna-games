export function legacyGameCoverVideoReference(
  payload: unknown
): string | null {
  if (!payload || typeof payload !== "object") return null;

  const videoMedia = (payload as { videoMedia?: unknown }).videoMedia;
  if (!videoMedia || typeof videoMedia !== "object") return null;

  const cover = (videoMedia as { cover?: unknown }).cover;
  if (!cover || typeof cover !== "object") return null;

  const clip = (cover as { clip?: unknown }).clip;
  if (typeof clip !== "string") return null;

  const normalized = clip.trim();
  return normalized || null;
}
