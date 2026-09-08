import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const state = read("src/lib/accounts/avatar-client-state.ts");
const header = read("src/components/layout/HeaderClient.tsx");
const editor = read("src/app/cuenta/AccountAvatarEditor.tsx");
const errors = [];

function requireMatch(condition, message) {
  if (!condition) errors.push(message);
}

requireMatch(
  /useSyncExternalStore/.test(state),
  "El avatar debe exponer una suscripción React estable mediante useSyncExternalStore."
);
requireMatch(
  /__deunaAccountAvatarRevision/.test(state) &&
    /window\.dispatchEvent/.test(state) &&
    /window\.addEventListener/.test(state),
  "La revisión del avatar debe vivir en memoria global del navegador y notificar por evento entre entradas cliente."
);
requireMatch(
  !/\blet\s+revision\s*=/.test(state),
  "La sincronización del avatar no puede depender de un singleton de módulo que pueda duplicarse entre chunks cliente."
);
requireMatch(
  !/localStorage|sessionStorage|indexedDB/i.test(state),
  "La revisión cliente del avatar no debe persistirse en storage."
);
requireMatch(
  /useAccountAvatarRevision/.test(header) &&
    /\/api\/account\/avatar\?r=\$\{revision\}/.test(header),
  "El Header debe reaccionar a la revisión compartida y volver a leer el avatar privado sin cache."
);
requireMatch(
  /notifyAccountAvatarChanged/.test(editor),
  "El editor debe publicar el cambio sólo después de una mutación de avatar exitosa."
);
requireMatch(
  /setMessage\("Foto de perfil actualizada\."\)[\s\S]*refreshAvatarState\(\)/.test(editor) &&
    /setMessage\("Foto de perfil eliminada\."\)[\s\S]*refreshAvatarState\(\)/.test(editor),
  "Alta y eliminación deben invalidar el avatar del Header tras confirmar el servidor."
);

if (errors.length > 0) {
  console.error("\nSincronización cliente del avatar: ERROR\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  "Sincronización cliente del avatar: OK (snapshot global en memoria, evento entre chunks y sin storage persistente)."
);
