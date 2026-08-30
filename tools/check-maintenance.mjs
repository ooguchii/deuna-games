import { access, readFile } from "node:fs/promises";
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

const requestSecurity = await read(
  "src/lib/admin/request-security.ts"
);
assert(
  requestSecurity.includes('origin !== "null"') &&
    requestSecurity.includes('fetchSite === "cross-site"') &&
    requestSecurity.includes('fetchSite === "same-origin"'),
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

if (failures.length > 0) {
  console.error("\nMantenimiento del repositorio: ERROR\n");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  console.error(
    "\nRetira diagnósticos temporales o restaura las invariantes antes de integrar.\n"
  );
  process.exit(1);
}

console.log(
  "Mantenimiento: OK (sin diagnósticos temporales y con invariantes críticas preservadas)."
);
