import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function repoRelative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const packageManifest = JSON.parse(
  await read("package.json")
);
const scripts = packageManifest.scripts ?? {};

for (const script of [
  "admin:test-user",
  "admin:diagnose-login",
  "admin:auth-status",
  "admin:diagnose",
]) {
  assert(
    !Object.hasOwn(scripts, script),
    `El comando temporal ${script} no debe volver a package.json.`
  );
}

assert(
  scripts["check:maintenance"]?.includes(
    "tools/check-maintenance.mjs"
  ),
  "El control de mantenimiento debe permanecer integrado en package.json."
);

for (const temporaryFile of [
  "tools/admin/test-owner-rollback.ts",
  "tools/admin/diagnose-login.ts",
  "tools/admin/auth-status.ts",
]) {
  assert(
    !(await exists(temporaryFile)),
    `El diagnóstico temporal ${temporaryFile} no debe quedar versionado.`
  );
}

const toolExtensions = new Set([".mjs", ".js", ".cjs", ".ts", ".tsx", ".sh"]);
const toolFiles = (await walk(path.join(root, "tools")))
  .filter((file) => toolExtensions.has(path.extname(file)))
  .map(repoRelative);
const toolFileSet = new Set(toolFiles);
const toolRoots = new Set();
const scriptText = Object.values(scripts).join("\n");
const toolReferencePattern = /(?:^|[\s"'])(?:\.\/)?(tools\/[A-Za-z0-9_./-]+\.(?:mjs|js|cjs|ts|tsx|sh))/g;

for (const match of scriptText.matchAll(toolReferencePattern)) {
  if (toolFileSet.has(match[1])) toolRoots.add(match[1]);
}

function resolveToolImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;

  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(importer), specifier)
  );
  const candidates = path.posix.extname(base)
    ? [base]
    : [
        base,
        ...[".mjs", ".js", ".cjs", ".ts", ".tsx"].map(
          (extension) => `${base}${extension}`
        ),
        ...[".mjs", ".js", ".cjs", ".ts", ".tsx"].map(
          (extension) => `${base}/index${extension}`
        ),
      ];

  return candidates.find((candidate) => toolFileSet.has(candidate)) ?? null;
}

const importPattern = /(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g;
const reachableTools = new Set();
const queue = [...toolRoots];

while (queue.length > 0) {
  const current = queue.shift();
  if (!current || reachableTools.has(current)) continue;

  reachableTools.add(current);
  if (path.posix.extname(current) === ".sh") continue;

  const content = await read(current);
  for (const match of content.matchAll(importPattern)) {
    const dependency = resolveToolImport(current, match[1]);
    if (dependency && !reachableTools.has(dependency)) queue.push(dependency);
  }
}

for (const file of toolFiles) {
  assert(
    reachableTools.has(file),
    `${file} no está conectado a ningún comando mantenido de package.json ni a otro tool alcanzable.`
  );
}

const forbiddenToolFragments = [
  ["TO", "DO"].join(""),
  ["FIX", "ME"].join(""),
  ["HA", "CK"].join(""),
  ["@ts-", "ignore"].join(""),
  ["@ts-", "nocheck"].join(""),
  ["eslint-", "disable"].join(""),
];
const toolPolicyDefinitionFiles = new Set([
  "tools/check-source-hygiene.mjs",
]);

for (const file of toolFiles) {
  if (toolPolicyDefinitionFiles.has(file)) continue;

  const content = await read(file);
  for (const fragment of forbiddenToolFragments) {
    assert(
      !content.includes(fragment),
      `${file} contiene un marcador pendiente o una supresión no permitida.`
    );
  }
}

const requestSecurity = await read(
  "src/lib/admin/request-security.ts"
);
assert(
  requestSecurity.includes('origin !== "null"') &&
    requestSecurity.includes('fetchSite === "cross-site"') &&
    requestSecurity.includes('fetchSite === "same-origin"') &&
    requestSecurity.includes('fetchSite === "none"'),
  "La protección de formularios debe conservar el manejo local compatible y rechazar cross-site."
);
assert(
  !requestSecurity.includes("[admin-login-rejected]") &&
    !requestSecurity.includes("console.warn"),
  "No deben quedar trazas de diagnóstico del formulario administrativo."
);

for (const route of [
  "src/app/api/admin/auth/login/route.ts",
  "src/app/api/admin/auth/logout/route.ts",
]) {
  const content = await read(route);
  assert(
    content.includes("hasExactAdminFormFields"),
    `${route} debe rechazar campos administrativos extra o duplicados.`
  );
}

const secureBuild = await read(
  "tools/build-secure-deploy.mjs"
);
assert(
  secureBuild.includes('"tools/run-next.mjs"') &&
    secureBuild.includes('"tools/smoke-test.mjs"'),
  "El staging seguro debe copiar los wrappers requeridos por build y smoke."
);

const workflow = await read(
  ".github/workflows/ci.yml"
);
assert(
  workflow.includes("pull_request:") &&
    !workflow.includes("feature/game-detail-download-v2"),
  "CI no debe depender de una rama temporal concreta."
);
assert(
  workflow.includes("npm run check:maintenance"),
  "CI debe ejecutar las invariantes de mantenimiento."
);

if (failures.length > 0) {
  console.error("\nMantenimiento del repositorio: ERROR\n");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  console.error(
    "\nRetira diagnósticos, tools huérfanos o restaura las invariantes antes de integrar.\n"
  );
  process.exit(1);
}

console.log(
  `Mantenimiento: OK (${reachableTools.size} tools alcanzables, sin diagnósticos temporales ni marcadores pendientes y con invariantes críticas preservadas).`
);
