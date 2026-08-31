import "server-only";

import type { NextRequest } from "next/server";

import { siteUrl } from "@/lib/site";

const MAX_ACCOUNT_FORM_BYTES = 16 * 1024;

function headerMatchesSiteOrigin(value: string | null) {
  if (!value) return false;

  try {
    return new URL(value).origin === siteUrl;
  } catch {
    return false;
  }
}

export function hasTrustedAccountOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    return false;
  }

  if (origin && origin !== "null") {
    return origin === siteUrl;
  }

  if (referer) {
    return headerMatchesSiteOrigin(referer);
  }

  return fetchSite === "same-origin" || fetchSite === "none";
}

export async function readTrustedAccountForm(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : null;

  if (!hasTrustedAccountOrigin(request)) {
    return null;
  }

  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    return null;
  }

  if (
    contentLength !== null &&
    (
      !Number.isFinite(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_ACCOUNT_FORM_BYTES
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

  if (Buffer.byteLength(body, "utf8") > MAX_ACCOUNT_FORM_BYTES) {
    return null;
  }

  return new URLSearchParams(body);
}

export function hasExactAccountFormFields(
  form: URLSearchParams,
  fields: readonly string[]
) {
  const allowed = new Set(fields);

  return (
    form.size === fields.length &&
    fields.every((field) => form.getAll(field).length === 1) &&
    [...form.keys()].every((field) => allowed.has(field))
  );
}
