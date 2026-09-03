import type { NextRequest } from "next/server";

import { adminRedirect, adminUnavailableResponse, authorizeAdminFormRequest } from "@/lib/admin/admin-route";
import { expectedRevisionSchema } from "@/lib/admin/content-forms";
import { getEditorialItem, saveGameMediaDraft } from "@/lib/admin/content-service";
import { hasExactAdminFormFields } from "@/lib/admin/request-security";
import {
  withoutGameVideoTarget,
  type GameVideoTarget,
} from "@/lib/media/game-video-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const legacyFields = ["expectedRevision"] as const;
const targetFields = ["expectedRevision", "target"] as const;

function parseTarget(value: string | null): GameVideoTarget | null {
  if (value === null || value.trim() === "") return "card";
  return value === "hero" || value === "card" ? value : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;
  const { slug } = await context.params;
  const redirectTarget = `/admin/juegos/${encodeURIComponent(slug)}`;
  const hasTarget = hasExactAdminFormFields(authorized.form, targetFields);
  const isLegacy = !hasTarget && hasExactAdminFormFields(authorized.form, legacyFields);
  if (!hasTarget && !isLegacy) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=solicitud&seccion=multimedia`);
  const revision = expectedRevisionSchema.safeParse(authorized.form.get("expectedRevision"));
  const target = parseTarget(hasTarget ? authorized.form.get("target") : null);
  if (!revision.success || !target) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=solicitud&seccion=multimedia`);
  try {
    const item = await getEditorialItem("game", slug);
    if (!item) return adminRedirect(authorized.adminOrigin, "/admin/juegos?estado=no-encontrado");
    if (item.revision !== revision.data) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=conflicto&seccion=multimedia`);
    const media = withoutGameVideoTarget(item.payload, target);
    const result = await saveGameMediaDraft(
      slug,
      revision.data,
      authorized.session.userId,
      media
    );
    if (result.outcome === "not_found") return adminRedirect(authorized.adminOrigin, "/admin/juegos?estado=no-encontrado");
    if (result.outcome === "conflict") return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=conflicto&seccion=multimedia`);
    return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-quitado&seccion=multimedia`);
  } catch {
    return adminUnavailableResponse();
  }
}
