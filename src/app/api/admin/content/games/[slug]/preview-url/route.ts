import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";
import {
  createStagedRemotePreviewSource,
} from "@/lib/media/editorial-video-staging";
import {
  parseSupportedPlatformVideoUrl,
} from "@/lib/media/platform-video-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "url",
] as const;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  const startedAt = Date.now();
  const authorized = await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return json({ error: "Solicitud inválida." }, 400);
  }

  const { slug } = await context.params;
  const revision = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );
  const sourceUrl = authorized.form.get("url")?.trim() ?? "";

  if (!revision.success) {
    return json(
      { error: "La revisión del juego no es válida." },
      400
    );
  }

  if (!sourceUrl) {
    return json(
      { error: "Pega una URL pública de video." },
      400
    );
  }

  const platform = parseSupportedPlatformVideoUrl(sourceUrl);

  try {
    const item = await getEditorialItem("game", slug);

    if (!item) {
      return json(
        { error: "El juego ya no está disponible." },
        404
      );
    }

    if (item.revision !== revision.data) {
      return json(
        {
          error:
            "Otra pestaña guardó una revisión más reciente. Recarga el editor antes de preparar el video.",
        },
        409
      );
    }

    const staged = await createStagedRemotePreviewSource(
      slug,
      authorized.session.userId,
      sourceUrl
    );

    return json({
      token: staged.token,
      src:
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source/${staged.token}`,
      bytes: staged.bytes,
      contentType: staged.contentType,
      expiresAt: staged.expiresAt,
      sourceKind: platform ? "platform" : "direct",
      platform: platform?.platform ?? null,
      platformLabel: platform?.platformLabel ?? "URL directa",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo preparar el video desde esa URL.";

    console.error(
      `[preview-url:${platform?.platform ?? "direct"}] durationMs=${Date.now() - startedAt} error=${message}`
    );

    return json({ error: message }, 400);
  }
}
