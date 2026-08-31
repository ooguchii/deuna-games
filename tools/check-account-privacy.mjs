import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const issues = [];

function fail(message) {
  issues.push(message);
}

function requirePattern(content, pattern, message) {
  if (!pattern.test(content)) {
    fail(message);
  }
}

function forbidPattern(content, pattern, message) {
  if (pattern.test(content)) {
    fail(message);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createTableBlock(sql, qualifiedName) {
  const pattern = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${escapeRegExp(qualifiedName)}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i"
  );
  const match = sql.match(pattern);

  if (!match) {
    fail(`No se encontró la definición de ${qualifiedName}.`);
    return "";
  }

  return match[1] ?? "";
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
      continue;
    }

    if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
}

const migrationsDirectory = path.join(root, "database", "migrations");
const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
const migrations = (
  await Promise.all(
    migrationNames.map((name) =>
      readFile(path.join(migrationsDirectory, name), "utf8")
    )
  )
).join("\n\n");

const accountMigration = await read("database/migrations/009_account_foundation.sql");
const usersTable = createTableBlock(accountMigration, "deuna_accounts.users");
const sessionsTable = createTableBlock(accountMigration, "deuna_accounts.sessions");
const recoveryTable = createTableBlock(accountMigration, "deuna_accounts.recovery_codes");
const adminUsersTable = createTableBlock(migrations, "deuna_admin.admin_users");

requirePattern(
  accountMigration,
  /CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+deuna_accounts/i,
  "La migración de cuentas debe conservar un esquema PostgreSQL separado."
);
requirePattern(
  accountMigration,
  /REVOKE\s+ALL\s+ON\s+SCHEMA\s+deuna_accounts\s+FROM\s+PUBLIC/i,
  "El esquema de cuentas debe revocar el acceso de PUBLIC."
);
requirePattern(
  usersTable,
  /^\s*email_encrypted\s+text\b/im,
  "El correo opcional debe persistirse únicamente como email_encrypted."
);
forbidPattern(
  usersTable,
  /^\s*email\s+(?:text|varchar|char)\b/im,
  "La tabla pública no puede contener una columna de correo en texto plano."
);
forbidPattern(
  adminUsersTable,
  /^\s*email(?:_encrypted)?\s+(?:text|varchar|char)\b/im,
  "Las cuentas administrativas no deben almacenar correo."
);

const forbiddenColumnPatterns = [
  /^\s*(?:ip|ip_address|client_ip|remote_ip)\s+/im,
  /^\s*(?:user_agent|device|device_id|device_fingerprint|fingerprint)\s+/im,
  /^\s*(?:location|latitude|longitude|postal_code|address|address_line)\s+/im,
  /^\s*(?:phone|telephone|legal_name|document|document_id|date_of_birth|birth_date|gender)\s+/im,
  /^\s*(?:referrer|referer|navigation_history|browsing_history)\s+/im,
];

for (const [tableName, block] of [
  ["users", usersTable],
  ["sessions", sessionsTable],
  ["recovery_codes", recoveryTable],
]) {
  for (const pattern of forbiddenColumnPatterns) {
    if (pattern.test(block)) {
      fail(`deuna_accounts.${tableName} contiene una columna incompatible con minimización de datos.`);
    }
  }

  forbidPattern(
    block,
    /REFERENCES\s+deuna_admin\./i,
    `deuna_accounts.${tableName} no puede depender de cuentas administrativas.`
  );
}

requirePattern(
  sessionsTable,
  /^\s*token_hash\s+char\(64\)\s+NOT\s+NULL\s+UNIQUE/im,
  "Las sesiones deben almacenar únicamente el hash del token."
);
forbidPattern(
  sessionsTable,
  /^\s*token\s+(?:text|varchar|char)\b/im,
  "Las sesiones no pueden persistir tokens en texto plano."
);
requirePattern(
  recoveryTable,
  /^\s*code_hash\s+char\(64\)\s+NOT\s+NULL\s+UNIQUE/im,
  "Los códigos de recuperación deben persistirse únicamente como hash."
);
forbidPattern(
  recoveryTable,
  /^\s*code\s+(?:text|varchar|char)\b/im,
  "Los códigos de recuperación no pueden persistirse en texto plano."
);
requirePattern(
  sessionsTable,
  /REFERENCES\s+deuna_accounts\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i,
  "Las sesiones deben eliminarse por cascada al borrar la cuenta."
);
requirePattern(
  recoveryTable,
  /REFERENCES\s+deuna_accounts\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i,
  "Los códigos de recuperación deben eliminarse por cascada al borrar la cuenta."
);

