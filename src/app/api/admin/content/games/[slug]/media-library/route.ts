import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  adminRedirect,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import { expectedRevisionSchema } from "@/lib/admin/content-forms";
import {
  getEditorialItem,
  saveGameMediaDraft,
} from "@/lib/admin/content-service";
import {
  listGameImageReferences,
} from "@/lib/admin/game-media-integrity";
import {
  getPublishedGameImageReferences,
} from "@/lib/admin/publication-service";
import { hasExactAdminFormFields } from "@/lib/admin/request-security";
import { verifyAdminSession } from "@/lib/admin/session";
import {
  deleteEditorialImageResource,
  findEditorialMediaResource,
  listAssignedBundledImageResources,
  listEditorialMediaLibrary,
  markEditorialImageForDeletion,
  mergeEditorialMediaResources,
  reconcileEditorialImageDeletions,
} from "@/lib/media/editorial-media-library";
import {
  evaluateGameMediaReadiness,
} from "@/lib/media/game-media-readiness";
import {
  DEFAULT_GAME_IMAGE_VIEWPORT,
} from "@/lib/media/image-viewport";
import {
  normalizeGameVideoViewport,
  withoutGameVideoTarget,
} from "@/lib/media/game-video-media";
import { DEFAULT_PREVIEW_VIEWPORT } from "@/lib/media/preview-video-policy";
import type {
  Game,
  GameImageMedia,
} from "@/types/game";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const assignmentTargetSchema = z.enum([
  "cover-image",
  "hero-image",
  "hero-video",
  "hero-hover-video",
  "card-video",
  "card-match-hero",
  "gallery-image",
  "gallery-remove",
  "image-delete",
]);

const fields = [
  "expectedRevision",
  "target",
  "resource",
] as const;

function redirectPath(slug: string, state: string) {
  return `/admin/juegos/${encodeURIComponent(slug)}?estado=${encodeURIComponent(state)}&seccion=multimedia`;
}

async function resourcesForGame(
  slug: string,
  game: Game,
  publishedImageReferences: readonly string[]
) {
  const imageReferences = listGameImageReferences(game);

  await reconcileEditorialImageDeletions(
    slug,
    imageReferences,
    publishedImageReferences
  );

  const [editorial, bundled] = await Promise.all([
    listEditorialMediaLibrary(slug),
    listAssignedBundledImageResources(imageReferences),
  ]);

  return mergeEditorialMediaResources(editorial, bundled);
}

function mediaUpdate(
  update: Parameters<typeof saveGameMediaDraft>[3],
  imageMedia?: GameImageMedia
) {
  return {
    ...update,
    ...(imageMedia ? { imageMedia } : {}),
  } as Parameters<typeof saveGameMediaDraft>[3] &
    Pick<Game, "imageMedia">;
}

