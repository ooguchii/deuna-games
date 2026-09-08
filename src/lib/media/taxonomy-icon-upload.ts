import "server-only";

import {
  lstat,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import {
  SITE_BRAND_LOGO_SLUG,
} from "@/lib/site/logo";

import {
  buildEditorialMediaPublicPath,
  resolveEditorialMediaDiskPath,
} from "./editorial-media";
import {
  inspectSafeSiteBrandLogoSvg,
  inspectSafeTaxonomySvgIcon,
  sanitizeTaxonomySvgIcon,
  sanitizeSiteBrandLogoSvg,
} from "./safe-svg-icon";
import {
  inspectSafeEditorialWebp,
  sanitizeEditorialWebp,
} from "./safe-webp";

const TAXONOMY_ICON_SLUG = "taxonomy-icons";
const MAX_TAXONOMY_WEBP_DIMENSION = 2_048;

type IconStorageSlug =
  | typeof TAXONOMY_ICON_SLUG
  | typeof SITE_BRAND_LOGO_SLUG;

export type TaxonomyIconUploadResult = {
  publicPath: string;
  digest: string;
  bytes: number;
  format: "svg" | "webp";
  reused: boolean;
};

export type SiteBrandLogoUploadResult = {
  publicPath: string;
  digest: string;
  bytes: number;
  format: "svg";
  reused: boolean;
};

async function assertWritableDirectory(
  directory: string,
  mode: number
) {
  await mkdir(
    /* turbopackIgnore: true */ directory,
    {
      recursive: true,
      mode,
    }
  );

  const stats = await lstat(
    /* turbopackIgnore: true */ directory
  );

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
  slug: IconStorageSlug,
  format: "svg" | "webp",
  buffer: Buffer
) {
  if (format === "svg") {
    return slug === SITE_BRAND_LOGO_SLUG
      ? inspectSafeSiteBrandLogoSvg(buffer)
      : inspectSafeTaxonomySvgIcon(buffer);
  }

  const inspection = inspectSafeEditorialWebp(buffer);

  return inspection?.hasAlpha
    ? inspection
    : null;
}

async function writeHashedIcon(
  slug: IconStorageSlug,
  format: "svg" | "webp",
  buffer: Buffer,
  digest: string
) {
  const filename = `${digest}.${format}`;
  const publicPath = buildEditorialMediaPublicPath(
    slug,
    filename
  );
  const resolved = resolveEditorialMediaDiskPath(
    publicPath
  );

  if (!resolved) {
    throw new Error(
      "No se pudo resolver una ruta segura para el icono editorial."
    );
  }

  const {
    root,
    gameDirectory: iconDirectory,
    filePath,
  } = resolved;

  await assertWritableDirectory(root, 0o750);
  await assertWritableDirectory(
    iconDirectory,
    0o750
  );

  let reused = false;

  try {
    await writeFile(
      /* turbopackIgnore: true */ filePath,
      buffer,
      {
        flag: "wx",
        mode: 0o640,
      }
    );
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }

    const stats = await lstat(
      /* turbopackIgnore: true */ filePath
    );

    if (
      !stats.isFile() ||
      stats.isSymbolicLink()
    ) {
      throw new Error(
        "La ruta existente del icono no es un archivo seguro."
      );
    }

    const existing = await readFile(
      /* turbopackIgnore: true */ filePath
    );
    const inspection = inspectStoredIcon(
      slug,
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
    publicPath,
    reused,
  };
}

async function storeSafeSvgIcon(
  file: File,
  slug: IconStorageSlug
): Promise<SiteBrandLogoUploadResult> {
  if (
    slug !== SITE_BRAND_LOGO_SLUG &&
    file.type.toLowerCase() !== "image/svg+xml"
  ) {
    throw new Error(
      "El símbolo debe estar en formato SVG."
    );
  }

  const input = Buffer.from(
    await file.arrayBuffer()
  );
  const buffer = slug === SITE_BRAND_LOGO_SLUG
    ? sanitizeSiteBrandLogoSvg(input)
    : sanitizeTaxonomySvgIcon(input);
  const inspection = buffer
    ? slug === SITE_BRAND_LOGO_SLUG
      ? inspectSafeSiteBrandLogoSvg(buffer)
      : inspectSafeTaxonomySvgIcon(buffer)
    : null;

  if (!buffer || !inspection) {
    throw new Error(
      slug === SITE_BRAND_LOGO_SLUG
        ? "El logo debe ser un SVG estático, seguro y escalable con viewBox."
        : "El SVG contiene estructura o atributos que no son seguros para un icono."
    );
  }

  const stored = await writeHashedIcon(
    slug,
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

export function storeSiteBrandLogo(
  file: File
) {
  // Para identidad, el contenido saneado es la autoridad. Algunos navegadores
  // o sistemas entregan SVG válidos con MIME vacío, XML u octet-stream.
  return storeSafeSvgIcon(
    file,
    SITE_BRAND_LOGO_SLUG
  );
}

export async function storeTaxonomyIcon(
  file: File
): Promise<TaxonomyIconUploadResult> {
  const type = file.type.toLowerCase();

  if (type === "image/svg+xml") {
    return storeSafeSvgIcon(
      file,
      TAXONOMY_ICON_SLUG
    );
  }

  if (type === "image/webp") {
    const input = Buffer.from(
      await file.arrayBuffer()
    );
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
      TAXONOMY_ICON_SLUG,
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
