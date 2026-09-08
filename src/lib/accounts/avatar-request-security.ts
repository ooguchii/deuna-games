import "server-only";

import type { NextRequest } from "next/server";

import {
  hasTrustedAccountOrigin,
} from "./request-security";

export const MAX_ACCOUNT_AVATAR_REQUEST_BYTES =
  640 * 1024;

export async function readTrustedAccountAvatarForm(
  request: NextRequest
) {
  const contentType =
    request.headers.get("content-type") ?? "";
  const contentLengthHeader =
    request.headers.get("content-length");

  if (
    !hasTrustedAccountOrigin(request) ||
    !contentType
      .toLowerCase()
      .startsWith("multipart/form-data;") ||
    !contentLengthHeader
  ) {
    return null;
  }

  const contentLength = Number(contentLengthHeader);

  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_ACCOUNT_AVATAR_REQUEST_BYTES
  ) {
    return null;
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return null;
  }

  const keys = [...form.keys()];

  if (
    keys.length !== 1 ||
    keys[0] !== "image" ||
    form.getAll("image").length !== 1
  ) {
    return null;
  }

  const image = form.get("image");

  return image instanceof File
    ? image
    : null;
}
