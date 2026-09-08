import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const failures = [];

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidPattern(source, pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

const [
  avatarMigration,
  avatarRoute,
  avatarSecurity,
  avatarService,
  accountDashboard,
  headerClient,
  favoriteRoute,
  favoriteService,
  favoriteStore,
  finder,
  universalCard,
] = await Promise.all([
  read("database/migrations/013_account_avatars.sql"),
  read("src/app/api/account/avatar/route.ts"),
  read("src/lib/accounts/avatar-request-security.ts"),
  read("src/lib/accounts/avatar-service.ts"),
  read("src/app/cuenta/AccountDashboardClient.tsx"),
  read("src/components/layout/HeaderClient.tsx"),
  read("src/app/api/account/favorites/route.ts"),
  read("src/lib/accounts/favorite-service.ts"),
  read("src/features/favorites/favorite-store.ts"),
  read("src/features/game-finder/GameFinderClient.tsx"),
  read("src/components/ui/UniversalGameCard.tsx"),
]);

requirePattern(
  avatarMigration,
  /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+deuna_accounts\.avatars/i,
  "El avatar debe persistirse en una tabla privada de cuentas."
);
requirePattern(
  avatarMigration,
  /REFERENCES\s+deuna_accounts\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i,
  "El avatar debe eliminarse por cascada junto con la cuenta."
);
requirePattern(
  avatarMigration,
  /image_webp\s+bytea\s+NOT\s+NULL/i,
  "El avatar saneado debe almacenarse como bytes WebP privados."
);
requirePattern(
  avatarMigration,
  /octet_length\(image_webp\)\s+BETWEEN\s+20\s+AND\s+524288/i,
  "PostgreSQL debe imponer el límite físico de 512 KiB del avatar."
);
requirePattern(
  avatarMigration,
  /width\s+BETWEEN\s+64\s+AND\s+1024[\s\S]*height\s+BETWEEN\s+64\s+AND\s+1024[\s\S]*width\s*=\s*height/i,
  "PostgreSQL debe imponer dimensiones cuadradas y acotadas del avatar."
);

requirePattern(
  avatarRoute,
  /resolveAccountSession[\s\S]*readAccountSessionToken/,
  "El endpoint de avatar debe resolver la sesión propietaria."
);
requirePattern(
  avatarRoute,
  /readTrustedAccountAvatarForm\(request\)/,
  "La carga del avatar debe validar origen, multipart y tamaño antes de procesar la imagen."
);
requirePattern(
  avatarRoute,
  /sanitizeEditorialWebp\(input\)/,
  "El servidor debe sanear el WebP aunque el cliente ya lo haya convertido."
);
requirePattern(
  avatarRoute,
  /inspectSafeEditorialWebp\(sanitized\)/,
  "El servidor debe volver a inspeccionar el WebP saneado."
);
requirePattern(
  avatarRoute,
  /"Cache-Control":\s*"private, no-store, max-age=0"/,
  "La lectura del avatar debe ser privada y no cacheable."
);
requirePattern(
  avatarRoute,
  /"X-Content-Type-Options":\s*"nosniff"/,
  "La respuesta binaria del avatar debe impedir MIME sniffing."
);
forbidPattern(
  avatarRoute,
  /public\/|editorial-media|media-library/i,
  "El avatar privado no puede entrar en la librería multimedia pública/editorial."
);

requirePattern(
  avatarSecurity,
  /hasTrustedAccountOrigin\(request\)/,
  "La carga del avatar debe exigir mismo origen."
);
requirePattern(
  avatarSecurity,
  /MAX_ACCOUNT_AVATAR_REQUEST_BYTES\s*=\s*640\s*\*\s*1024/,
  "La petición multipart del avatar debe tener un límite estricto previo al parseo."
);
requirePattern(
  avatarSecurity,
  /keys\.length\s*!==\s*1[\s\S]*keys\[0\]\s*!==\s*"image"/,
  "El formulario del avatar debe aceptar exactamente un único campo image."
);

for (const operation of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
  requirePattern(
    avatarService,
    new RegExp(`${operation}[\\s\\S]*deuna_accounts\\.avatars[\\s\\S]*user_id\\s*=\\s*\\$1`, "i"),
    `El servicio de avatar debe acotar ${operation} por el user_id autenticado.`
  );
}
requirePattern(
  accountDashboard,
  /AccountAvatarEditor/,
  "Mi DeUna → Perfil debe integrar el editor de avatar privado."
);
requirePattern(
  headerClient,
  /\/api\/account\/avatar/,
  "El Header autenticado debe consumir el avatar privado de la propia sesión."
);

requirePattern(
  favoriteRoute,
  /hasExactAccountFormFields\(form,\s*fields\)/,
  "La escritura de favoritos debe rechazar campos inesperados."
);
requirePattern(
  favoriteRoute,
  /readTrustedAccountForm\(request\)/,
  "La escritura de favoritos debe validar mismo origen."
);
requirePattern(
  favoriteRoute,
  /getPublicGames\(\)/,
  "Favoritos sólo puede aceptar slugs publicados del catálogo público."
);
requirePattern(
  favoriteService,
  /ON\s+CONFLICT\s*\(user_id,\s*game_slug\)[\s\S]*DO\s+UPDATE\s+SET[\s\S]*favorite\s*=\s*true/i,
  "Activar favorito debe ser idempotente ante concurrencia."
);
requirePattern(
  favoriteService,
  /UPDATE\s+deuna_accounts\.game_preferences[\s\S]*SET\s+favorite\s*=\s*false/i,
  "Desactivar favorito debe modificar sólo la señal favorite antes de decidir si limpia la fila."
);
requirePattern(
  favoriteService,
  /library_state\s+IS\s+NULL[\s\S]*follow_updates\s*=\s*false/i,
  "La limpieza de una preferencia sin favorito debe preservar biblioteca y seguimiento."
);
forbidPattern(
  favoriteService,
  /SET[\s\S]{0,180}library_state\s*=/i,
  "El servicio específico de favorito no puede reescribir library_state."
);
forbidPattern(
  favoriteService,
  /SET[\s\S]{0,180}follow_updates\s*=/i,
  "El servicio específico de favorito no puede reescribir follow_updates."
);

requirePattern(
  favoriteStore,
  /deuna-games:finder-favorites:v2/,
  "El fallback de invitado debe conservar la clave histórica de favoritos."
);
requirePattern(
  favoriteStore,
  /fetch\("\/api\/account\/favorites"/,
  "El store compartido debe sincronizar favoritos autenticados con la API de cuenta."
);
requirePattern(
  favoriteStore,
  /await\s+refreshFavoriteStore\(\)[\s\S]*const\s+wasFavorite/,
  "Cada escritura debe confirmar primero si la autoridad actual es cuenta o invitado."
);
forbidPattern(
  favoriteStore,
  /lastRefreshAt|Date\.now\(\)\s*-\s*lastRefreshAt/,
  "Favoritos no puede conservar una ventana de sesión obsoleta entre login y logout."
);

requirePattern(
  finder,
  /useFavoriteGame/,
  "Por requisitos debe consumir el mismo store de favoritos que las tarjetas públicas."
);
forbidPattern(
  finder,
  /FAVORITES_STORAGE_KEY|readStoredFavorites|setFavorites\(|favoritesHydrated/,
  "Por requisitos no puede mantener un segundo estado o persistencia paralela de favoritos."
);
requirePattern(
  universalCard,
  /GameFavoriteButton/,
  "Inicio y Juegos deben usar el control canónico de favorito."
);

if (failures.length > 0) {
  console.error("\nAvatar y favoritos de cuenta: ERROR\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Avatar y favoritos de cuenta: OK (avatar privado/saneado/cascade, permisos de propietario y favoritos unificados sin pisar biblioteca ni seguimiento)."
);