const privateData = await read("src/lib/accounts/private-data.ts");
requirePattern(
  privateData,
  /createCipheriv\(\s*"aes-256-gcm"/s,
  "Los datos opcionales deben cifrarse con AES-256-GCM."
);
requirePattern(
  privateData,
  /process\.env\.DEUNA_ACCOUNT_DATA_KEY/,
  "El cifrado debe depender de DEUNA_ACCOUNT_DATA_KEY."
);
requirePattern(
  privateData,
  /key\.length\s*!==\s*32/,
  "La clave de datos debe validarse como 32 bytes."
);

const session = await read("src/lib/accounts/session.ts");
requirePattern(session, /httpOnly:\s*true/, "La cookie pública debe ser HttpOnly.");
requirePattern(session, /sameSite:\s*"lax"/, "La cookie pública debe conservar SameSite=Lax.");
requirePattern(session, /hashAccountSessionToken\(token\)/, "El token de sesión debe hashearse antes de consultar PostgreSQL.");

const service = await read("src/lib/accounts/service.ts");
requirePattern(
  service,
  /DUMMY_RECOVERY_USER_ID[\s\S]*findUnusedRecoveryCode\([\s\S]*DUMMY_RECOVERY_USER_ID/s,
  "La recuperación debe ejecutar una búsqueda ficticia para usuarios inexistentes."
);
requirePattern(
  service,
  /DELETE\s+FROM\s+deuna_accounts\.users\s+WHERE\s+id\s*=\s*\$1/i,
  "La baja de cuenta debe ser física, no un soft delete."
);
requirePattern(
  service,
  /verifyAccountPassword\([\s\S]*password[\s\S]*user\.password_hash/s,
  "La baja debe exigir verificación de la contraseña actual."
);

const recoverRoute = await read("src/app/api/account/recover/route.ts");
requirePattern(
  recoverRoute,
  /error:\s*"recuperacion"/,
  "Los fallos válidos de recuperación deben responder con un error genérico."
);
forbidPattern(
  recoverRoute,
  /usuario\s+(?:no\s+existe|inexistente)|username_(?:missing|unknown)/i,
  "La recuperación no debe revelar si el usuario existe."
);

const deleteRoute = await read("src/app/api/account/delete/route.ts");
requirePattern(deleteRoute, /readTrustedAccountForm\(request\)/, "La baja debe validar origen y formato del formulario.");
requirePattern(deleteRoute, /resolveAccountSession\(token\)/, "La baja debe exigir una sesión pública válida.");
requirePattern(deleteRoute, /accountDeletionSchema\.safeParse/, "La baja debe validar estrictamente sus campos.");
requirePattern(deleteRoute, /getExpiredAccountCookieOptions\(\)/, "La baja debe expirar la cookie de sesión.");

const mutatingRoutes = [
  "login",
  "logout",
  "profile",
  "recover",
  "register",
  "delete",
];
for (const route of mutatingRoutes) {
  const content = await read(`src/app/api/account/${route}/route.ts`);
  requirePattern(
    content,
    /readTrustedAccountForm\(request\)/,
    `/api/account/${route} debe usar la barrera de formulario de mismo origen.`
  );
}

const accountSourceFiles = [
  ...(await walk(path.join(root, "src", "lib", "accounts"))),
  ...(await walk(path.join(root, "src", "app", "api", "account"))),
  ...(await walk(path.join(root, "src", "app", "cuenta"))),
];
const forbiddenRuntimePatterns = [
  /headers\.get\(\s*["'](?:user-agent|x-forwarded-for|cf-connecting-ip|true-client-ip|x-real-ip)["']\s*\)/i,
  /navigator\.userAgent/i,
  /navigator\.geolocation/i,
  /deviceFingerprint|fingerprintjs|canvasFingerprint/i,
  /\b(?:localStorage|sessionStorage|indexedDB)\b/,
];

for (const file of accountSourceFiles) {
  const content = await readFile(file, "utf8");
  const relative = path.relative(root, file).split(path.sep).join("/");

  for (const pattern of forbiddenRuntimePatterns) {
    if (pattern.test(content)) {
      fail(`${relative} intenta recopilar o persistir metadatos de seguimiento no necesarios.`);
    }
  }

  if (
    relative.startsWith("src/lib/accounts/") ||
    relative.startsWith("src/app/api/account/")
  ) {
    forbidPattern(
      content,
      /console\.(?:log|info|debug|warn|error)\s*\(/,
      `${relative} no debe registrar datos del flujo de autenticación en consola.`
    );
  }
}

const migrate = await read("tools/admin/migrate.ts");
const deleteGrantMatches = [...migrate.matchAll(
  /GRANT\s+DELETE\s+ON\s+(deuna_accounts\.[a-z_]+)\s+TO\s+\$\{role\}/gi
)].map((match) => match[1]);
const expectedDeleteGrants = new Set([
  "deuna_accounts.users",
  "deuna_accounts.recovery_codes",
]);

if (
  deleteGrantMatches.length !== expectedDeleteGrants.size ||
  deleteGrantMatches.some((name) => !expectedDeleteGrants.has(name))
) {
  fail("El runtime sólo puede recibir DELETE sobre users y recovery_codes de deuna_accounts.");
}

const preflight = await read("tools/admin/preflight.ts");
for (const table of expectedDeleteGrants) {
  requirePattern(
    preflight,
    new RegExp(`objectKey\\s*===\\s*"${escapeRegExp(table)}"`),
    `El preflight debe verificar explícitamente DELETE sobre ${table}.`
  );
}

const envExamples = [
  await read(".env.example"),
  await read("ops/systemd/runtime.env.example"),
].join("\n");
forbidPattern(
  envExamples,
  /DEUNA_ACCOUNT_DATA_KEY\s*=\s*[A-Za-z0-9_-]{43}\b/,
  "DEUNA_ACCOUNT_DATA_KEY no puede contener una clave real versionada."
);

if (issues.length > 0) {
  console.error("\nPrivacidad de cuentas: ERROR\n");

  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  process.exit(1);
}

console.log(
  `Privacidad de cuentas: OK (${accountSourceFiles.length} archivos de cuenta revisados; minimización, cifrado, separación, recuperación y baja verificadas).`
);
