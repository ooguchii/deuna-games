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
  origin: "editorial" | "bundled";
  src: string;
  digest: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
};

export type EditorialMediaLibraryVideo = {
  kind: "video";
  origin: "editorial";
  src: string;
  digest: string;
  bytes: number;
};

export type EditorialMediaLibraryResource =
  | EditorialMediaLibraryImage
  | EditorialMediaLibraryVideo;

const MEDIA_FILENAME = /^([a-f0-9]{64})\.(webp|webm)$/;
const BUNDLED_IMAGE_PATTERN =
  /^\/images\/[A-Za-z0-9/_.,@+() -]+\.(?:avif|gif|jpe?g|png|webp)$/i;
const MAX_LIBRARY_RESOURCES = 80;
const MAX_CACHED_INSPECTIONS = 320;

type CachedInspection = {
  signature: string;
  resource: EditorialMediaLibraryResource | null;
};

// Los archivos son inmutables y direccionados por SHA-256. Se sigue haciendo
// lstat en cada listado, pero sólo se releen y vuelven a hashear si cambia su
// identidad física. Así abrir Multimedia no lee hasta cientos de MB en cada GET.
const inspectionCache = new Map<string, CachedInspection>();

function fileSignature(stats: Awaited<ReturnType<typeof lstat>>) {
  return [
    stats.dev,
    stats.ino,
    stats.size,
    stats.mtimeMs,
    stats.ctimeMs,
  ].join(":");
}

function rememberInspection(
  filePath: string,
  inspection: CachedInspection
) {
  inspectionCache.delete(filePath);
  inspectionCache.set(filePath, inspection);

  while (inspectionCache.size > MAX_CACHED_INSPECTIONS) {
    const oldest = inspectionCache.keys().next().value;
    if (typeof oldest !== "string") break;
    inspectionCache.delete(oldest);
  }
}

function isMissingDirectory(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function isContainedBy(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function resolveBundledImagePath(publicPath: string) {
  if (
    !BUNDLED_IMAGE_PATTERN.test(publicPath) ||
    publicPath.includes("\\") ||
    publicPath.includes("//") ||
    publicPath
      .split("/")
      .some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }

  const publicRoot = path.resolve(process.cwd(), "public");
  const imagesRoot = path.resolve(publicRoot, "images");
  const filePath = path.resolve(publicRoot, `.${publicPath}`);

  return isContainedBy(imagesRoot, filePath)
    ? filePath
    : null;
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

    const signature = fileSignature(stats);
    const cached = inspectionCache.get(filePath);

    if (cached?.signature === signature) {
      if (cached.resource) resources.push(cached.resource);
      continue;
    }

    const buffer = await readFile(filePath);
    const publicPath = buildEditorialMediaPublicPath(slug, entry.name);
    let resource: EditorialMediaLibraryResource | null = null;

    if (match[2] === "webp") {
      const inspection = inspectSafeEditorialWebp(buffer);
      if (inspection?.digest === match[1]) {
        resource = {
          kind: "image",
          origin: "editorial",
          src: publicPath,
          digest: inspection.digest,
          bytes: inspection.bytes,
          width: inspection.width,
          height: inspection.height,
        };
      }
    } else {
      const inspection = inspectSafeEditorialWebm(buffer);
      if (inspection?.digest === match[1]) {
        resource = {
          kind: "video",
          origin: "editorial",
          src: publicPath,
          digest: inspection.digest,
          bytes: inspection.bytes,
        };
      }
    }

    rememberInspection(filePath, { signature, resource });
    if (resource) resources.push(resource);
  }

  return resources;
}

export async function listAssignedBundledImageResources(
  mediaPaths: readonly (string | null | undefined)[]
): Promise<EditorialMediaLibraryImage[]> {
  const resources: EditorialMediaLibraryImage[] = [];

  for (const publicPath of new Set(mediaPaths.filter(
    (value): value is string => Boolean(value)
  ))) {
    const filePath = resolveBundledImagePath(publicPath);
    if (!filePath) continue;

    try {
      const stats = await lstat(filePath);
      if (
        !stats.isFile() ||
        stats.isSymbolicLink() ||
        stats.size <= 0
      ) {
        continue;
      }

      resources.push({
        kind: "image",
        origin: "bundled",
        src: publicPath,
        digest: null,
        bytes: stats.size,
        width: null,
        height: null,
      });
    } catch {
      // Un asset histórico faltante no debe romper Multimedia: la publicación
      // conserva su propia validación de integridad y aquí simplemente no se
      // ofrece como recurso reutilizable.
    }
  }

  return resources;
}

export function mergeEditorialMediaResources(
  ...groups: readonly (readonly EditorialMediaLibraryResource[])[]
) {
  const resources = new Map<string, EditorialMediaLibraryResource>();

  for (const group of groups) {
    for (const resource of group) {
      if (!resources.has(resource.src)) {
        resources.set(resource.src, resource);
      }
    }
  }

  return [...resources.values()];
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
