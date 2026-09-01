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
  isAdminEnabled,
} from "@/lib/admin/database-config";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";
import {
  getAdminSessionCookieName,
  resolveAdminSession,
} from "@/lib/admin/session";
import {
  ensureStagedEditorialPreviewProxy,
  resolveStagedEditorialPreviewProxy,
  resolveStagedEditorialPreviewSource,
} from "@/lib/media/editorial-video-staging";
import {
  serveStagedPreviewFile,
} from "@/lib/media/staged-preview-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["expectedRevision"] as const;

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

function notFound() {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function sessionUserId(request: NextRequest) {
  if (!isAdminEnabled()) return null;

  const session = await resolveAdminSession(
    request.cookies.get(
      getAdminSessionCookieName()
    )?.value
  );

  return session?.userId ?? null;
}

async function serve(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  },
  headOnly: boolean
) {
  const { slug, token } = await context.params;
  const userId = await sessionUserId(request);
  if (!userId) return notFound();

  const proxy = await resolveStagedEditorialPreviewProxy(
    slug,
    userId,
    token
  );

  if (!proxy) return notFound();

  return serveStagedPreviewFile(
    request,
    proxy,
    headOnly
  );
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  }
) {
  return serve(request, context, false);
}

export async function HEAD(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  }
) {
  return serve(request, context, true);
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return json({ error: "Solicitud inválida." }, 400);
  }

  const { slug, token } = await context.params;
  const revision = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );

  if (!revision.success) {
    return json(
      { error: "La revisión del juego no es válida." },
      400
    );
  }

  try {
    const item = await getEditorialItem(
      "game",
      slug
    );

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

    const source = await resolveStagedEditorialPreviewSource(
      slug,
      authorized.session.userId,
      token
    );

    if (!source) {
      return json(
        { error: "La fuente temporal venció. Vuelve a cargar el video." },
        404
      );
    }

    const proxy = await ensureStagedEditorialPreviewProxy(source);

    return json({
      src:
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source/${token}/proxy`,
      bytes: proxy.bytes,
      contentType: proxy.contentType,
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la vista previa compatible.",
      },
      400
    );
  }
}
