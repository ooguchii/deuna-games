import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authorizeAdminFormRequest } from "@/lib/admin/admin-route";
import { expectedRevisionSchema } from "@/lib/admin/content-forms";
import { getEditorialItem } from "@/lib/admin/content-service";
import { hasExactAdminFormFields } from "@/lib/admin/request-security";
import { createStagedDirectPreviewSource } from "@/lib/media/editorial-video-staging";
import { parseDirectVideoUrl } from "@/lib/media/preview-providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["expectedRevision", "url"] as const;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;
  if (!hasExactAdminFormFields(authorized.form, fields)) return json({ error: "Solicitud inválida." }, 400);

  const { slug } = await context.params;
  const revision = expectedRevisionSchema.safeParse(authorized.form.get("expectedRevision"));
  const normalized = parseDirectVideoUrl(authorized.form.get("url")?.trim() ?? "");
  if (!revision.success) return json({ error: "La revisión del juego no es válida." }, 400);
  if (!normalized) return json({ error: "La URL directa no es válida." }, 400);

  try {
    const item = await getEditorialItem("game", slug);
    if (!item) return json({ error: "El juego ya no está disponible." }, 404);
    if (item.revision !== revision.data) return json({ error: "Otra pestaña guardó una revisión más reciente. Recarga el editor." }, 409);
    const staged = await createStagedDirectPreviewSource(slug, authorized.session.userId, normalized);
    return json({
      token: staged.token,
      src: `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source/${staged.token}`,
      bytes: staged.bytes,
      contentType: staged.contentType,
      expiresAt: staged.expiresAt,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No se pudo preparar la URL directa." }, 400);
  }
}
