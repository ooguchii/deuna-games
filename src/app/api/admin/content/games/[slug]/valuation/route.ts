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
  saveGameValuationSection,
} from "@/lib/admin/game-editor-sections-service";
import {
  gameValuationSectionSchema,
} from "@/lib/admin/game-editor-section-validation";
import {
  getGameInsights,
} from "@/lib/admin/game-insights";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "rating",
  "valuationMode",
] as const;

function insightRating(score: number) {
  const normalized = Math.max(0, Math.min(5, score / 20));
  return Math.round(normalized * 100) / 100;
}

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
    "valoracion"
  );

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=valoracion`
    );
  }

  const parsed = gameValuationSectionSchema.safeParse(
    Object.fromEntries(authorized.form)
  );
  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=valoracion&seccion=valoracion`
    );
  }

  try {
    const {
      expectedRevision,
      rating,
      valuationMode,
    } = parsed.data;

    let nextRating = rating;
    let auditDetails:
      | {
          valuationSource: "manual";
        }
      | {
          valuationSource: "insight";
          insightScore: number;
          insightConfidence: "medium" | "high";
          insightEvidenceCount: number;
        };

    if (valuationMode === "insight") {
      const insights = await getGameInsights(slug);
      const confidence = insights.index.confidence;

      if (
        !insights.migrationReady ||
        confidence === "low" ||
        insights.index.evidenceCount <= 0
      ) {
        return adminRedirect(
          authorized.adminOrigin,
          `${target}?estado=valoracion-sugerencia&seccion=valoracion`
        );
      }

      nextRating = insightRating(insights.index.score);
      auditDetails = {
        valuationSource: "insight",
        insightScore: insights.index.score,
        insightConfidence: confidence,
        insightEvidenceCount: insights.index.evidenceCount,
      };
    } else {
      auditDetails = {
        valuationSource: "manual",
      };
    }

    const result = await saveGameValuationSection(
      slug,
      expectedRevision,
      authorized.session.userId,
      { rating: nextRating },
      auditDetails
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
        `${target}?estado=conflicto&seccion=valoracion`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      gameEditorSuccessTarget(target, "valoracion", continuation)
    );
  } catch {
    console.error("No se pudo guardar la Valoración editorial del juego.");
    return adminUnavailableResponse();
  }
}
