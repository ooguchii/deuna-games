import "server-only";

import type { NextRequest } from "next/server";

import {
  hasTrustedAdminOrigin,
} from "./request-security";

export const MAX_ADMIN_MEDIA_REQUEST_BYTES =
  8 * 1024 * 1024;
export const MAX_ADMIN_PREVIEW_REQUEST_BYTES =
  66 * 1024 * 1024;

export async function readTrustedAdminMediaForm(
  request: NextRequest,
  adminOrigin: string,
  maximumBytes = MAX_ADMIN_MEDIA_REQUEST_BYTES
) {
  const contentType =
    request.headers.get("content-type") ?? "";
  const contentLengthHeader =
    request.headers.get("content-length");
  const effectiveMaximum = Math.min(
    Math.max(1, maximumBytes),
    MAX_ADMIN_PREVIEW_REQUEST_BYTES
  );

  if (
    !hasTrustedAdminOrigin(
      request,
      adminOrigin
    )
  ) {
    return null;
  }

  if (
    !contentType
      .toLowerCase()
      .startsWith("multipart/form-data;")
  ) {
    return null;
  }

  if (!contentLengthHeader) {
    return null;
  }

  const contentLength = Number(
    contentLengthHeader
  );

  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > effectiveMaximum
  ) {
    return null;
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return null;
  }

  let valueBytes = 0;

  for (const [key, value] of form.entries()) {
    valueBytes += Buffer.byteLength(key, "utf8");
    valueBytes +=
      typeof value === "string"
        ? Buffer.byteLength(value, "utf8")
        : value.size;

    if (
      valueBytes >
      effectiveMaximum
    ) {
      return null;
    }
  }

  return form;
}

export function hasExactAdminMediaFormFields(
  form: FormData,
  fields: readonly string[]
) {
  const allowed = new Set(fields);
  const keys = [...form.keys()];

  return (
    keys.length === fields.length &&
    fields.every(
      (field) => form.getAll(field).length === 1
    ) &&
    keys.every((field) => allowed.has(field))
  );
}
