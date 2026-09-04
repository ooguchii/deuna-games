import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const issues = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requirePattern(content, pattern, message) {
  if (!pattern.test(content)) issues.push(message);
}

function forbidPattern(content, pattern, message) {
  if (pattern.test(content)) issues.push(message);
}

const policy = read("src/lib/accounts/registration-policy.ts");
const registerRoute = read("src/app/api/account/register/route.ts");
const accountPage = read("src/app/cuenta/page.tsx");
const accountAccess = read("src/app/cuenta/AccountAccessClient.tsx");
const privacyPage = read("src/app/privacidad/page.tsx");
const envExample = read(".env.example");
const backupTool = read("tools/admin/backup-local.ts");
const upgradeRunbook = read("ops/postgresql/UPGRADE-011-REWARDS.md");
const nginx = read("ops/nginx/deuna-games.conf.example");

requirePattern(
  policy,
  /DEUNA_ACCOUNT_REGISTRATION_ENABLED/,
  "El registro público debe depender de un interruptor explícito de entorno."
);
requirePattern(
  policy,
  /if \(configured === "true"\) return true;[\s\S]*if \(configured === "false"\) return false;/s,
  "El interruptor de registro debe aceptar explícitamente true y false."
);
requirePattern(
  policy,
  /return process\.env\.NODE_ENV !== "production";/,
  "Producción debe cerrar el registro por defecto cuando el interruptor no está configurado."
);

const routeGate = registerRoute.indexOf("if (!isAccountRegistrationEnabled())");
const routeFormRead = registerRoute.indexOf("const form = await readTrustedAccountForm");
if (routeGate < 0 || routeFormRead < 0 || routeGate > routeFormRead) {
  issues.push(
    "El endpoint de registro debe aplicar el gate antes de leer o procesar el formulario."
  );
}
requirePattern(
  registerRoute,
  /error: "registro_cerrado"/,
  "El endpoint debe responder con un estado reconocible cuando el registro está cerrado."
);

requirePattern(
  accountPage,
  /registrationEnabled=\{isAccountRegistrationEnabled\(\)\}/,
  "La página de cuenta debe usar la misma política de registro que el endpoint."
);
requirePattern(
  accountAccess,
  /registrationEnabled: boolean/,
  "La UI de acceso debe recibir explícitamente el estado de registro."
);
requirePattern(
  accountAccess,
  /\{registrationEnabled && \([\s\S]*account-tab-register/s,
  "La UI no debe ofrecer Crear cuenta cuando el registro está cerrado."
);
requirePattern(
  accountAccess,
  /Las cuentas existentes pueden entrar y recuperarse normalmente\./,
  "La UI debe aclarar que cerrar el registro no bloquea cuentas existentes."
);
requirePattern(
  accountAccess,
  /href="\/privacidad"/,
  "El alta debe enlazar la explicación de privacidad antes de crear una cuenta."
);

requirePattern(
  envExample,
  /DEUNA_ACCOUNT_REGISTRATION_ENABLED=true/,
  ".env.example debe documentar el interruptor de registro."
);
requirePattern(
  envExample,
  /producción:[\s\S]*cierra el registro por defecto/s,
  ".env.example debe dejar claro el comportamiento seguro por defecto en producción."
);
requirePattern(
  privacyPage,
  /index: false[\s\S]*follow: false/s,
  "El aviso técnico de privacidad debe continuar no indexado antes del cierre jurídico."
);

requirePattern(
  backupTool,
  /homedir\(\),[\s\S]*"\.deuna",[\s\S]*"backups"/s,
  "Los backups locales deben guardarse fuera del repositorio."
);
requirePattern(
  backupTool,
  /mode: 0o700/,
  "El directorio de backups debe crearse con permisos 0700."
);
requirePattern(
  backupTool,
  /chmodSync\(backupDirectory, 0o700\)/,
  "El directorio de backups debe reforzar permisos 0700."
);
requirePattern(
  backupTool,
  /"--format=custom"/,
  "El backup debe usar formato custom de pg_dump."
);
requirePattern(
  backupTool,
  /"--no-owner"[\s\S]*"--no-acl"/s,
  "El dump no debe arrastrar owner/ACL del entorno origen."
);
requirePattern(
  backupTool,
  /chmodSync\(backupPath, 0o600\)/,
  "El archivo de backup debe quedar con permisos 0600."
);
requirePattern(
  backupTool,
  /spawnSync\([\s\S]*"pg_restore"[\s\S]*\["--list", backupPath\]/s,
  "El backup debe verificarse con pg_restore --list."
);
requirePattern(
  backupTool,
  /rmSync\(backupPath, \{ force: true \}\)/,
  "Un backup inválido debe eliminarse en lugar de conservarse como copia aparente."
);
forbidPattern(
  backupTool,
  /console\.(?:log|error)\([^\n]*(?:password|PGPASSWORD|DEUNA_DATABASE_MIGRATION_PASSWORD)/i,
  "La herramienta de backup no debe imprimir credenciales."
);

requirePattern(
  upgradeRunbook,
  /npm run admin:backup-local/,
  "El runbook 010→011 debe exigir backup antes de migrar."
);

requirePattern(
  nginx,
  /zone=deuna_account_auth:10m rate=10r\/m/,
  "Nginx debe reservar un rate limit estricto y efímero para login, registro y recuperación."
);
requirePattern(
  nginx,
  /location ~ \^\/api\/account\/\(login\|register\|recover\)\$/,
  "Las rutas públicas con KDF de contraseña deben usar el rate limit específico de autenticación."
);
requirePattern(
  nginx,
  /location \/api\/account\//,
  "Las acciones autenticadas de cuenta deben tener un presupuesto separado del login."
);
requirePattern(
  upgradeRunbook,
  /Backup local PostgreSQL: OK/,
  "El runbook debe exigir confirmación explícita de backup verificado."
);
requirePattern(
  upgradeRunbook,
  /DEUNA_ACCOUNT_REGISTRATION_ENABLED/,
  "El runbook debe documentar el gate de registro antes del lanzamiento público."
);

if (issues.length > 0) {
  console.error("\nPreparación de lanzamiento de cuentas: ERROR\n");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  "Preparación de lanzamiento de cuentas: OK (registro cerrado por defecto en producción, transparencia previa al alta y backup local protegido/verificado)."
);
