import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();

const files = {
  games: path.join(root, "src", "data", "games.ts"),
  updates: path.join(root, "src", "data", "updates.ts"),
  performance: path.join(
    root,
    "src",
    "features",
    "game-finder",
    "performance-data.ts"
  ),
  hardware: path.join(
    root,
    "src",
    "features",
    "game-finder",
    "hardware-catalog.ts"
  ),
};

const allowedUpdateTypes = new Set([
  "update",
  "content",
  "fix",
  "improvement",
]);

const slugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reviewsPattern =
  /^\d+(?:\.\d+)?[KM]?$/i;

function fail(errors) {
  console.error("\nIntegridad de datos: ERROR\n");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  console.error(
    "\nCorregí el catálogo, las actualizaciones o los datos del recomendador antes de integrar el cambio.\n"
  );

  process.exit(1);
}

function getPropertyName(node) {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }

  return null;
}

function literalValue(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(literalValue);
  }

  if (ts.isObjectLiteralExpression(node)) {
    const result = {};

    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        continue;
      }

      const name =
        getPropertyName(property.name);

      if (!name) {
        continue;
      }

      result[name] =
        literalValue(property.initializer);
    }

    return result;
  }

  return undefined;
}

function findArrayDeclaration(
  source,
  variableName,
  fileLabel
) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== variableName
      ) {
        continue;
      }

      if (
        !declaration.initializer ||
        !ts.isArrayLiteralExpression(declaration.initializer)
      ) {
        throw new Error(
          `${fileLabel}: ${variableName} debe declararse como un array literal.`
        );
      }

      return declaration.initializer.elements.map((element, index) => {
        if (!ts.isObjectLiteralExpression(element)) {
          throw new Error(
            `${fileLabel}: ${variableName}[${index}] debe ser un objeto literal.`
          );
        }

        return literalValue(element);
      });
    }
  }

  throw new Error(
    `${fileLabel}: no se encontró la declaración ${variableName}.`
  );
}

async function readArray(
  filePath,
  variableName
) {
  const content = await fs.readFile(
    filePath,
    "utf8"
  );

  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  return findArrayDeclaration(
    source,
    variableName,
    path.relative(root, filePath)
  );
}

function isNonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isPositiveNumber(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function isValidCalendarDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!match) {
    return false;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidPublishedAt(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(
      value
    )
  ) {
    return false;
  }

  return Number.isFinite(
    Date.parse(value)
  );
}

function validateDownload(
  game,
  errors
) {
  if (game.download === undefined) {
    return;
  }

  if (
    !game.download ||
    typeof game.download !== "object"
  ) {
    errors.push(
      `${game.slug}: download debe ser un objeto.`
    );
    return;
  }

  const href = game.download.href;

  if (!isNonEmptyString(href)) {
    errors.push(
      `${game.slug}: download.href debe ser un string no vacío.`
    );
    return;
  }

  const trimmed = href.trim();

  if (trimmed.startsWith("/")) {
    if (
      trimmed.startsWith("//") ||
      trimmed.includes("\\")
    ) {
      errors.push(
        `${game.slug}: download.href interno no puede usar // ni barras invertidas.`
      );
    }
  } else {
    try {
      const url = new URL(trimmed);

      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password
      ) {
        errors.push(
          `${game.slug}: download.href externo debe ser HTTPS y no contener credenciales.`
        );
      }
    } catch {
      errors.push(
        `${game.slug}: download.href no es una URL válida.`
      );
    }
  }

  if (
    game.download.label !== undefined &&
    !isNonEmptyString(game.download.label)
  ) {
    errors.push(
      `${game.slug}: download.label, si existe, debe ser un string no vacío.`
    );
  }
}

function validateRequirementObject(
  value,
  label,
  errors
) {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== "object") {
    errors.push(`${label} debe ser un objeto.`);
    return;
  }

  for (const [key, field] of Object.entries(value)) {
    if (
      key === "minimum" ||
      key === "recommended"
    ) {
      validateRequirementObject(
        field,
        `${label}.${key}`,
        errors
      );
      continue;
    }

    if (!isNonEmptyString(field)) {
      errors.push(
        `${label}.${key} debe ser un string no vacío.`
      );
    }
  }
}

function validateHardwareCatalog(
  entries,
  label,
  errors
) {
  const ids = new Set();

  for (const [index, item] of entries.entries()) {
    const itemLabel =
      isNonEmptyString(item.id)
        ? `${label}.${item.id}`
        : `${label}[${index}]`;

    if (!isNonEmptyString(item.id)) {
      errors.push(`${itemLabel}: id es obligatorio.`);
    } else if (ids.has(item.id)) {
      errors.push(`${itemLabel}: id duplicado.`);
    } else {
      ids.add(item.id);
    }

    if (!isNonEmptyString(item.name)) {
      errors.push(`${itemLabel}: name es obligatorio.`);
    }

    if (!isPositiveNumber(item.score)) {
      errors.push(`${itemLabel}: score debe ser un número positivo.`);
    }

    if (
      item.integrated !== undefined &&
      typeof item.integrated !== "boolean"
    ) {
      errors.push(`${itemLabel}: integrated debe ser booleano.`);
    }
  }
}

