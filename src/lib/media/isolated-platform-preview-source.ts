import "server-only";

import {
  createStagedRemotePreviewSource,
  type StagedEditorialPreviewSource,
} from "./editorial-video-staging";
import {
  parseSupportedPlatformVideoUrl,
  type SupportedVideoPlatform,
} from "./platform-video-url";

export async function createIsolatedPlatformPreviewSource(
  slug: string,
  userId: string,
  expectedPlatform: SupportedVideoPlatform,
  sourceUrl: string
): Promise<StagedEditorialPreviewSource> {
  const parsed = parseSupportedPlatformVideoUrl(sourceUrl);

  if (!parsed || parsed.platform !== expectedPlatform) {
    throw new Error(
      `La URL no pertenece a ${expectedPlatform}. Selecciona la plataforma correcta y vuelve a intentarlo.`
    );
  }

  return createStagedRemotePreviewSource(
    slug,
    userId,
    parsed.url
  );
}
