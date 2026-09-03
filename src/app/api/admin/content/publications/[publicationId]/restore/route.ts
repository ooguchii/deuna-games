import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
  revisionIdSchema,
} from "@/lib/admin/content-forms";
import {
  inspectGameMediaIntegrity,
} from "@/lib/admin/game-media-integrity";
import {
  getHistoricalGamePublicationCandidate,
  inspectPublishedGameTaxonomyIntegrity,
} from "@/lib/admin/game-publication-review";
import {
  evaluateGamePublicationReadiness,
} from "@/lib/admin/game-publication-readiness";
import {
  revalidatePublicGameSurfaces,
} from "@/lib/admin/game-public-revalidation";
import {
  restoreGamePublication,
} from "@/lib/admin/publication-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ publicationId: string }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { publicationId } = await context.params;
  const parsedPublicationId =
    revisionIdSchema.safeParse(publicationId);

  if (
    !parsedPublicationId.success ||
    !hasExactAdminFormFields(
      authorized.form,
      ["expectedPublicationNumber"]
    )
  ) {
    return new Response("Solicitud rechazada.", {
      status: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const expected = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedPublicationNumber")
  );

  if (!expected.success) {
    return new Response("Solicitud rechazada.", {
      status: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  try {
    const candidate =
      await getHistoricalGamePublicationCandidate(
        parsedPublicationId.data
      );

    if (!candidate) {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    const target =
      `/admin/juegos/${encodeURIComponent(candidate.key)}/publicacion`;

    if (
      candidate.currentPublicationNumber !== expected.data
    ) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto-publicacion`
      );
    }

    const readiness = evaluateGamePublicationReadiness(
      candidate.game
    );
    if (!readiness.essentialsReady) {
      return adminRedirect(
        authorized.adminOrigin,
        `/admin/juegos/${encodeURIComponent(candidate.key)}?estado=multimedia-incompleta&seccion=multimedia`
      );
    }

    const taxonomyIntegrity =
      await inspectPublishedGameTaxonomyIntegrity(
        candidate.game
      );

    if (!taxonomyIntegrity.ok) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=catalogos-sin-publicar`
      );
    }

    const mediaIntegrity =
      await inspectGameMediaIntegrity(candidate.game);

    if (!mediaIntegrity.ok) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=asset-restauracion`
      );
    }

    const result = await restoreGamePublication(
      parsedPublicationId.data,
      expected.data,
      authorized.session.userId
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
        `${target}?estado=conflicto-publicacion`
      );
    }

    if (result.outcome === "restored") {
      revalidatePublicGameSurfaces(result.key);
    }

    const state =
      result.outcome === "restored"
        ? "publicacion-restaurada"
        : "sin-cambios";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}`
    );
  } catch {
    console.error(
      "No se pudo restaurar la publicación del juego."
    );
    return adminUnavailableResponse();
  }
}