import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  gameEditorSuccessTarget,
  requestedGameEditorContinuation,
} from "@/lib/admin/game-editor-flow";
import {
  saveGameCompatibilitySection,
} from "@/lib/admin/game-editor-sections-service";
import {
  gameCompatibilitySectionSchema,
} from "@/lib/admin/game-editor-section-validation";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "platformsJson",
  "minimumSystem",
  "minimumProcessor",
  "minimumRam",
  "minimumGraphics",
  "minimumStorage",
  "recommendedSystem",
  "recommendedProcessor",
  "recommendedRam",
  "recommendedGraphics",
  "recommendedStorage",
  "verificationStatus",
  "verificationSource",
  "verifiedAt",
] as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;
  const continuation = requestedGameEditorContinuation(
    request.nextUrl,
    "requisitos"
  );

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=requisitos`
    );
  }

  const parsed = gameCompatibilitySectionSchema.safeParse(
    Object.fromEntries(authorized.form)
  );
  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=requisitos`
    );
  }

  try {
    const {
      expectedRevision,
      platformsJson,
      minimumSystem,
      minimumProcessor,
      minimumRam,
      minimumGraphics,
      minimumStorage,
      recommendedSystem,
      recommendedProcessor,
      recommendedRam,
      recommendedGraphics,
      recommendedStorage,
      verificationStatus,
      verificationSource,
      verifiedAt,
    } = parsed.data;
    const result = await saveGameCompatibilitySection(
      slug,
      expectedRevision,
      authorized.session.userId,
      {
        platforms: platformsJson,
        minimum: {
          system: minimumSystem,
          processor: minimumProcessor,
          ram: minimumRam,
          graphics: minimumGraphics,
          storage: minimumStorage,
        },
        recommended: {
          system: recommendedSystem,
          processor: recommendedProcessor,
          ram: recommendedRam,
          graphics: recommendedGraphics,
          storage: recommendedStorage,
        },
        metadata: {
          status: verificationStatus,
          source: verificationSource,
          verifiedAt,
        },
      }
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
        `${target}?estado=conflicto&seccion=requisitos`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      gameEditorSuccessTarget(target, "requisitos", continuation)
    );
  } catch {
    console.error("No se pudo guardar Compatibilidad del juego.");
    return adminUnavailableResponse();
  }
}