const [
  games,
  updates,
  performanceProfiles,
  cpuCatalog,
  gpuCatalog,
] = await Promise.all([
  readArray(files.games, "games"),
  readArray(files.updates, "gameUpdates"),
  readArray(files.performance, "profiles"),
  readArray(files.hardware, "cpuCatalog"),
  readArray(files.hardware, "gpuCatalog"),
]);

const errors = [];
const gameIds = new Set();
const gameSlugs = new Set();
const gamesBySlug = new Map();

for (const [index, game] of games.entries()) {
  const label =
    isNonEmptyString(game.slug)
      ? game.slug
      : `games[${index}]`;

  for (const field of [
    "id",
    "slug",
    "title",
    "description",
    "category",
    "imageAlt",
  ]) {
    if (!isNonEmptyString(game[field])) {
      errors.push(
        `${label}: ${field} es obligatorio y no puede estar vacío.`
      );
    }
  }

  if (
    isNonEmptyString(game.id) &&
    gameIds.has(game.id)
  ) {
    errors.push(
      `${label}: id duplicado "${game.id}".`
    );
  }

  if (isNonEmptyString(game.id)) {
    gameIds.add(game.id);
  }

  if (
    isNonEmptyString(game.slug) &&
    gameSlugs.has(game.slug)
  ) {
    errors.push(
      `${label}: slug duplicado "${game.slug}".`
    );
  }

  if (isNonEmptyString(game.slug)) {
    gameSlugs.add(game.slug);
    gamesBySlug.set(game.slug, game);

    if (!slugPattern.test(game.slug)) {
      errors.push(
        `${label}: slug inválido. Usá minúsculas, números y guiones simples.`
      );
    }
  }

  if (
    game.rating !== undefined &&
    (
      typeof game.rating !== "number" ||
      !Number.isFinite(game.rating) ||
      game.rating < 0 ||
      game.rating > 5
    )
  ) {
    errors.push(
      `${label}: rating debe estar entre 0 y 5.`
    );
  }

  if (
    game.reviews !== undefined &&
    (
      typeof game.reviews !== "string" ||
      !reviewsPattern.test(game.reviews)
    )
  ) {
    errors.push(
      `${label}: reviews debe usar un formato numérico como 320, 12.4K o 1.2M.`
    );
  }

  if (
    (game.rating === undefined) !==
    (game.reviews === undefined)
  ) {
    errors.push(
      `${label}: rating y reviews deben declararse juntos o ambos omitirse.`
    );
  }

  if (
    game.addedAt !== undefined &&
    !isValidCalendarDate(game.addedAt)
  ) {
    errors.push(
      `${label}: addedAt debe ser una fecha real DD/MM/YYYY.`
    );
  }

  for (const field of [
    "coverImage",
    "heroImage",
  ]) {
    if (
      game[field] !== undefined &&
      (
        !isNonEmptyString(game[field]) ||
        !game[field].startsWith("/images/")
      )
    ) {
      errors.push(
        `${label}: ${field} debe ser una ruta pública bajo /images/.`
      );
    }
  }

  if (game.screenshots !== undefined) {
    if (!Array.isArray(game.screenshots)) {
      errors.push(
        `${label}: screenshots debe ser un array.`
      );
    } else {
      for (const screenshot of game.screenshots) {
        if (
          !isNonEmptyString(screenshot) ||
          !screenshot.startsWith("/images/")
        ) {
          errors.push(
            `${label}: cada screenshot debe ser una ruta pública bajo /images/.`
          );
        }
      }
    }
  }

  validateRequirementObject(
    game.requirements,
    `${label}.requirements`,
    errors
  );
  validateDownload(game, errors);
}

const performanceSlugs = new Set();

