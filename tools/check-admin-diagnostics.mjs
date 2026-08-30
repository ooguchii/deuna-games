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

const [
  packageManifestText,
  interactivePassword,
  diagnoseLogin,
  testOwnerRollback,
] = await Promise.all([
  source("package.json"),
  source("tools/admin/interactive-password.ts"),
  source("tools/admin/diagnose-login.ts"),
  source("tools/admin/test-owner-rollback.ts"),
]);
const packageManifest = JSON.parse(packageManifestText);
const scripts = packageManifest.scripts ?? {};

assert(
  scripts["admin:test-user"] ===
    "node --env-file=.env.admin-migration.local ./tools/admin/test-owner-rollback.ts",
  "admin:test-user debe usar únicamente el entorno privado de migración."
);
assert(
  scripts["admin:diagnose-login"] ===
    "node --env-file=.env.local ./tools/admin/diagnose-login.ts",
  "admin:diagnose-login debe reproducir el acceso con el rol runtime."
);
assert(
  scripts["admin:diagnose"] ===
    "npm run admin:test-user && npm run admin:diagnose-login",
  "admin:diagnose debe ejecutar primero la prueba temporal y luego el diagnóstico runtime."
);

assert(
  interactivePassword.includes(
    "stripTerminalEscapeSequences"
  ) &&
    interactivePassword.includes(
      'const ESCAPE = "\\u001b"'
    ) &&
    interactivePassword.includes(
      "readAdminPassword"
    ) &&
    interactivePassword.includes(
      'character === "\\u0015"'
    ),
  "La lectura de contraseña debe sanear secuencias ANSI/bracketed-paste y conservar lectura oculta."
);

assert(
  testOwnerRollback.includes(
    "assertLocalDatabase()"
  ) &&
    testOwnerRollback.includes(
      'host !== "127.0.0.1"'
    ) &&
    testOwnerRollback.includes(
      'host !== "localhost"'
    ) &&
    testOwnerRollback.includes(
      'host !== "::1"'
    ) &&
    testOwnerRollback.includes(
      'await client.query("BEGIN")'
    ) &&
    testOwnerRollback.includes(
      'await client.query("ROLLBACK")'
    ) &&
    !testOwnerRollback.includes(
      'await client.query("COMMIT")'
    ),
  "El usuario temporal debe limitarse a PostgreSQL local y existir sólo dentro de una transacción revertida."
);

assert(
  diagnoseLogin.includes(
    'getAdminDatabaseConfig("runtime")'
  ) &&
    diagnoseLogin.includes(
      "readAdminPassword"
    ) &&
    diagnoseLogin.includes(
      'await client.query("BEGIN")'
    ) &&
    diagnoseLogin.includes(
      'await client.query("ROLLBACK")'
    ) &&
    diagnoseLogin.includes(
      'password = ""'
    ) &&
    !diagnoseLogin.includes(
      "failed_login_count = failed_login_count + 1"
    ),
  "El diagnóstico debe usar el rol runtime, no sumar intentos fallidos y revertir sus escrituras de prueba."
);

if (failures.length > 0) {
  console.error("\nDiagnóstico administrativo: BLOQUEADO\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exitCode = 1;
} else {
  console.log(
    "Diagnóstico administrativo: OK (entrada oculta saneada, prueba local con rollback y diagnóstico runtime protegidos)."
  );
}
