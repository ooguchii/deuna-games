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
  resolveGameCardVideo,
} from "@/lib/media/game-video-media";
import type {
  Game,
  GameImageMedia,
} from "@/types/game";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const targetSchema = z.enum(["cover", "hero", "card"]);
const fields = [
  "expectedRevision",
  "target",
  "viewportX",
  "viewportY",
  "viewportZoom",
] as const;

function redirectPath(slug: string, state: string) {
  return `/admin/juegos/${encodeURIComponent(slug)}?estado=${encodeURIComponent(state)}&seccion=multimedia`;
}

function hasImageForTarget(game: Game, target: z.infer<typeof targetSchema>) {
  if (target === "cover") return Boolean(game.coverImage);
  if (target === "hero") {
    return Boolean(game.heroImage) && !game.videoMedia?.hero;
  }

  return Boolean(game.coverImage) && !resolveGameCardVideo(game);
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
  const target = targetSchema.safeParse(
    authorized.form.get("target")
  );
  const viewport = parseGameImageViewport(
    authorized.form.get("viewportX"),
    authorized.form.get("viewportY"),
    authorized.form.get("viewportZoom")
  );

  if (!revision.success || !target.success || !viewport) {
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
  if (!hasImageForTarget(item.payload, target.data)) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(slug, "recurso-invalido")
    );
  }

  const imageMedia: GameImageMedia = {
    ...item.payload.imageMedia,
    [target.data]: viewport,
  };
  const mediaUpdate = {
    coverImage: item.payload.coverImage,
    imageMedia,
  };

  const result = await saveGameMediaDraft(
    slug,
    revision.data,
    authorized.session.userId,
    mediaUpdate
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
