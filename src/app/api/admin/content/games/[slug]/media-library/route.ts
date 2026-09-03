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
  evaluateGameMediaRequirements,
  REQUIRED_DESTINATION_ASPECTS,
} from "@/lib/media/game-media-requirements";
import {
  DEFAULT_GAME_IMAGE_VIEWPORT,
} from "@/lib/media/image-viewport";
import {
  resolveGameDestinationMediaMode,
} from "@/lib/media/game-video-media";
import type {
  Game,
  GameDestinationMediaMode,
  GameImageMedia,
  GameVideoViewport,
} from "@/types/game";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const assignmentTargetSchema = z.enum([
  "cover-mode",
  "cover-image",
  "cover-video",
  "hero-mode",
  "hero-image",
  "hero-video",
  "card-mode",
  "card-image",
  "card-video",
  "gallery-image",
  "gallery-remove",
  "image-delete",
]);

const mediaModeSchema = z.enum([
  "image",
  "video",
  "hover-video",
]);

const fields = [
  "expectedRevision",
  "target",
  "resource",
] as const;

function redirectPath(slug: string, state: string) {
  return `/admin/juegos/${encodeURIComponent(slug)}?estado=${encodeURIComponent(state)}&seccion=multimedia`;
}

function requiredVideoViewport(
  target: "cover" | "hero" | "card"
): GameVideoViewport {
  return {
    x: 0.5,
    y: 0.5,
    zoom: 1,
    aspect: REQUIRED_DESTINATION_ASPECTS[target],
  };
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

type MediaDraftUpdate = Parameters<typeof saveGameMediaDraft>[3] &
  Partial<Pick<Game, "cardImage" | "mediaModes">>;

function mediaUpdate(
  update: MediaDraftUpdate,
  imageMedia?: GameImageMedia
): MediaDraftUpdate {
  return {
    ...update,
    ...(imageMedia ? { imageMedia } : {}),
  };
}

function withoutImageResource(
  game: Game,
  resource: string
): MediaDraftUpdate {
  const imageMedia: GameImageMedia = {
    ...game.imageMedia,
  };

  if (game.coverImage === resource) {
    delete imageMedia.cover;
  }

  if (game.heroImage === resource) {
    delete imageMedia.hero;
  }

  if (game.cardImage === resource) {
    delete imageMedia.card;
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
      cardImage:
        game.cardImage === resource
          ? undefined
          : game.cardImage,
      screenshots: (game.screenshots ?? []).filter(
        (src) => src !== resource
      ),
    },
    imageMedia
  );
}

function mediaModeUpdate(
  game: Game,
  target: "cover" | "hero" | "card",
  mode: GameDestinationMediaMode
): MediaDraftUpdate {
  const playback: "hover" | "always" =
    mode === "hover-video" ? "hover" : "always";
  const videoMedia = game.videoMedia
    ? {
        ...game.videoMedia,
        ...(target === "cover" && game.videoMedia.cover
          ? {
              cover: {
                ...game.videoMedia.cover,
                playback,
              },
            }
          : {}),
        ...(target === "hero" && game.videoMedia.hero
          ? {
              hero: {
                ...game.videoMedia.hero,
                playback,
              },
            }
          : {}),
        ...(target === "card" && game.videoMedia.card
          ? {
              card: {
                ...game.videoMedia.card,
                playback,
              },
            }
          : {}),
      }
    : undefined;

  return {
    mediaModes: {
      ...game.mediaModes,
      [target]: mode,
    },
    ...(videoMedia ? { videoMedia } : {}),
  };
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

  return NextResponse.json(
    {
      revision: item.revision,
      resources,
      requirements: evaluateGameMediaRequirements(item.payload),
      assignments: {
        coverImage: item.payload.coverImage ?? null,
        heroImage: item.payload.heroImage ?? null,
        cardImage: item.payload.cardImage ?? null,
        screenshots: item.payload.screenshots ?? [],
        imageMedia: item.payload.imageMedia ?? null,
        coverMode: resolveGameDestinationMediaMode(item.payload, "cover"),
        heroMode: resolveGameDestinationMediaMode(item.payload, "hero"),
        cardMode: resolveGameDestinationMediaMode(item.payload, "card"),
        coverVideo: item.payload.videoMedia?.cover ?? null,
        heroVideo: item.payload.videoMedia?.hero ?? null,
        cardVideo: item.payload.videoMedia?.card ?? null,
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

  let update: MediaDraftUpdate | null = null;

  if (
    target.data === "cover-mode" ||
    target.data === "hero-mode" ||
    target.data === "card-mode"
  ) {
    const mode = mediaModeSchema.safeParse(resource);
    if (!mode.success) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "solicitud")
      );
    }
    const destination = target.data.replace("-mode", "") as
      "cover" | "hero" | "card";
    update = mediaModeUpdate(current, destination, mode.data);
  }

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
    update = mediaUpdate(
      { heroImage: imageResource.src },
      {
        ...current.imageMedia,
        hero: { ...DEFAULT_GAME_IMAGE_VIEWPORT },
      }
    );
  }

  if (target.data === "card-image") {
    if (!imageResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    update = mediaUpdate(
      { cardImage: imageResource.src },
      {
        ...current.imageMedia,
        card: { ...DEFAULT_GAME_IMAGE_VIEWPORT },
      }
    );
  }

  if (target.data === "cover-video") {
    if (!videoResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    const mode = resolveGameDestinationMediaMode(current, "cover");
    update = {
      videoMedia: {
        ...current.videoMedia,
        cover: {
          clip: videoResource.src,
          viewport: requiredVideoViewport("cover"),
          playback: mode === "hover-video" ? "hover" : "always",
        },
      },
    };
  }

  if (target.data === "hero-video") {
    if (!videoResource) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
    const mode = resolveGameDestinationMediaMode(current, "hero");
    update = {
      videoMedia: {
        ...current.videoMedia,
        hero: {
          clip: videoResource.src,
          viewport: requiredVideoViewport("hero"),
          playback: mode === "hover-video" ? "hover" : "always",
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
    const mode = resolveGameDestinationMediaMode(current, "card");
    update = {
      videoMedia: {
        ...current.videoMedia,
        card: {
          source: "independent",
          clip: videoResource.src,
          viewport: requiredVideoViewport("card"),
          playback: mode === "hover-video" ? "hover" : "always",
        },
      },
      previewClip: videoResource.src,
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