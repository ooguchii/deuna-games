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
import { hasExactAdminFormFields } from "@/lib/admin/request-security";
import { verifyAdminSession } from "@/lib/admin/session";
import {
  findEditorialMediaResource,
  listEditorialMediaLibrary,
} from "@/lib/media/editorial-media-library";
import {
  normalizeGameVideoViewport,
  withoutGameVideoTarget,
} from "@/lib/media/game-video-media";
import { DEFAULT_PREVIEW_VIEWPORT } from "@/lib/media/preview-video-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const assignmentTargetSchema = z.enum([
  "cover-image",
  "hero-image",
  "hero-video",
  "card-video",
  "card-match-hero",
  "gallery-image",
]);

const fields = [
  "expectedRevision",
  "target",
  "resource",
] as const;

function redirectPath(slug: string, state: string) {
  return `/admin/juegos/${encodeURIComponent(slug)}?estado=${encodeURIComponent(state)}&seccion=multimedia`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await verifyAdminSession();
  const { slug } = await context.params;
  const [item, resources] = await Promise.all([
    getEditorialItem("game", slug),
    listEditorialMediaLibrary(slug),
  ]);

  if (!item) {
    return NextResponse.json(
      { error: "Juego no encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const heroVideo = item.payload.videoMedia?.hero ?? null;
  const cardVideo = item.payload.videoMedia?.card ?? null;

  return NextResponse.json(
    {
      revision: item.revision,
      resources,
      assignments: {
        coverImage: item.payload.coverImage ?? null,
        heroImage: item.payload.heroImage ?? null,
        screenshots: item.payload.screenshots ?? [],
        heroMode: heroVideo ? "video" : "image",
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

  const resources = await listEditorialMediaLibrary(slug);
  const imageResource = findEditorialMediaResource(resources, resource, "image");
  const videoResource = findEditorialMediaResource(resources, resource, "video");
  const current = item.payload;
  const currentHeroViewport = normalizeGameVideoViewport(
    current.videoMedia?.hero?.viewport ?? DEFAULT_PREVIEW_VIEWPORT
  );
  const currentCardViewport = normalizeGameVideoViewport(
    current.videoMedia?.card?.viewport ?? DEFAULT_PREVIEW_VIEWPORT
  );

  let update: Parameters<typeof saveGameMediaDraft>[3] | null = null;

  if (target.data === "cover-image") {
    if (!imageResource) return adminRedirect(authorized.adminOrigin, redirectPath(slug, "recurso-invalido"));
    update = { coverImage: imageResource.src };
  }

  if (target.data === "hero-image") {
    if (!imageResource) return adminRedirect(authorized.adminOrigin, redirectPath(slug, "recurso-invalido"));
    const withoutVideo = withoutGameVideoTarget(current, "hero");
    update = {
      heroImage: imageResource.src,
      videoMedia: withoutVideo.videoMedia,
      previewClip: withoutVideo.previewClip,
    };
  }

  if (target.data === "hero-video") {
    if (!videoResource) return adminRedirect(authorized.adminOrigin, redirectPath(slug, "recurso-invalido"));
    update = {
      videoMedia: {
        ...current.videoMedia,
        hero: {
          clip: videoResource.src,
          viewport: currentHeroViewport,
        },
      },
    };
  }

  if (target.data === "card-video") {
    if (!videoResource) return adminRedirect(authorized.adminOrigin, redirectPath(slug, "recurso-invalido"));
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
    if (!hero) return adminRedirect(authorized.adminOrigin, redirectPath(slug, "recurso-invalido"));
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
    if (!imageResource) return adminRedirect(authorized.adminOrigin, redirectPath(slug, "recurso-invalido"));
    const screenshots = Array.from(
      new Set([...(current.screenshots ?? []), imageResource.src])
    );
    if (screenshots.length > 8) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "galeria-llena")
      );
    }
    update = { screenshots };
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

  return adminRedirect(
    authorized.adminOrigin,
    redirectPath(slug, "recurso-asignado")
  );
}
