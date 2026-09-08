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
  inspectSafeSiteBrandLogoRaster,
  siteBrandRasterContentType,
  type SiteBrandRasterFormat,
} from "./safe-site-logo-raster";
import {
  inspectPrivacySafeSiteBrandLogoSvg,
} from "./safe-site-logo-svg";
import {
  MAX_TAXONOMY_SVG_ICON_BYTES,
  recolorSafeSiteBrandLogoSvg,
} from "./safe-svg-icon";
import {
  MAX_EDITORIAL_IMAGE_BYTES,
} from "./safe-webp";

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function storedLogoFormat(filename: string) {
  const match = filename.match(
    /\.(svg|png|jpg|webp|gif)$/
  );

  return match?.[1] as
    | "svg"
    | SiteBrandRasterFormat
    | undefined;
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

  const format = storedLogoFormat(resolved.filename);
  if (!format) return null;

  try {
    const stats = await lstat(
      /* turbopackIgnore: true */ resolved.filePath
    );
    const maximumBytes = format === "svg"
      ? MAX_TAXONOMY_SVG_ICON_BYTES
      : MAX_EDITORIAL_IMAGE_BYTES;

    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size > maximumBytes
    ) {
      return null;
    }

    const content = await readFile(
      /* turbopackIgnore: true */ resolved.filePath
    );
    const expectedDigest = resolved.filename.slice(
      0,
      -(format.length + 1)
    );

    if (format === "svg") {
      const inspection =
        inspectPrivacySafeSiteBrandLogoSvg(content);

      if (
        !inspection ||
        inspection.digest !== expectedDigest
      ) {
        return null;
      }

      return {
        publicPath,
        content,
        format: "svg" as const,
        digest: inspection.digest,
        bytes: inspection.bytes,
        width: null,
        height: null,
      };
    }

    const inspection = inspectSafeSiteBrandLogoRaster(
      content,
      format
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
      format,
      digest: inspection.digest,
      bytes: inspection.bytes,
      width: inspection.width,
      height: inspection.height,
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

function rasterColorizedSvgDataUri(
  stored: Extract<
    NonNullable<
      Awaited<ReturnType<typeof readStoredSiteBrandLogoUncached>>
    >,
    { format: SiteBrandRasterFormat }
  >,
  color: string
) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return null;
  }

  const contentType = siteBrandRasterContentType(
    stored.format
  );
  const rasterDataUri =
    `data:${contentType};base64,${stored.content.toString("base64")}`;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` viewBox="0 0 ${stored.width} ${stored.height}">`,
    '<defs><mask id="logo-mask" maskUnits="userSpaceOnUse"',
    ` x="0" y="0" width="${stored.width}" height="${stored.height}" mask-type="alpha">`,
    `<image href="${rasterDataUri}" width="${stored.width}" height="${stored.height}" preserveAspectRatio="xMidYMid meet"/>`,
    '</mask></defs>',
    `<rect width="${stored.width}" height="${stored.height}" fill="${color}" mask="url(#logo-mask)"/>`,
    '</svg>',
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export async function buildSiteBrandLogoDataUri(
  publicPath: string,
  color?: string | null
) {
  const stored = await readStoredSiteBrandLogo(publicPath);

  if (!stored) return null;

  if (stored.format === "svg") {
    const rendered = color
      ? recolorSafeSiteBrandLogoSvg(
          stored.content,
          color
        )
      : stored.content;

    if (!rendered) return null;

    return `data:image/svg+xml;base64,${rendered.toString("base64")}`;
  }

  if (color) {
    return rasterColorizedSvgDataUri(
      stored,
      color
    );
  }

  return `data:${siteBrandRasterContentType(stored.format)};base64,${stored.content.toString("base64")}`;
}
