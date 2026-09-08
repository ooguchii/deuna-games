import {
  access,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const [
  avatarService,
  headerServer,
  headerClient,
  avatarEditor,
] = await Promise.all([
  source("src/lib/accounts/avatar-service.ts"),
  source("src/components/layout/Header.tsx"),
  source("src/components/layout/HeaderClient.tsx"),
  source("src/app/cuenta/AccountAvatarEditor.tsx"),
]);

assert(
  /getAccountAvatarMetadata[\s\S]*SELECT digest[\s\S]*FROM deuna_accounts\.avatars[\s\S]*WHERE user_id = \$1/.test(avatarService),
  "El Header debe poder consultar sólo la versión del avatar sin cargar el bytea."
);

assert(
  headerServer.includes("getAccountAvatarMetadata") &&
    headerServer.includes("accountAvatarDigest") &&
    headerServer.includes("getAccountAvatarMetadata(session.userId).catch(() => null)"),
  "El Header server debe resolver la versión del avatar desde la sesión y degradar a fallback si esa lectura falla."
);

assert(
  headerClient.includes("accountAvatarDigest") &&
    headerClient.includes("/api/account/avatar?v=") &&
    !headerClient.includes("fetch(") &&
    !headerClient.includes("URL.createObjectURL") &&
    !headerClient.includes("useAccountAvatarRevision"),
  "El Header cliente debe renderizar la URL privada versionada, sin descargar/copiar el avatar a un object URL paralelo."
);

assert(
  avatarEditor.includes("useRouter") &&
    avatarEditor.includes("router.refresh()") &&
    /setMessage\("Foto de perfil actualizada\."\)[\s\S]*refreshAvatarState\(\)/.test(avatarEditor) &&
    /setMessage\("Foto de perfil eliminada\."\)[\s\S]*refreshAvatarState\(\)/.test(avatarEditor),
  "Alta y eliminación deben refrescar Server Components sólo después de confirmar la mutación del avatar."
);

assert(
  !/notifyAccountAvatarChanged|dispatchEvent|CustomEvent|localStorage|sessionStorage|indexedDB/.test(avatarEditor + headerClient),
  "La sincronización del avatar no debe depender de eventos ni persistencia cliente paralela."
);

for (const legacyPath of [
  "src/lib/accounts/avatar-events.ts",
  "src/lib/accounts/avatar-client-state.ts",
]) {
  let exists = true;
  try {
    await access(path.join(root, legacyPath));
  } catch {
    exists = false;
  }
  assert(
    !exists,
    `No debe sobrevivir el contrato cliente obsoleto ${legacyPath}.`
  );
}

if (failures.length > 0) {
  console.error("\nSincronización de avatar con Header: ERROR\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Sincronización de avatar con Header: OK (metadata server-side, refresh RSC y URL privada versionada; sin stores/eventos paralelos)."
);