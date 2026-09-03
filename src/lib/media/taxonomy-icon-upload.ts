import "server-only";

import {
  lstat,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  buildEditorialMediaPublicPath,
  getEditorialMediaRoot,
} from "./editorial-media";
import {
  inspectSafeTaxonomySvgIcon,
  sanitizeTaxonomySvgIcon,
} from "./safe-svg-icon";
import {
  inspectSafeEditorialWebp,
  sanitizeEditorialWebp,
} from "./safe-webp";

const TAXONOMY_ICON_SLUG = "taxonomy-icons";
const MAX_TAXONOMY_WEBP_DIMENSION = 2_048;

export type TaxonomyIconUploadResult = {
  publicPath: string;
  digest: string;
  bytes: number;
  format: "svg" | "webp";
  reused: boolean;
};

async function assertWritableDirectory(
  directory: string,
  mode: number
) {
  await mkdir(directory, {
    recursive: true,
    mode,
  });

  const stats = await lstat(directory);

  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink()
  ) {
    throw new Error(
      "El almacén de iconos no es un directorio seguro."
    );
  }
}

function isAlreadyExistsError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}

function inspectStoredIcon(
  format: "svg" | "webp",
  buffer: Buffer
) {
  if (format === "svg") {
    return inspectSafeTaxonomySvgIcon(buffer);
  }

  const inspection = inspectSafeEditorialWebp(buffer);

  return inspection?.hasAlpha
    ? inspection
    : null;
}

async function writeHashedIcon(
  format: "svg" | "webp",
  buffer: Buffer,
  digest: string
) {
  const filename = `${digest}.${format}`;
  const root = getEditorialMediaRoot();
  const iconDirectory = path.join(
    root,
    TAXONOMY_ICON_SLUG
  );
  const filePath = path.join(
    iconDirectory,
    filename
  );

  await assertWritableDirectory(root, 0o750);
  await assertWritableDirectory(
    iconDirectory,
    0o750
  );

  let reused = false;

  try {
    await writeFile(filePath, buffer, {
      flag: "wx",
      mode: 0o640,
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }

    const stats = await lstat(filePath);

    if (
      !stats.isFile() ||
      stats.isSymbolicLink()
    ) {
      throw new Error(
        "La ruta existente del icono no es un archivo seguro."
      );
    }

    const existing = await readFile(filePath);
    const inspection = inspectStoredIcon(
      format,
      existing
    );

    if (
      !inspection ||
      inspection.digest !== digest
    ) {
      throw new Error(
        "El icono existente no coincide con su hash."
      );
    }

    reused = true;
  }

  return {
    publicPath: buildEditorialMediaPublicPath(
      TAXONOMY_ICON_SLUG,
      filename
    ),
    reused,
  };
}

export async function storeTaxonomyIcon(
  file: File
): Promise<TaxonomyIconUploadResult> {
  const type = file.type.toLowerCase();
  const input = Buffer.from(
    await file.arrayBuffer()
  );

  if (type === "image/svg+xml") {
    const buffer = sanitizeTaxonomySvgIcon(input);
    const inspection = buffer
      ? inspectSafeTaxonomySvgIcon(buffer)
      : null;

    if (!buffer || !inspection) {
      throw new Error(
        "El SVG contiene estructura o atributos que no son seguros para un icono."
      );
    }

    const stored = await writeHashedIcon(
      "svg",
      buffer,
      inspection.digest
    );

    return {
      ...stored,
      digest: inspection.digest,
      bytes: inspection.bytes,
      format: "svg",
    };
  }

  if (type === "image/webp") {
    const buffer = sanitizeEditorialWebp(input);
    const inspection = buffer
      ? inspectSafeEditorialWebp(buffer)
      : null;

    if (
      !buffer ||
      !inspection ||
      !inspection.hasAlpha ||
      inspection.width > MAX_TAXONOMY_WEBP_DIMENSION ||
      inspection.height > MAX_TAXONOMY_WEBP_DIMENSION
    ) {
      throw new Error(
        "El WebP debe ser estático, seguro, tener transparencia y no superar 2048 px."
      );
    }

    const stored = await writeHashedIcon(
      "webp",
      buffer,
      inspection.digest
    );

    return {
      ...stored,
      digest: inspection.digest,
      bytes: inspection.bytes,
      format: "webp",
    };
  }

  throw new Error(
    "El icono debe estar en formato SVG o WebP."
  );
}
