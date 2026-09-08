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

const [clientState, headerClient, avatarEditor] = await Promise.all([
  source("src/lib/accounts/avatar-client-state.ts"),
  source("src/components/layout/HeaderClient.tsx"),
  source("src/app/cuenta/AccountAvatarEditor.tsx"),
]);

assert(
  clientState.includes("useSyncExternalStore") &&
    clientState.includes("notifyAccountAvatarChanged") &&
    clientState.includes("useAccountAvatarRevision") &&
    clientState.includes("__deunaAccountAvatarRevision") &&
    clientState.includes("window.addEventListener") &&
    clientState.includes("window.dispatchEvent"),
  "La sincronización de avatar debe conservar un snapshot global en memoria y una suscripción observable entre entradas cliente."
);

assert(
  !/\blet\s+revision\s*=/.test(clientState) &&
    !/localStorage|sessionStorage|indexedDB/i.test(clientState),
  "La revisión del avatar no puede depender de un singleton de módulo ni persistirse en storage."
);

assert(
  headerClient.includes("useAccountAvatarRevision") &&
    headerClient.includes("/api/account/avatar") &&
    !headerClient.includes("ACCOUNT_AVATAR_CHANGED_EVENT"),
  "El Header debe consumir sólo el contrato compartido de revisión y releer el avatar privado."
);

assert(
  avatarEditor.includes("notifyAccountAvatarChanged") &&
    !avatarEditor.includes("dispatchEvent") &&
    !avatarEditor.includes("CustomEvent") &&
    !avatarEditor.includes("ACCOUNT_AVATAR_CHANGED_EVENT"),
  "El editor debe invalidar el contrato compartido después de guardar o eliminar el avatar."
);

assert(
  /setMessage\("Foto de perfil actualizada\."\)[\s\S]*refreshAvatarState\(\)/.test(avatarEditor) &&
    /setMessage\("Foto de perfil eliminada\."\)[\s\S]*refreshAvatarState\(\)/.test(avatarEditor),
  "Alta y eliminación deben invalidar el avatar sólo después de confirmar la mutación del servidor."
);

let legacyEventFileExists = true;
try {
  await access(path.join(root, "src/lib/accounts/avatar-events.ts"));
} catch {
  legacyEventFileExists = false;
}
assert(
  !legacyEventFileExists,
  "No debe sobrevivir un segundo contrato de eventos para sincronizar el avatar."
);

if (failures.length > 0) {
  console.error("\nSincronización cliente de avatar: ERROR\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Sincronización cliente de avatar: OK (snapshot global en memoria, evento entre chunks y sin storage persistente)."
);