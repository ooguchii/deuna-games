import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");

const removableChunks = new Set([
  "EXIF",
  "XMP ",
]);

const metadataFlagMask =
  0x08 | // EXIF
  0x04; // XMP

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, {
    withFileTypes: true,
  });

  return entries.flatMap((entry) => {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    return entry.isFile()
      ? [fullPath]
      : [];
  });
}

function validateWebpHeader(
  input,
  filePath
) {
  if (
    input.length < 12 ||
    input.toString("ascii", 0, 4) !== "RIFF" ||
    input.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return false;
  }

  const declaredRiffSize =
    input.readUInt32LE(4) + 8;

  if (
    declaredRiffSize !==
    input.length
  ) {
    throw new Error(
      `Tamaño RIFF inconsistente en ${filePath}: declarado ${declaredRiffSize}, real ${input.length}`
    );
  }

  return true;
}

function stripWebpMetadata(filePath) {
  const input = fs.readFileSync(filePath);

  if (
    !validateWebpHeader(
      input,
      filePath
    )
  ) {
    return {
      changed: false,
      reason: "no es WEBP RIFF válido",
    };
  }

  const chunks = [];
  const removedTypes = new Set();
  let normalizedFlags = 0;
  let offset = 12;

  while (offset < input.length) {
    if (
      offset + 8 > input.length
    ) {
      throw new Error(
        `Cabecera de chunk WEBP truncada en ${filePath}`
      );
    }

    const fourCC =
      input.toString(
        "ascii",
        offset,
        offset + 4
      );

    const size =
      input.readUInt32LE(
        offset + 4
      );

    const paddedSize =
      size + (size % 2);

    const chunkEnd =
      offset + 8 + paddedSize;

    if (chunkEnd > input.length) {
      throw new Error(
        `Chunk WEBP inválido en ${filePath}: ${fourCC}`
      );
    }

    if (
      removableChunks.has(
        fourCC
      )
    ) {
      removedTypes.add(fourCC);
    } else {
      const data = Buffer.from(
        input.subarray(
          offset,
          chunkEnd
        )
      );

      if (
        fourCC === "VP8X" &&
        data.length >= 9
      ) {
        const previousFlags =
          data[8];

        data[8] &=
          ~metadataFlagMask;

        if (
          data[8] !==
          previousFlags
        ) {
          normalizedFlags += 1;
        }
      }

      chunks.push({
        fourCC,
        data,
      });
    }

    offset = chunkEnd;
  }

  if (
    removedTypes.size === 0 &&
    normalizedFlags === 0
  ) {
    return {
      changed: false,
      reason: "sin EXIF/XMP ni flags residuales",
    };
  }

  const body = Buffer.concat(
    chunks.map(
      (chunk) =>
        chunk.data
    )
  );

  const output = Buffer.alloc(
    12 + body.length
  );

  output.write(
    "RIFF",
    0,
    "ascii"
  );
  output.writeUInt32LE(
    output.length - 8,
    4
  );
  output.write(
    "WEBP",
    8,
    "ascii"
  );

  body.copy(output, 12);

  // Verificación previa a escritura: nunca sustituimos el original
  // por un buffer cuyo RIFF no sea autoconsistente.
  validateWebpHeader(
    output,
    filePath
  );

  fs.writeFileSync(
    filePath,
    output
  );

  return {
    changed: true,
    removed:
      removedTypes.size,
    normalizedFlags,
  };
}

const webpFiles =
  walk(publicDir).filter(
    (filePath) =>
      path.extname(filePath)
        .toLowerCase() === ".webp"
  );

let changed = 0;

for (const filePath of webpFiles) {
  const result =
    stripWebpMetadata(filePath);

  const relative =
    path.relative(
      root,
      filePath
    );

  if (result.changed) {
    changed += 1;

    console.log(
      `[LIMPIO] ${relative} (${result.removed} tipo/s de metadata eliminado/s, ${result.normalizedFlags} VP8X normalizado/s)`
    );
  }
}

console.log("");
console.log(
  `WEBP revisados: ${webpFiles.length}`
);
console.log(
  `WEBP modificados: ${changed}`
);
console.log(
  "No se recomprimieron imágenes; sólo se eliminaron chunks EXIF/XMP y se normalizaron sus flags VP8X."
);
