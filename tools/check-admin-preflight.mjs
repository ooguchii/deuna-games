import {
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(
    path.join(root, relativePath),
    "utf8"
  );
}

const [packageSource, localPreflight] =
  await Promise.all([
    source("package.json"),
    source("tools/admin/preflight-local.ts"),
  ]);
const packageJson = JSON.parse(packageSource);
const scripts = packageJson.scripts ?? {};

assert(
  scripts["admin:preflight"] ===
    "npm run admin:preflight:migration && npm run admin:preflight:local",
  "admin:preflight debe verificar migraciones y después el workspace local."
);
assert(
  typeof scripts["admin:preflight:local"] === "string" &&
    scripts["admin:preflight:local"].includes(
      "--env-file=.env.local"
    ) &&
    scripts["admin:preflight:local"].includes(
      "preflight-local.ts"
    ),
  "El preflight local debe cargar únicamente .env.local y usar su comprobador dedicado."
);
assert(
  typeof scripts["admin:preflight:runtime"] === "string" &&
    scripts["admin:preflight:runtime"].includes(
      "--purpose=runtime"
    ) &&
    !scripts["admin:preflight:runtime"].includes(
      ".env.local"
    ),
  "El preflight de producción no debe reutilizar el entorno HTTP local."
);

for (const required of [
  '"site_config", "site"',
  '"home_config", "home"',
  '"about_config", "about"',
  "published_payload",
  "published_checksum",
  "public_visible",
  "editorial_publications",
  "parseEditorialPayload",
  "current_user",
]) {
  assert(
    localPreflight.includes(required),
    `El preflight local debe conservar la comprobación ${required}.`
  );
}

assert(
  !/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/i.test(
    localPreflight
  ),
  "El preflight local debe permanecer estrictamente de sólo lectura."
);
assert(
  localPreflight.includes(
    'siteUrl.origin === "http://localhost:3000"'
  ) &&
    localPreflight.includes(
      'adminOrigin.origin === "http://localhost:3000"'
    ) &&
    localPreflight.includes(
      'process.env.DEUNA_ADMIN_ENABLED === "true"'
    ),
  "El preflight local debe exigir el origen local exacto y el panel habilitado."
);

if (failures.length > 0) {
  console.error("\nPreflight administrativo: REGRESIÓN\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exitCode = 1;
} else {
  console.log(
    "Preflight administrativo: OK (local y producción separados; workspace editorial completo y chequeo local de sólo lectura protegidos)."
  );
}
