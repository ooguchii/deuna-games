import {
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  hashAdminPassword,
  validateAdminPassword,
  verifyAdminPassword,
} from "../src/lib/admin/password.ts";
import {
  createAdminSessionToken,
  hashAdminSessionToken,
  isValidAdminSessionToken,
} from "../src/lib/admin/session-token.ts";

const root = process.cwd();
const failures: string[] = [];

function assert(
  condition: unknown,
  message: string
) {
  if (!condition) failures.push(message);
}

const password =
  "Frase-Privada-Extensa-2026!";
const firstHash =
  await hashAdminPassword(password);
const secondHash =
  await hashAdminPassword(password);

assert(
  firstHash !== secondHash,
  "Dos contraseñas iguales deben usar sales diferentes."
);
assert(
  await verifyAdminPassword(
    password,
    firstHash
  ),
  "El hash administrativo no reconoce la contraseña correcta."
);
assert(
  !(await verifyAdminPassword(
    `${password}x`,
    firstHash
  )),
  "El hash administrativo aceptó una contraseña incorrecta."
);
assert(
  validateAdminPassword("corta").length > 0,
  "La política aceptó una contraseña débil."
);

const tokenOne = createAdminSessionToken();
const tokenTwo = createAdminSessionToken();
const tokenHash = hashAdminSessionToken(tokenOne);

assert(
  tokenOne !== tokenTwo,
  "Los tokens de sesión deben ser únicos."
);
assert(
  isValidAdminSessionToken(tokenOne),
  "El token seguro generado no cumple su formato."
);
assert(
  /^[0-9a-f]{64}$/.test(tokenHash),
  "El hash del token no usa SHA-256 hexadecimal."
);
assert(
  !tokenHash.includes(tokenOne),
  "El token sin procesar no debe persistir en su hash."
);

const migration = await readFile(
  path.join(
    root,
    "database",
    "migrations",
    "001_admin_foundation.sql"
  ),
  "utf8"
);

for (const forbidden of [
  "ip_address",
  "user_agent",
  "fingerprint",
  "visitor_id",
  "geolocation",
]) {
  assert(
    !migration.toLowerCase().includes(forbidden),
    `La base administrativa no debe incluir ${forbidden}.`
  );
}

const nginx = await readFile(
  path.join(
    root,
    "ops",
    "nginx",
    "deuna-games.conf.example"
  ),
  "utf8"
);

assert(
  nginx.includes("allow 10.8.0.0/24;") &&
    nginx.includes("deny all;"),
  "El ejemplo Nginx debe cerrar el panel fuera de la VPN."
);
assert(
  !/proxy_set_header\s+(?:X-Real-IP|X-Forwarded-For)/i.test(
    nginx
  ),
  "Nginx no debe reenviar IP de visitantes a Next."
);
assert(
  nginx.includes("access_log off;") &&
    nginx.includes("error_log /dev/null crit;"),
  "Nginx no debe persistir logs que puedan contener IP."
);

const databaseConfig = await readFile(
  path.join(
    root,
    "src",
    "lib",
    "admin",
    "database-config.ts"
  ),
  "utf8"
);

assert(
  databaseConfig.includes("DEUNA_ADMIN_ORIGIN") &&
    databaseConfig.includes(
      'url.protocol !== "https:"'
    ),
  "El panel debe fijar un origen HTTPS explícito en producción."
);

const requestSecurity = await readFile(
  path.join(
    root,
    "src",
    "lib",
    "admin",
    "request-security.ts"
  ),
  "utf8"
);

assert(
  requestSecurity.includes(
    'Buffer.byteLength(body, "utf8")'
  ) &&
    !requestSecurity.includes("multipart/form-data"),
  "Los formularios deben verificar su tamaño real y rechazar multipart innecesario."
);

const migrator = await readFile(
  path.join(
    root,
    "tools",
    "admin",
    "migrate.ts"
  ),
  "utf8"
);

assert(
  migrator.includes(
    "GRANT UPDATE (revoked_at)"
  ) &&
    !migrator.includes(
      "GRANT SELECT, INSERT, UPDATE, DELETE"
    ),
  "El rol runtime debe usar permisos de columna y no borrar sesiones."
);

const systemd = await readFile(
  path.join(
    root,
    "ops",
    "systemd",
    "deuna-games.service.example"
  ),
  "utf8"
);

assert(
  systemd.includes("HOSTNAME=127.0.0.1") &&
    systemd.includes("IPAddressDeny=any") &&
    systemd.includes("IPAddressAllow=localhost") &&
    systemd.includes("NoNewPrivileges=true"),
  "El servicio de producción debe quedar aislado y limitado a loopback."
);

const runtimeEnvironment = await readFile(
  path.join(root, ".env.example"),
  "utf8"
);

assert(
  !runtimeEnvironment.includes(
    "DEUNA_DATABASE_MIGRATION_PASSWORD"
  ),
  "Las credenciales de migración no deben estar en el entorno cargado por Next.js."
);

if (failures.length > 0) {
  console.error("\nSeguridad administrativa: ERROR\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Seguridad administrativa: OK (scrypt, tokens opacos, esquema sin rastreo y cierre por VPN verificados)."
);
