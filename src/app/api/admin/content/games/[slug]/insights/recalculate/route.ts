import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  recalculateGameInsightScore,
} from "@/lib/admin/game-insights";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["expectedRevision"] as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;
  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=valoracion`
    );
  }

  const parsed = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );
  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=valoracion`
    );
  }

  try {
    const item = await getEditorialItem("game", slug);
    if (!item) {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }
    if (item.revision !== parsed.data) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto&seccion=valoracion`
      );
    }

    await recalculateGameInsightScore(
      slug,
      authorized.session.userId
    );

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=insights&seccion=valoracion`
    );
  } catch {
    console.error("No se pudo recalcular el Índice DeUna del juego.");
    return adminUnavailableResponse();
  }
}