for (const [index, profile] of performanceProfiles.entries()) {
  const label =
    isNonEmptyString(profile.slug)
      ? `performance.${profile.slug}`
      : `performance[${index}]`;

  if (!isNonEmptyString(profile.slug)) {
    errors.push(`${label}: slug es obligatorio.`);
    continue;
  }

  if (performanceSlugs.has(profile.slug)) {
    errors.push(`${label}: perfil de rendimiento duplicado.`);
  }
  performanceSlugs.add(profile.slug);

  if (!gameSlugs.has(profile.slug)) {
    errors.push(`${label}: referencia un juego inexistente.`);
  }

  if (!isPositiveNumber(profile.referenceFps)) {
    errors.push(`${label}: referenceFps debe ser positivo.`);
  }

  if (!isPositiveNumber(profile.ramGb)) {
    errors.push(`${label}: ramGb debe ser positivo.`);
  }

  if (
    profile.storageGb !== undefined &&
    !isPositiveNumber(profile.storageGb)
  ) {
    errors.push(`${label}: storageGb debe ser positivo.`);
  }

  if (
    profile.fpsCap !== undefined &&
    !isPositiveNumber(profile.fpsCap)
  ) {
    errors.push(`${label}: fpsCap debe ser positivo.`);
  }

  const cpuWeight = profile.cpuWeight;
  const gpuWeight = profile.gpuWeight;

  if (
    typeof cpuWeight !== "number" ||
    !Number.isFinite(cpuWeight) ||
    cpuWeight < 0 ||
    cpuWeight > 1
  ) {
    errors.push(`${label}: cpuWeight debe estar entre 0 y 1.`);
  }

  if (
    typeof gpuWeight !== "number" ||
    !Number.isFinite(gpuWeight) ||
    gpuWeight < 0 ||
    gpuWeight > 1
  ) {
    errors.push(`${label}: gpuWeight debe estar entre 0 y 1.`);
  }

  if (
    typeof cpuWeight === "number" &&
    typeof gpuWeight === "number" &&
    Math.abs(cpuWeight + gpuWeight - 1) > 0.001
  ) {
    errors.push(`${label}: cpuWeight + gpuWeight debe sumar 1.`);
  }

  if (
    profile.optimization !== undefined &&
    (
      typeof profile.optimization !== "number" ||
      !Number.isFinite(profile.optimization) ||
      profile.optimization < 0.5 ||
      profile.optimization > 1.5
    )
  ) {
    errors.push(`${label}: optimization debe estar entre 0.5 y 1.5.`);
  }
}

for (const slug of gameSlugs) {
  if (!performanceSlugs.has(slug)) {
    errors.push(
      `${slug}: falta un perfil de rendimiento en performance-data.ts.`
    );
  }
}

validateHardwareCatalog(
  cpuCatalog,
  "cpuCatalog",
  errors
);
validateHardwareCatalog(
  gpuCatalog,
  "gpuCatalog",
  errors
);

const updateIds = new Set();
const updateVersions = new Set();
const updatesByGame = new Map();

for (const [index, update] of updates.entries()) {
  const label =
    isNonEmptyString(update.id)
      ? update.id
      : `gameUpdates[${index}]`;

  for (const field of [
    "id",
    "gameSlug",
    "version",
    "publishedAt",
    "type",
    "summary",
  ]) {
    if (!isNonEmptyString(update[field])) {
      errors.push(
        `${label}: ${field} es obligatorio y no puede estar vacío.`
      );
    }
  }

  if (
    isNonEmptyString(update.id) &&
    updateIds.has(update.id)
  ) {
    errors.push(
      `${label}: id de actualización duplicado.`
    );
  }

  if (isNonEmptyString(update.id)) {
    updateIds.add(update.id);
  }

  if (
    isNonEmptyString(update.gameSlug) &&
    !gameSlugs.has(update.gameSlug)
  ) {
    errors.push(
      `${label}: referencia el juego inexistente "${update.gameSlug}".`
    );
  }

  if (
    isNonEmptyString(update.type) &&
    !allowedUpdateTypes.has(update.type)
  ) {
    errors.push(
      `${label}: tipo de actualización inválido "${update.type}".`
    );
  }

  if (
    !isValidPublishedAt(update.publishedAt)
  ) {
    errors.push(
      `${label}: publishedAt debe usar un timestamp ISO válido.`
    );
  }

  if (
    update.featured !== undefined &&
    typeof update.featured !== "boolean"
  ) {
    errors.push(
      `${label}: featured debe ser booleano.`
    );
  }

  if (
    isNonEmptyString(update.gameSlug) &&
    isNonEmptyString(update.version)
  ) {
    const versionKey =
      `${update.gameSlug}::${update.version}`;

    if (updateVersions.has(versionKey)) {
      errors.push(
        `${label}: la versión ${update.version} está repetida para ${update.gameSlug}.`
      );
    }

    updateVersions.add(versionKey);

    const current =
      updatesByGame.get(update.gameSlug) ?? [];
    current.push(update);
    updatesByGame.set(
      update.gameSlug,
      current
    );
  }
}

for (const [slug, gameUpdates] of updatesByGame) {
  const game = gamesBySlug.get(slug);

  if (!game) {
    continue;
  }

  const latest = [...gameUpdates].sort(
    (a, b) =>
      Date.parse(b.publishedAt) -
      Date.parse(a.publishedAt)
  )[0];

  if (
    latest &&
    game.version !== latest.version
  ) {
    errors.push(
      `${slug}: game.version (${game.version ?? "sin versión"}) no coincide con la actualización más reciente (${latest.version}).`
    );
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log(
  `Datos: OK (${games.length} juegos, ${updates.length} actualizaciones, ${performanceProfiles.length} perfiles de rendimiento, ${cpuCatalog.length} CPU y ${gpuCatalog.length} GPU consistentes).`
);
