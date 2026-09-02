import "server-only";

import {
  lstat,
  readFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";

import {
  buildEditorialMediaPublicPath,
  getEditorialMediaRoot,
  isEditorialMediaSlug,
} from "./editorial-media";
import {
  inspectSafeEditorialWebm,
  MAX_EDITORIAL_PREVIEW_BYTES,
} from "./safe-webm";
import {
  inspectSafeEditorialWebp,
  MAX_EDITORIAL_IMAGE_BYTES,
} from "./safe-webp";

export type EditorialMediaLibraryImage = {
  kind: "image";
  src: string;
  digest: string;
  bytes: number;
  width: number;
  height: number;
};

export type EditorialMediaLibraryVideo = {
  kind: "video";
  src: string;
  digest: string;
  bytes: number;
};

export type EditorialMediaLibraryResource =
  | EditorialMediaLibraryImage
  | EditorialMediaLibraryVideo;

const MEDIA_FILENAME = /^([a-f0-9]{64})\.(webp|webm)$/;
const MAX_LIBRARY_RESOURCES = 80;

function isMissingDirectory(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

export async function listEditorialMediaLibrary(
  slug: string
): Promise<EditorialMediaLibraryResource[]> {
  if (!isEditorialMediaSlug(slug)) {
    throw new Error("La identidad del juego no es válida para multimedia.");
  }

  const directory = path.join(getEditorialMediaRoot(), slug);
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingDirectory(error)) return [];
    throw error;
  }

  const candidates = entries
    .filter((entry) => entry.isFile() && MEDIA_FILENAME.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, MAX_LIBRARY_RESOURCES);
  const resources: EditorialMediaLibraryResource[] = [];

  for (const entry of candidates) {
    const match = MEDIA_FILENAME.exec(entry.name);
    if (!match) continue;

    const filePath = path.join(directory, entry.name);
    const stats = await lstat(filePath);
    const maximumBytes =
      match[2] === "webp"
        ? MAX_EDITORIAL_IMAGE_BYTES
        : MAX_EDITORIAL_PREVIEW_BYTES;
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size > maximumBytes
    ) {
      continue;
    }

    const buffer = await readFile(filePath);
    const publicPath = buildEditorialMediaPublicPath(slug, entry.name);

    if (match[2] === "webp") {
      const inspection = inspectSafeEditorialWebp(buffer);
      if (!inspection || inspection.digest !== match[1]) continue;
      resources.push({
        kind: "image",
        src: publicPath,
        digest: inspection.digest,
        bytes: inspection.bytes,
        width: inspection.width,
        height: inspection.height,
      });
      continue;
    }

    const inspection = inspectSafeEditorialWebm(buffer);
    if (!inspection || inspection.digest !== match[1]) continue;
    resources.push({
      kind: "video",
      src: publicPath,
      digest: inspection.digest,
      bytes: inspection.bytes,
    });
  }

  return resources;
}

export function findEditorialMediaResource(
  resources: readonly EditorialMediaLibraryResource[],
  src: string,
  kind?: EditorialMediaLibraryResource["kind"]
) {
  return resources.find(
    (resource) => resource.src === src && (!kind || resource.kind === kind)
  );
}
