import { lstat } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialGameMediaFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveGameMediaDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";
import {
  resolveEditorialMediaDiskPath,
} from "@/lib/media/editorial-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "coverImage",
  "heroImage",
  "screenshotsText",
] as const;

async function fileIsRegular(
  absolutePath: string
) {
  try {
    const stats = await lstat(absolutePath);
    return (
      stats.isFile() &&
      !stats.isSymbolicLink()
    );
  } catch {
    return false;
  }
}

async function bundledImageExists(
  mediaPath: string
) {
  const publicRoot = path.resolve(
    process.cwd(),
    "public"
  );
  const imagesRoot = path.resolve(
    publicRoot,
    "images"
  );
  const absolutePath = path.resolve(
    publicRoot,
    `.${mediaPath}`
  );

  if (
    !absolutePath.startsWith(
      `${imagesRoot}${path.sep}`
    )
  ) {
    return false;
  }

  return fileIsRegular(absolutePath);
}

async function editorialImageExists(
  mediaPath: string
) {
  try {
    const resolved =
      resolveEditorialMediaDiskPath(mediaPath);

    return resolved
      ? fileIsRegular(resolved.filePath)
      : false;
  } catch {
    return false;
  }
}

async function mediaFilesExist(
  mediaPaths: string[]
) {
  for (const mediaPath of new Set(mediaPaths)) {
    const exists = mediaPath.startsWith(
      "/media/editorial/"
    )
      ? await editorialImageExists(mediaPath)
      : mediaPath.startsWith("/images/")
        ? await bundledImageExists(mediaPath)
        : false;

    if (!exists) return false;
  }

  return true;
}

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
      `${target}?estado=solicitud&seccion=multimedia`
    );
  }

  const parsed = editorialGameMediaFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=multimedia`
    );
  }

  try {
    const {
      expectedRevision,
      screenshotsText,
      ...input
    } = parsed.data;
    const mediaPaths = [
      input.coverImage,
      input.heroImage,
      ...(screenshotsText ?? []),
    ].filter(
      (value): value is string => Boolean(value)
    );

    if (!(await mediaFilesExist(mediaPaths))) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=asset&seccion=multimedia`
      );
    }

    const result = await saveGameMediaDraft(
      slug,
      expectedRevision,
      authorized.session.userId,
      {
        ...input,
        screenshots: screenshotsText,
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
      `${target}?estado=${state}&seccion=multimedia`
    );
  } catch {
    console.error(
      "No se pudo guardar la multimedia del juego."
    );
    return adminUnavailableResponse();
  }
}