function withoutImageResource(
  game: Game,
  resource: string
) {
  const imageMedia: GameImageMedia = {
    ...game.imageMedia,
  };

  if (game.coverImage === resource) {
    delete imageMedia.cover;
    delete imageMedia.card;
  }

  if (game.heroImage === resource) {
    delete imageMedia.hero;
  }

  const gallery = {
    ...imageMedia.gallery,
  };
  delete gallery[resource];

  if (Object.keys(gallery).length) {
    imageMedia.gallery = gallery;
  } else {
    delete imageMedia.gallery;
  }

  return mediaUpdate(
    {
      coverImage:
        game.coverImage === resource
          ? undefined
          : game.coverImage,
      heroImage:
        game.heroImage === resource
          ? undefined
          : game.heroImage,
      screenshots: (game.screenshots ?? []).filter(
        (src) => src !== resource
      ),
    },
    imageMedia
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await verifyAdminSession();
  const { slug } = await context.params;
  const item = await getEditorialItem("game", slug);

  if (!item) {
    return NextResponse.json(
      { error: "Juego no encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const publishedImageReferences =
    await getPublishedGameImageReferences(slug);
  const resources = await resourcesForGame(
    slug,
    item.payload,
    publishedImageReferences
  );
  const heroVideo = item.payload.videoMedia?.hero ?? null;
  const cardVideo = item.payload.videoMedia?.card ?? null;
  const heroMode = heroVideo
    ? heroVideo.playback === "hover"
      ? "hover-video"
      : "video"
    : "image";

  return NextResponse.json(
    {
      revision: item.revision,
      resources,
      readiness: evaluateGameMediaReadiness(item.payload),
      assignments: {
        coverImage: item.payload.coverImage ?? null,
        heroImage: item.payload.heroImage ?? null,
        screenshots: item.payload.screenshots ?? [],
        imageMedia: item.payload.imageMedia ?? null,
        heroMode,
        heroVideo,
        cardVideo,
        legacyPreviewClip: item.payload.previewClip ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;

  const { slug } = await context.params;

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "solicitud")
    );
  }

  const revision = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );
  const target = assignmentTargetSchema.safeParse(
    authorized.form.get("target")
  );
  const resourceValue = authorized.form.get("resource");
  const resource = typeof resourceValue === "string" ? resourceValue : "";

  if (!revision.success || !target.success) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "solicitud")
    );
  }

  const item = await getEditorialItem("game", slug);
  if (!item) {
    return adminRedirect(
      authorized.adminOrigin,
      "/admin/juegos?estado=no-encontrado"
    );
  }
  if (item.revision !== revision.data) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "conflicto")
    );
  }

  const current = item.payload;
  const publishedImageReferences =
    await getPublishedGameImageReferences(slug);
  const resources = await resourcesForGame(
    slug,
    current,
    publishedImageReferences
  );
  const imageResourceMatch = findEditorialMediaResource(
    resources,
    resource,
    "image"
  );
  const imageResource = imageResourceMatch?.kind === "image"
    ? imageResourceMatch
    : undefined;
  const videoResourceMatch = findEditorialMediaResource(
    resources,
    resource,
    "video"
  );
  const videoResource = videoResourceMatch?.kind === "video"
    ? videoResourceMatch
    : undefined;
  const currentHeroViewport = normalizeGameVideoViewport(
    current.videoMedia?.hero?.viewport ?? DEFAULT_PREVIEW_VIEWPORT
  );
  const currentCardViewport = normalizeGameVideoViewport(
    current.videoMedia?.card?.viewport ?? DEFAULT_PREVIEW_VIEWPORT
  );

  let update: Parameters<typeof saveGameMediaDraft>[3] | null = null;

  if (target.data === "cover-image") {
    if (!imageResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    update = mediaUpdate(
      { coverImage: imageResource.src },
      {
        ...current.imageMedia,
        cover: { ...DEFAULT_GAME_IMAGE_VIEWPORT },
        card: { ...DEFAULT_GAME_IMAGE_VIEWPORT },
      }
    );
  }

  if (target.data === "hero-image") {
    if (!imageResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    const withoutVideo = withoutGameVideoTarget(current, "hero");
    update = mediaUpdate(
      {
        heroImage: imageResource.src,
        videoMedia: withoutVideo.videoMedia,
        previewClip: withoutVideo.previewClip,
      },
      {
        ...current.imageMedia,
        hero: { ...DEFAULT_GAME_IMAGE_VIEWPORT },
      }
    );
  }

  if (target.data === "hero-video" || target.data === "hero-hover-video") {
    if (!videoResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    update = {
      videoMedia: {
        ...current.videoMedia,
        hero: {
          clip: videoResource.src,
          viewport: currentHeroViewport,
          playback: target.data === "hero-hover-video" ? "hover" : "always",
        },
      },
    };
  }

  if (target.data === "card-video") {
    if (!videoResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    const sharesHero = current.videoMedia?.hero?.clip === videoResource.src;
    update = {
      videoMedia: {
        ...current.videoMedia,
        card: sharesHero
          ? {
              source: "hero",
              viewport: currentCardViewport,
            }
          : {
              source: "independent",
              clip: videoResource.src,
              viewport: currentCardViewport,
            },
      },
      previewClip: videoResource.src,
    };
  }

  if (target.data === "card-match-hero") {
    const hero = current.videoMedia?.hero;
    if (!hero) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    update = {
      videoMedia: {
        ...current.videoMedia,
        card: {
          source: "hero",
          viewport: currentCardViewport,
        },
      },
      previewClip: hero.clip,
    };
  }

  if (target.data === "gallery-image") {
    if (!imageResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    const screenshots = Array.from(
      new Set([...(current.screenshots ?? []), imageResource.src])
    );
    if (screenshots.length > 8) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "galeria-llena")
      );
    }
    update = mediaUpdate(
      { screenshots },
      {
        ...current.imageMedia,
        gallery: {
          ...current.imageMedia?.gallery,
          [imageResource.src]: current.imageMedia?.gallery?.[imageResource.src]
            ?? { ...DEFAULT_GAME_IMAGE_VIEWPORT },
        },
      }
    );
  }

  if (target.data === "gallery-remove") {
    const currentScreenshots = current.screenshots ?? [];
    if (!currentScreenshots.includes(resource)) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }

    const screenshots = currentScreenshots.filter((src) => src !== resource);
    const gallery = { ...current.imageMedia?.gallery };
    delete gallery[resource];

    update = mediaUpdate(
      { screenshots },
      {
        ...current.imageMedia,
        ...(Object.keys(gallery).length ? { gallery } : { gallery: undefined }),
      }
    );
  }

  if (target.data === "image-delete") {
    if (!imageResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }

    update = withoutImageResource(current, imageResource.src);
  }

  if (!update) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "solicitud")
    );
  }

  const result = await saveGameMediaDraft(
    slug,
    revision.data,
    authorized.session.userId,
    update
  );

  if (result.outcome === "not_found") {
    return adminRedirect(
      authorized.adminOrigin,
      "/admin/juegos?estado=no-encontrado"
    );
  }
  if (result.outcome === "conflict") {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "conflicto")
    );
  }

  if (target.data === "image-delete" && imageResource) {
    if (imageResource.origin === "bundled") {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-eliminado-base")
      );
    }

    try {
      const deletion = await markEditorialImageForDeletion(
        slug,
        imageResource
      );

      if (deletion === "missing") {
        return adminRedirect(
          authorized.adminOrigin,
          redirectPath(slug, "recurso-eliminado")
        );
      }

      if (publishedImageReferences.includes(imageResource.src)) {
        return adminRedirect(
          authorized.adminOrigin,
          redirectPath(slug, "recurso-eliminacion-pendiente")
        );
      }

      await deleteEditorialImageResource(slug, imageResource);
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-eliminado")
      );
    } catch {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-eliminacion-incompleta")
      );
    }
  }

  return adminRedirect(
    authorized.adminOrigin,
    redirectPath(
      slug,
      target.data === "gallery-remove" ? "galeria-actualizada" : "recurso-asignado"
    )
  );
}