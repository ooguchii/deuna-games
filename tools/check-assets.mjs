import {
  access,
  readFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicRoot = path.join(
  root,
  "public"
);
const imagesRoot = path.join(
  publicRoot,
  "images"
);
const sourceRoot = path.join(
  root,
  "src"
);

const imagePattern =
  /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const sourcePattern =
  /\.(?:css|js|jsx|json|mjs|scss|ts|tsx)$/i;
const publicImageReferencePattern =
  /["'`]((?:\/images\/)[^"'`\s)]+?\.(?:avif|gif|jpe?g|png|svg|webp))["'`)]/gi;

async function walk(directory) {
  const entries = await readdir(
    directory,
    {
      withFileTypes: true,
    }
  );

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      files.push(
        ...(await walk(fullPath))
      );
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPosix(value) {
  return value
    .split(path.sep)
    .join("/");
}

function publicPathFor(file) {
  return (
    "/" +
    toPosix(
      path.relative(
        publicRoot,
        file
      )
    )
  );
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateWebp(
  buffer,
  fileName
) {
  if (
    buffer.length < 12 ||
    buffer.toString(
      "ascii",
      0,
      4
    ) !== "RIFF" ||
    buffer.toString(
      "ascii",
      8,
      12
    ) !== "WEBP"
  ) {
    return `${fileName}: cabecera WEBP RIFF inválida`;
  }

  const declaredSize =
    buffer.readUInt32LE(4) + 8;

  if (
    declaredSize !==
    buffer.length
  ) {
    return `${fileName}: tamaño RIFF declarado (${declaredSize}) distinto del real (${buffer.length})`;
  }

  let offset = 12;
  let vp8xFlags = null;
  let hasExif = false;
  let hasXmp = false;

  while (offset < buffer.length) {
    if (
      offset + 8 >
      buffer.length
    ) {
      return `${fileName}: cabecera de chunk WEBP truncada`;
    }

    const fourCC =
      buffer.toString(
        "ascii",
        offset,
        offset + 4
      );
    const size =
      buffer.readUInt32LE(
        offset + 4
      );
    const paddedSize =
      size + (size % 2);
    const chunkEnd =
      offset + 8 + paddedSize;

    if (
      chunkEnd >
      buffer.length
    ) {
      return `${fileName}: chunk ${fourCC} excede el final del archivo`;
    }

    if (fourCC === "VP8X") {
      if (size !== 10) {
        return `${fileName}: chunk VP8X debe tener 10 bytes de payload`;
      }

      vp8xFlags =
        buffer[offset + 8];
    } else if (
      fourCC === "EXIF"
    ) {
      hasExif = true;
    } else if (
      fourCC === "XMP "
    ) {
      hasXmp = true;
    }

    offset = chunkEnd;
  }

  if (vp8xFlags !== null) {
    const exifFlag =
      (vp8xFlags & 0x08) !== 0;
    const xmpFlag =
      (vp8xFlags & 0x04) !== 0;

    if (exifFlag !== hasExif) {
      return `${fileName}: flag EXIF de VP8X no coincide con los chunks presentes`;
    }

    if (xmpFlag !== hasXmp) {
      return `${fileName}: flag XMP de VP8X no coincide con los chunks presentes`;
    }
  } else if (
    hasExif || hasXmp
  ) {
    return `${fileName}: contiene EXIF/XMP sin chunk VP8X`;
  }

  if (hasExif || hasXmp) {
    return `${fileName}: contiene metadata EXIF/XMP; eliminála antes de publicar`;
  }

  return null;
}

function validatePng(
  buffer,
  fileName
) {
  const signature =
    Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);

  if (
    buffer.length < 8 ||
    !buffer
      .subarray(0, 8)
      .equals(signature)
  ) {
    return `${fileName}: firma PNG inválida`;
  }

  const forbiddenChunks =
    new Set([
      "eXIf",
      "tEXt",
      "zTXt",
      "iTXt",
      "tIME",
    ]);

  let offset = 8;

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) {
      return `${fileName}: chunk PNG truncado`;
    }

    const size =
      buffer.readUInt32BE(offset);
    const type =
      buffer.toString(
        "ascii",
        offset + 4,
        offset + 8
      );
    const chunkEnd =
      offset + 12 + size;

    if (chunkEnd > buffer.length) {
      return `${fileName}: chunk PNG ${type} excede el final del archivo`;
    }

    if (forbiddenChunks.has(type)) {
      return `${fileName}: contiene metadata PNG ${type}; eliminála antes de publicar`;
    }

    offset = chunkEnd;

    if (type === "IEND") {
      break;
    }
  }

  return null;
}

function validateJpeg(
  buffer,
  fileName
) {
  if (
    buffer.length < 4 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer[
      buffer.length - 2
    ] !== 0xff ||
    buffer[
      buffer.length - 1
    ] !== 0xd9
  ) {
    return `${fileName}: marcadores JPEG inválidos`;
  }

  let offset = 2;

  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (
      offset < buffer.length &&
      buffer[offset] === 0xff
    ) {
      offset += 1;
    }

    if (offset >= buffer.length) {
      break;
    }

    const marker = buffer[offset];
    offset += 1;

    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (marker === 0xda) {
      break;
    }

    if (offset + 2 > buffer.length) {
      return `${fileName}: segmento JPEG truncado`;
    }

    const segmentLength =
      buffer.readUInt16BE(offset);

    if (
      segmentLength < 2 ||
      offset + segmentLength > buffer.length
    ) {
      return `${fileName}: longitud de segmento JPEG inválida`;
    }

    if (
      marker === 0xe1 ||
      marker === 0xed ||
      marker === 0xfe
    ) {
      const label =
        marker === 0xe1
          ? "APP1 (EXIF/XMP)"
          : marker === 0xed
            ? "APP13 (IPTC/Photoshop)"
            : "COM (comentario)";

      return `${fileName}: contiene metadata JPEG ${label}; eliminála antes de publicar`;
    }

    offset += segmentLength;
  }

  return null;
}

function validateGif(
  buffer,
  fileName
) {
  const signature =
    buffer.toString(
      "ascii",
      0,
      6
    );

  if (
    signature !== "GIF87a" &&
    signature !== "GIF89a"
  ) {
    return `${fileName}: firma GIF inválida`;
  }

  for (
    let index = 6;
    index + 1 < buffer.length;
    index += 1
  ) {
    if (
      buffer[index] === 0x21 &&
      buffer[index + 1] === 0xfe
    ) {
      return `${fileName}: contiene bloque de comentario GIF; eliminá metadata antes de publicar`;
    }
  }

  return null;
}

function validateAvif(
  buffer,
  fileName
) {
  if (
    buffer.length < 16 ||
    buffer.toString(
      "ascii",
      4,
      8
    ) !== "ftyp"
  ) {
    return `${fileName}: caja ftyp AVIF inválida`;
  }

  const brands =
    buffer.toString(
      "ascii",
      8,
      Math.min(
        buffer.length,
        32
      )
    );

  if (
    !brands.includes("avif") &&
    !brands.includes("avis")
  ) {
    return `${fileName}: marca AVIF no encontrada`;
  }

  const ascii =
    buffer.toString("latin1");

  if (
    ascii.includes("Exif") ||
    /<x:xmpmeta\b/i.test(ascii) ||
    /<rdf:RDF\b/i.test(ascii)
  ) {
    return `${fileName}: contiene metadata EXIF/XMP embebida; eliminála antes de publicar`;
  }

  return null;
}

function validateSvg(
  buffer,
  fileName
) {
  const text =
    buffer.toString("utf8");

  if (!/<svg\b/i.test(text)) {
    return `${fileName}: elemento <svg> no encontrado`;
  }

  if (
    /<metadata\b/i.test(text) ||
    /\b(?:inkscape|sodipodi):/i.test(text) ||
    /<rdf:RDF\b/i.test(text)
  ) {
    return `${fileName}: contiene metadata/editor SVG; limpiála antes de publicar`;
  }

  return null;
}

function validateImageBuffer(
  buffer,
  extension,
  fileName
) {
  if (buffer.length === 0) {
    return `${fileName}: archivo vacío`;
  }

  if (extension === ".webp") {
    return validateWebp(
      buffer,
      fileName
    );
  }

  if (extension === ".png") {
    return validatePng(
      buffer,
      fileName
    );
  }

  if (
    extension === ".jpg" ||
    extension === ".jpeg"
  ) {
    return validateJpeg(
      buffer,
      fileName
    );
  }

  if (extension === ".gif") {
    return validateGif(
      buffer,
      fileName
    );
  }

  if (extension === ".avif") {
    return validateAvif(
      buffer,
      fileName
    );
  }

  if (extension === ".svg") {
    return validateSvg(
      buffer,
      fileName
    );
  }

  return null;
}

const [
  assetFiles,
  sourceFiles,
] = await Promise.all([
  walk(imagesRoot),
  walk(sourceRoot),
]);

const unexpectedFiles =
  assetFiles.filter(
    (file) =>
      !imagePattern.test(file)
  );

const imageFiles =
  assetFiles.filter(
    (file) =>
      imagePattern.test(file)
  );

const actualAssets =
  imageFiles
    .map(publicPathFor)
    .sort();

const actualAssetSet =
  new Set(actualAssets);

const textFiles =
  sourceFiles.filter(
    (file) =>
      sourcePattern.test(file)
  );

const referencedAssets =
  new Set();

for (const file of textFiles) {
  const content = await readFile(
    file,
    "utf8"
  );

  for (const match of content.matchAll(
    publicImageReferencePattern
  )) {
    referencedAssets.add(
      match[1]
    );
  }
}

const sortedReferences = [
  ...referencedAssets,
].sort();

const missingAssets = [];

for (const publicPath of sortedReferences) {
  const diskPath = path.join(
    publicRoot,
    publicPath.replace(
      /^\//,
      ""
    )
  );

  if (
    !actualAssetSet.has(
      publicPath
    ) ||
    !(await fileExists(diskPath))
  ) {
    missingAssets.push(
      publicPath
    );
  }
}

const orphanedAssets =
  actualAssets.filter(
    (publicPath) =>
      !referencedAssets.has(
        publicPath
      )
  );

const invalidAssets = [];

for (const file of imageFiles) {
  const buffer = await readFile(file);
  const extension =
    path.extname(file).toLowerCase();
  const error =
    validateImageBuffer(
      buffer,
      extension,
      publicPathFor(file)
    );

  if (error) {
    invalidAssets.push(error);
  }
}

let failed = false;

if (unexpectedFiles.length > 0) {
  failed = true;
  console.error(
    "\nArchivos no-imagen encontrados dentro de public/images/:\n"
  );

  for (const file of unexpectedFiles) {
    console.error(
      `- ${publicPathFor(file)}`
    );
  }
}

if (missingAssets.length > 0) {
  failed = true;
  console.error(
    "\nReferencias a imágenes que no existen en public/:\n"
  );

  for (const asset of missingAssets) {
    console.error(`- ${asset}`);
  }
}

if (orphanedAssets.length > 0) {
  failed = true;
  console.error(
    "\nImágenes públicas sin referencia directa en src/:\n"
  );

  for (const asset of orphanedAssets) {
    console.error(`- ${asset}`);
  }
}

if (invalidAssets.length > 0) {
  failed = true;
  console.error(
    "\nImágenes con estructura, firma o metadata pública no permitida:\n"
  );

  for (const error of invalidAssets) {
    console.error(`- ${error}`);
  }
}

if (failed) {
  console.error(
    "\nCorregí referencias, archivos obsoletos, metadata o binarios inválidos antes de integrar el cambio.\n"
  );
  process.exit(1);
}

console.log(
  `Assets: OK (${actualAssets.length} archivos, ${sortedReferences.length} referencias, estructura binaria y ausencia de metadata sensible verificadas).`
);
