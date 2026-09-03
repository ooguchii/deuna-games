import type { NextRequest } from "next/server";
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
import {
  parseGameImageViewport,
} from "@/lib/media/image-viewport";
import {
  resolveGameDestinationMediaMode,
} from "@/lib/media/game-video-media";
import type {
  Game,
  GameImageMedia,
  GameImageViewport,
} from "@/types/game";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const legacyImageTargets = ["cover", "hero", "card", "gallery"] as const;
const targetSchema = z.enum([...legacyImageTargets, "detail"]);
const baseFields = [
  "expectedRevision",
  "target",
  "viewportX",
  "viewportY",
  "viewportZoom",
] as const;
const galleryFields = [
  ...baseFields,
  "resource",
  "viewportAspect",
  "viewportAspectRatio",
] as const;

function redirectPath(slug: string, state: string) {
  return `/admin/juegos/${encodeURIComponent(slug)}?estado=${encodeURIComponent(state)}&seccion=multimedia`;
}

function hasImageForTarget(
  game: Game,
  target: Exclude<z.infer<typeof targetSchema>, "gallery">
) {
  if (resolveGameDestinationMediaMode(game, target) === "video") {
    return false;
  }

  if (target === "cover") return Boolean(game.coverImage);
  if (target === "hero") return Boolean(game.heroImage);
  if (target === "card") return Boolean(game.cardImage);
  if (target === "detail") return Boolean(game.detailImage);
  return false;
}

function confirmedViewport(viewport: GameImageViewport): GameImageViewport {
  return {
    ...viewport,
    confirmed: true,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;

  const { slug } = await context.params;
  const target = targetSchema.safeParse(authorized.form.get("target"));
  if (!target.success) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "imagen-encuadre-invalido")
    );
  }

  const expectsGalleryResource = target.data === "gallery";
  const validFields = expectsGalleryResource
    ? hasExactAdminFormFields(authorized.form, galleryFields)
    : hasExactAdminFormFields(authorized.form, baseFields);

  if (!validFields) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "solicitud")
    );
  }

  const revision = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );
  const viewport = expectsGalleryResource
    ? parseGameImageViewport(
        authorized.form.get("viewportX"),
        authorized.form.get("viewportY"),
        authorized.form.get("viewportZoom"),
        authorized.form.get("viewportAspect"),
        authorized.form.get("viewportAspectRatio")
      )
    : parseGameImageViewport(
        authorized.form.get("viewportX"),
        authorized.form.get("viewportY"),
        authorized.form.get("viewportZoom")
      );
  const resourceValue = authorized.form.get("resource");
  const resource = typeof resourceValue === "string" ? resourceValue : "";

  if (!revision.success || !viewport) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "imagen-encuadre-invalido")
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

  if (target.data === "gallery") {
    if (!resource || !(item.payload.screenshots ?? []).includes(resource)) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath(slug, "recurso-invalido")
      );
    }
  } else if (!hasImageForTarget(item.payload, target.data)) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "recurso-invalido")
    );
  }

  const savedViewport = confirmedViewport(viewport);
  const imageMedia: GameImageMedia = target.data === "gallery"
    ? {
        ...item.payload.imageMedia,
        gallery: {
          ...item.payload.imageMedia?.gallery,
          [resource]: savedViewport,
        },
      }
    : {
        ...item.payload.imageMedia,
        [target.data]: savedViewport,
      };

  const result = await saveGameMediaDraft(
    slug,
    revision.data,
    authorized.session.userId,
    { imageMedia }
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
    redirectPath(slug, "imagen-encuadre-guardado")
  );
}