import "server-only";

import type { NextRequest } from "next/server";

const MAX_ADMIN_FORM_BYTES = 8 * 1024;

export async function readTrustedAdminForm(
  request: NextRequest,
  adminOrigin: string
) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get(
    "sec-fetch-site"
  );
  const contentType =
    request.headers.get("content-type") ?? "";
  const contentLength = Number(
    request.headers.get("content-length") ?? "0"
  );

  if (
    !origin ||
    origin !== adminOrigin
  ) {
    return null;
  }

  if (
    fetchSite &&
    fetchSite !== "same-origin" &&
    fetchSite !== "none"
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
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > MAX_ADMIN_FORM_BYTES
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
