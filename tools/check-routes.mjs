import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appRoot = path.join(root, "src", "app");
const sourceRoot = path.join(root, "src");
const gamesFile = path.join(root, "src", "data", "games.ts");

const sourcePattern = /\.(?:js|jsx|mjs|ts|tsx)$/i;

const catalogQueryRules = {
  orden: new Set(["popular", "rating", "recientes", "az"]),
  buscarEn: new Set(["all", "title", "category", "requirements"]),
  equipo: new Set(["all", "lowSpec", "requirements"]),
  estado: new Set(["all", "recent", "version"]),
  vista: new Set(["grid", "compact"]),
};

const updateQueryRules = {
  tipo: new Set(["all", "update", "content", "fix", "improvement"]),
  orden: new Set(["recent", "oldest", "az"]),
  descarga: new Set(["all", "downloadable"]),
};

async function walk(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function routeFromPage(filePath) {
  const relativeDirectory = path.relative(
    appRoot,
    path.dirname(filePath)
  );

  if (!relativeDirectory) {
    return "/";
  }

  const segments = relativeDirectory
    .split(path.sep)
    .filter(Boolean)
    .filter(
      (segment) =>
        !segment.startsWith("(") &&
        !segment.startsWith("@")
    );

  return `/${segments.join("/")}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routeToRegex(route) {
  if (route === "/") {
    return /^\/$/;
  }

  const segments = route
    .split("/")
    .filter(Boolean);

  const pattern = segments
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) {
        return "(?:.+)?";
      }

      if (/^\[\.\.\..+\]$/.test(segment)) {
        return ".+";
      }

      if (/^\[[^\]]+\]$/.test(segment)) {
        return "[^/]+";
      }

      return escapeRegex(segment);
    })
    .join("/");

  return new RegExp(`^/${pattern}/?$`);
}

function normalizeRawDestination(value) {
  const withoutTemplateExpressions = value.replace(
    /\$\{[^}]+\}/g,
    "dynamic"
  );

  if (!withoutTemplateExpressions.startsWith("/")) {
    return null;
  }

  let url;

  try {
    url = new URL(
      withoutTemplateExpressions,
      "https://deuna-routes.invalid"
    );
  } catch {
    return null;
  }

  const pathname = url.pathname.length > 1
    ? url.pathname.replace(/\/+$/, "")
    : url.pathname;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/media/") ||
    /\.[a-z0-9]{2,5}$/i.test(pathname)
  ) {
    return null;
  }

  return {
    raw: withoutTemplateExpressions,
    pathname,
    searchParams: url.searchParams,
    dynamic: withoutTemplateExpressions.includes("dynamic"),
  };
}

function collectDestinations(content) {
  const destinations = new Map();

  const patterns = [
    /(?:href|action)\s*=\s*["'](\/[^"']*)["']/g,
    /(?:href|action)\s*=\s*\{\s*`(\/[^`]*)`\s*\}/g,
    /\bhref\s*:\s*["'](\/[^"']*)["']/g,
    /\b(?:redirect|permanentRedirect)\(\s*["'](\/[^"']*)["']/g,
    /\b(?:redirect|permanentRedirect)\(\s*`(\/[^`]*)`/g,
    /\b(?:push|replace)\(\s*["'](\/[^"']*)["']/g,
    /\b(?:push|replace)\(\s*`(\/[^`]*)`/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const destination = normalizeRawDestination(match[1]);

      if (destination) {
        destinations.set(destination.raw, destination);
      }
    }
  }

  return [...destinations.values()];
}

function parseGameSlugs(content) {
  const slugs = new Set();
  const pattern = /\bslug\s*:\s*["']([^"']+)["']/g;

  for (const match of content.matchAll(pattern)) {
    slugs.add(match[1]);
  }

  return slugs;
}

function validateCatalogQuery(destination, gameSlugs) {
  const errors = [];
  const params = destination.searchParams;
  const known = new Set([
    "categoria",
    "orden",
    "q",
    "buscarEn",
    "puntuacion",
    "equipo",
    "estado",
    "vista",
  ]);

  for (const key of params.keys()) {
    if (!known.has(key)) {
      errors.push(`parámetro desconocido "${key}"`);
    }
  }

  for (const [key, allowed] of Object.entries(catalogQueryRules)) {
    const value = params.get(key);

    if (value && value !== "dynamic" && !allowed.has(value)) {
      errors.push(`${key}="${value}" no es un valor admitido`);
    }
  }

  const rating = params.get("puntuacion");

  if (rating && rating !== "dynamic") {
    const number = Number.parseFloat(rating);

    if (!Number.isFinite(number) || number < 0 || number > 5) {
      errors.push(`puntuacion="${rating}" debe estar entre 0 y 5`);
    }
  }

  const category = params.get("categoria");

  if (category && category !== "dynamic") {
    // La categoría se valida en runtime contra el catálogo; aquí sólo
    // rechazamos valores vacíos o claramente artificiales.
    if (!category.trim()) {
      errors.push("categoria no puede estar vacía");
    }
  }

  const game = params.get("juego");

  if (game && game !== "dynamic" && game !== "all" && !gameSlugs.has(game)) {
    errors.push(`juego="${game}" no existe en el catálogo`);
  }

  return errors;
}

function validateUpdatesQuery(destination, gameSlugs) {
  const errors = [];
  const params = destination.searchParams;
  const known = new Set([
    "q",
    "juego",
    "tipo",
    "orden",
    "descarga",
  ]);

  for (const key of params.keys()) {
    if (!known.has(key)) {
      errors.push(`parámetro desconocido "${key}"`);
    }
  }

  for (const [key, allowed] of Object.entries(updateQueryRules)) {
    const value = params.get(key);

    if (value && value !== "dynamic" && !allowed.has(value)) {
      errors.push(`${key}="${value}" no es un valor admitido`);
    }
  }

  const game = params.get("juego");

  if (game && game !== "dynamic" && game !== "all" && !gameSlugs.has(game)) {
    errors.push(`juego="${game}" no existe en el catálogo`);
  }

  return errors;
}

function validateQuery(destination, gameSlugs) {
  if (destination.dynamic) {
    return [];
  }

  if (destination.pathname === "/juegos") {
    return validateCatalogQuery(destination, gameSlugs);
  }

  if (destination.pathname === "/actualizaciones") {
    return validateUpdatesQuery(destination, gameSlugs);
  }

  return [];
}

const allSourceFiles = await walk(sourceRoot);
const pageFiles = allSourceFiles.filter(
  (file) =>
    file.startsWith(appRoot) &&
    path.basename(file) === "page.tsx"
);

const routes = pageFiles.map(routeFromPage);
const staticRoutes = new Set(
  routes.filter((route) => !route.includes("["))
);
const routeMatchers = routes.map((route) => ({
  route,
  regex: routeToRegex(route),
}));

const gameSlugs = parseGameSlugs(
  await readFile(gamesFile, "utf8")
);

function routeExists(destination) {
  const { pathname, dynamic } = destination;

  if (staticRoutes.has(pathname)) {
    return true;
  }

  if (!dynamic) {
    const gameDetail = pathname.match(/^\/juegos\/([^/]+)$/);

    if (gameDetail) {
      return gameSlugs.has(gameDetail[1]);
    }

    const gameDownload = pathname.match(
      /^\/juegos\/([^/]+)\/descargar$/
    );

    if (gameDownload) {
      // La existencia concreta de la descarga se valida en datos/runtime.
      // Acá al menos impedimos que un slug inventado quede cubierto por [slug].
      return gameSlugs.has(gameDownload[1]);
    }
  }

  return routeMatchers.some(({ regex }) =>
    regex.test(pathname)
  );
}

const sourceFiles = allSourceFiles.filter((file) =>
  sourcePattern.test(file)
);

const missing = [];
const invalidQueries = [];

for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  const destinations = collectDestinations(content);
  const relativeFile = path.relative(root, file).split(path.sep).join("/");

  for (const destination of destinations) {
    if (!routeExists(destination)) {
      missing.push({
        file: relativeFile,
        destination: destination.pathname,
      });
      continue;
    }

    for (const error of validateQuery(destination, gameSlugs)) {
      invalidQueries.push({
        file: relativeFile,
        destination: destination.raw,
        error,
      });
    }
  }
}

if (missing.length > 0 || invalidQueries.length > 0) {
  if (missing.length > 0) {
    console.error("\nRutas internas sin página App Router:\n");

    for (const entry of missing) {
      console.error(`- ${entry.destination}  <-  ${entry.file}`);
    }
  }

  if (invalidQueries.length > 0) {
    console.error("\nQueries internas inválidas:\n");

    for (const entry of invalidQueries) {
      console.error(
        `- ${entry.destination}  <-  ${entry.file}: ${entry.error}`
      );
    }
  }

  console.error(
    "\nCrea o corrige la ruta, o usa parámetros admitidos antes de integrar el cambio.\n"
  );

  process.exit(1);
}

console.log(
  `Rutas: OK (${routes.length} páginas, ${gameSlugs.size} slugs y queries internas verificadas).`
);
