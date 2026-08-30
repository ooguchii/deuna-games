import "server-only";

import type { NextRequest } from "next/server";

const MAX_ADMIN_FORM_BYTES = 8 * 1024;

type AdminFormRejectionReason =
  | "origin"
  | "content-type"
  | "content-length"
  | "body-read"
  | "body-size";

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

  if (fetchSite === "cross-site") {
    return false;
  }

  if (origin && origin !== "null") {
    return origin === adminOrigin;
  }

  if (referer) {
    return headerMatchesAdminOrigin(
      referer,
      adminOrigin
    );
  }

  return (
    fetchSite === "same-origin" ||
    fetchSite === "none"
  );
}

function logRejectedAdminForm(
  request: NextRequest,
  adminOrigin: string,
  reason: AdminFormRejectionReason
) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get(
    "sec-fetch-site"
  );
  const contentType = request.headers.get(
    "content-type"
  );
  const contentLength = request.headers.get(
    "content-length"
  );
  const host = request.headers.get("host");

  console.warn(
    "[admin-login-rejected]",
    JSON.stringify({
      reason,
      expectedOrigin: adminOrigin,
      requestOrigin: request.nextUrl.origin,
      host,
      origin,
      referer,
      fetchSite,
      contentType,
      contentLength,
    })
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
    logRejectedAdminForm(
      request,
      adminOrigin,
      "origin"
    );
    return null;
  }

  if (
    !contentType.startsWith(
      "application/x-www-form-urlencoded"
    )
  ) {
    logRejectedAdminForm(
      request,
      adminOrigin,
      "content-type"
    );
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
    logRejectedAdminForm(
      request,
      adminOrigin,
      "content-length"
    );
    return null;
  }

  let body: string;

  try {
    body = await request.text();
  } catch {
    logRejectedAdminForm(
      request,
      adminOrigin,
      "body-read"
    );
    return null;
  }

  if (
    Buffer.byteLength(body, "utf8") >
    MAX_ADMIN_FORM_BYTES
  ) {
    logRejectedAdminForm(
      request,
      adminOrigin,
      "body-size"
    );
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
