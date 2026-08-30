import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialGameRequirementsFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveGameRequirementsDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
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
] as const;

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud#requisitos`
    );
  }

  const parsed = editorialGameRequirementsFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos#requisitos`
    );
  }

  try {
    const {
      expectedRevision,
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
    } = parsed.data;

    const result = await saveGameRequirementsDraft(
      slug,
      expectedRevision,
      authorized.session.userId,
      {
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
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}#requisitos`
    );
  } catch {
    console.error(
      "No se pudieron guardar los requisitos del juego."
    );
    return adminUnavailableResponse();
  }
}
