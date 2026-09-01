import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
  saveGameMediaDraft,
  type GameMediaDraftInput,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";
import {
  isGameDirectPreviewPlatform,
  parseDirectPlatformPreview,
} from "@/lib/media/direct-platform-preview";
import type { Game } from "@/types/game";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "url",
  "startSeconds",
  "endSeconds",
] as const;

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      platform: string;
    }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug, platform: rawPlatform } =
    await context.params;
  const target =
    `/admin/juegos/${encodeURIComponent(slug)}`;

  if (
    !isGameDirectPreviewPlatform(rawPlatform) ||
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=multimedia`
    );
  }

  const revision = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );
  const preview = parseDirectPlatformPreview(
    rawPlatform,
    authorized.form.get("url") ?? "",
    authorized.form.get("startSeconds") ?? "",
    authorized.form.get("endSeconds") ?? ""
  );

  if (!revision.success || !preview) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-recorte-invalido&seccion=multimedia`
    );
  }

  try {
    const item = await getEditorialItem(
      "game",
      slug
    );

    if (!item) {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    if (item.revision !== revision.data) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto&seccion=multimedia`
      );
    }

    const update: GameMediaDraftInput &
      Pick<Game, "directPreview"> = {
        previewMode: rawPlatform,
        directPreview: preview,
      };

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
        `${target}?estado=conflicto&seccion=multimedia`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-subido&seccion=multimedia`
    );
  } catch (error) {
    console.error(
      `No se pudo guardar el preview directo ${rawPlatform}:`,
      error instanceof Error
        ? error.message
        : "error no identificado"
    );
    return adminUnavailableResponse();
  }
}
