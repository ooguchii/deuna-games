import "server-only";

import {
  lstat,
  readFile,
} from "node:fs/promises";
import { cache } from "react";

import {
  isSiteBrandLogoAsset,
  SITE_BRAND_LOGO_SLUG,
} from "@/lib/site/logo";

import {
  resolveEditorialMediaDiskPath,
} from "./editorial-media";
import {
  inspectSafeSiteBrandLogoSvg,
  MAX_TAXONOMY_SVG_ICON_BYTES,
  recolorSafeSiteBrandLogoSvg,
} from "./safe-svg-icon";

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

async function readStoredSiteBrandLogoUncached(
  publicPath: string
) {
  if (!isSiteBrandLogoAsset(publicPath)) {
    return null;
  }

  const resolved = resolveEditorialMediaDiskPath(publicPath);

  if (
    !resolved ||
    resolved.slug !== SITE_BRAND_LOGO_SLUG
  ) {
    return null;
  }

  try {
    const stats = await lstat(
      /* turbopackIgnore: true */ resolved.filePath
    );

    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size > MAX_TAXONOMY_SVG_ICON_BYTES
    ) {
      return null;
    }

    const content = await readFile(
      /* turbopackIgnore: true */ resolved.filePath
    );
    const inspection = inspectSafeSiteBrandLogoSvg(content);
    const expectedDigest = resolved.filename.slice(
      0,
      -".svg".length
    );

    if (
      !inspection ||
      inspection.digest !== expectedDigest
    ) {
      return null;
    }

    return {
      publicPath,
      content,
      digest: inspection.digest,
      bytes: inspection.bytes,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

export const readStoredSiteBrandLogo = cache(
  readStoredSiteBrandLogoUncached
);

export async function buildSiteBrandLogoDataUri(
  publicPath: string,
  color: string
) {
  const stored = await readStoredSiteBrandLogo(publicPath);

  if (!stored) return null;

  const recolored = recolorSafeSiteBrandLogoSvg(
    stored.content,
    color
  );

  if (!recolored) return null;

  return `data:image/svg+xml;base64,${recolored.toString("base64")}`;
}
