import "server-only";

import path from "node:path";
import process from "node:process";

export const EDITORIAL_MEDIA_PUBLIC_PREFIX =
  "/media/editorial";

const slugPattern =
  /^[a-z0-9][a-z0-9._-]{0,159}$/;
const filenamePattern =
  /^[a-f0-9]{64}\.webp$/;
const publicPathPattern =
  /^\/media\/editorial\/([a-z0-9][a-z0-9._-]{0,159})\/([a-f0-9]{64}\.webp)$/;

function isContainedBy(
  parent: string,
  candidate: string
) {
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

export function isEditorialMediaSlug(
  value: string
) {
  return slugPattern.test(value);
}

export function isEditorialMediaFilename(
  value: string
) {
  return filenamePattern.test(value);
}

export function getEditorialMediaRoot() {
  const configured =
    process.env.DEUNA_EDITORIAL_MEDIA_ROOT?.trim();

  if (!configured) {
    throw new Error(
      "Falta configurar DEUNA_EDITORIAL_MEDIA_ROOT."
    );
  }

  if (!path.isAbsolute(configured)) {
    throw new Error(
      "DEUNA_EDITORIAL_MEDIA_ROOT debe ser una ruta absoluta."
    );
  }

  const root = path.resolve(configured);
  const filesystemRoot = path.parse(root).root;
  const applicationRoot = path.resolve(process.cwd());

  if (root === filesystemRoot) {
    throw new Error(
      "DEUNA_EDITORIAL_MEDIA_ROOT no puede ser la raíz del sistema de archivos."
    );
  }

  if (isContainedBy(applicationRoot, root)) {
    throw new Error(
      "DEUNA_EDITORIAL_MEDIA_ROOT debe quedar fuera del directorio desplegado de la aplicación."
    );
  }

  return root;
}

export function buildEditorialMediaPublicPath(
  slug: string,
  filename: string
) {
  if (
    !isEditorialMediaSlug(slug) ||
    !isEditorialMediaFilename(filename)
  ) {
    throw new Error(
      "Identidad multimedia no válida."
    );
  }

  return `${EDITORIAL_MEDIA_PUBLIC_PREFIX}/${slug}/${filename}`;
}

export function parseEditorialMediaPublicPath(
  publicPath: string
) {
  const match = publicPath.match(publicPathPattern);

  if (!match) return null;

  return {
    slug: match[1]!,
    filename: match[2]!,
  };
}

export function resolveEditorialMediaDiskPath(
  publicPath: string
) {
  const parsed =
    parseEditorialMediaPublicPath(publicPath);

  if (!parsed) return null;

  const root = getEditorialMediaRoot();
  const gameDirectory = path.join(
    root,
    parsed.slug
  );
  const filePath = path.join(
    gameDirectory,
    parsed.filename
  );

  if (!isContainedBy(root, filePath)) {
    return null;
  }

  return {
    ...parsed,
    root,
    gameDirectory,
    filePath,
  };
}
