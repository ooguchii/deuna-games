import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  adminRedirect,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
  saveGameMediaDraft,
} from "@/lib/admin/content-service";
import {
  authorizeAdminMediaRequest,
} from "@/lib/admin/media-admin-route";
import {
  hasExactAdminMediaFormFields,
} from "@/lib/admin/media-request-security";
import {
  clearEditorialImageDeletionMarker,
} from "@/lib/media/editorial-media-library";
import {
  reconcileGameImageMedia,
} from "@/lib/media/game-image-media";
import {
  storeEditorialWebp,
} from "@/lib/media/editorial-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mediaKindSchema = z.enum([
  "cover",
  "hero",
  "screenshot",
  "library",
]);

const fields = [
  "expectedRevision",
  "kind",
  "image",
] as const;

function readSingleString(
  form: FormData,
  field: string
) {
  const value = form.get(field);
  return typeof value === "string"
    ? value
    : null;
}

function readSingleFile(
  form: FormData,
  field: string
) {
  const value = form.get(field);

  return value instanceof File
    ? value
    : null;
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  const authorized =
    await authorizeAdminMediaRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const target =
    `/admin/juegos/${encodeURIComponent(slug)}`;

  if (
    !hasExactAdminMediaFormFields(
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
    readSingleString(
      authorized.form,
      "expectedRevision"
    )
  );
  const kind = mediaKindSchema.safeParse(
    readSingleString(authorized.form, "kind")
  );
  const image = readSingleFile(
    authorized.form,
    "image"
  );

  if (
    !revision.success ||
    !kind.success ||
    !image ||
    image.size <= 0
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=imagen-invalida&seccion=multimedia`
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

    if (
      kind.data === "screenshot" &&
      (item.payload.screenshots?.length ?? 0) >= 8
    ) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=galeria-llena&seccion=multimedia`
      );
    }

    const upload = await storeEditorialWebp(
      slug,
      image
    );

    // Si se vuelve a subir exactamente una imagen cuya eliminación estaba
    // pendiente, el mismo hash representa una decisión explícita de recuperarla.
    await clearEditorialImageDeletionMarker(
      slug,
      upload.publicPath
    );

    // Biblioteca es almacenamiento puro: el archivo ya quedó persistido por hash
    // y no hace falta crear una revisión si todavía no fue asignado a un destino.
    if (kind.data === "library") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=recurso-subido&seccion=multimedia`
      );
    }

    const screenshots =
      kind.data === "screenshot"
        ? Array.from(
            new Set([
              ...(item.payload.screenshots ?? []),
              upload.publicPath,
            ])
          ).slice(0, 8)
        : item.payload.screenshots;
    const assignments = {
      coverImage:
        kind.data === "cover"
          ? upload.publicPath
          : item.payload.coverImage,
      heroImage:
        kind.data === "hero"
          ? upload.publicPath
          : item.payload.heroImage,
      cardImage: item.payload.cardImage,
      screenshots,
    };
    const result = await saveGameMediaDraft(
      slug,
      revision.data,
      authorized.session.userId,
      {
        ...assignments,
        imageMedia: reconcileGameImageMedia(
          item.payload,
          assignments
        ),
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
        `${target}?estado=conflicto&seccion=multimedia`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=imagen-subida&seccion=multimedia`
    );
  } catch (error) {
    console.error(
      "No se pudo subir la imagen editorial del juego:",
      error instanceof Error
        ? error.message
        : "error no identificado"
    );

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=imagen-invalida&seccion=multimedia`
    );
  }
}
