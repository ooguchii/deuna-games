import "server-only";

import type { NextRequest } from "next/server";

const MAX_ADMIN_FORM_BYTES = 8 * 1024;

function headerMatchesAdminOrigin(
  value: string | null,
  adminOrigin: string
) {
  if (!value) return false;

  try {
    return new URL(value).origin === adminOrigin;
  } catch {
    return false;
  }
}

function hasTrustedAdminOrigin(
  request: NextRequest,
  adminOrigin: string
) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get(
    "sec-fetch-site"
  );

  // Una petición declarada cross-site se rechaza siempre.
  if (fetchSite === "cross-site") {
    return false;
  }

  // Algunos navegadores o políticas de privacidad pueden enviar
  // Origin: null en formularios locales. Cuando existe un Origin
  // utilizable, debe coincidir de forma exacta con el origen fijado.
  if (origin && origin !== "null") {
    return origin === adminOrigin;
  }

  // Referer se usa únicamente como respaldo y sólo se compara el origen.
  if (referer) {
    return headerMatchesAdminOrigin(
      referer,
      adminOrigin
    );
  }

  // Si Origin/Referer fueron omitidos por el navegador, sólo se admite
  // una navegación que el propio navegador marque como no cross-site.
  return (
    fetchSite === "same-origin" ||
    fetchSite === "none"
  );
}

export async function readTrustedAdminForm(
  request: NextRequest,
  adminOrigin: string
) {
  const contentType =
    request.headers.get("content-type") ?? "";
  const contentLengthHeader =
    request.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : null;

  if (
    !hasTrustedAdminOrigin(
      request,
      adminOrigin
    )
  ) {
    return null;
  }

  if (
    !contentType.startsWith(
      "application/x-www-form-urlencoded"
    )
  ) {
    return null;
  }

  if (
    contentLength !== null &&
    (
      !Number.isFinite(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_ADMIN_FORM_BYTES
    )
  ) {
    return null;
  }

  let body: string;

  try {
    body = await request.text();
  } catch {
    return null;
  }

  if (
    Buffer.byteLength(body, "utf8") >
    MAX_ADMIN_FORM_BYTES
  ) {
    return null;
  }

  return new URLSearchParams(body);
}

export function hasExactAdminFormFields(
  form: URLSearchParams,
  fields: readonly string[]
) {
  const allowed = new Set(fields);

  return (
    form.size === fields.length &&
    fields.every(
      (field) => form.getAll(field).length === 1
    ) &&
    [...form.keys()].every((field) =>
      allowed.has(field)
    )
  );
}
