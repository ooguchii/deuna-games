import { readFile } from "node:fs/promises";

const files = {
  navigation: "src/components/admin/AdminNavigation.tsx",
  contextBar: "src/components/admin/AdminContextBar.tsx",
  catalog: "src/components/admin/AdminGamesCatalog.tsx",
  workspace:
    "src/app/admin/(protected)/juegos/[slug]/actualizacion/page.tsx",
  route:
    "src/app/api/admin/content/games/[slug]/publish-update/route.ts",
  gameCoreRoute:
    "src/app/api/admin/content/games/[slug]/route.ts",
  gameDownloadRoute:
    "src/app/api/admin/content/games/[slug]/download/route.ts",
  notices: "src/components/admin/EditorStateNotice.tsx",
  service:
    "src/lib/admin/game-update-publication-service.ts",
  legacyIndex:
    "src/app/admin/(protected)/actualizaciones/page.tsx",
  legacyCreate:
    "src/app/admin/(protected)/actualizaciones/nueva/page.tsx",
  legacyEditor:
    "src/app/admin/(protected)/actualizaciones/[id]/page.tsx",
  publicUpdates: "src/lib/updates/public-updates.ts",
  publicGame: "src/app/juegos/[slug]/page.tsx",
};

const entries = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [
      key,
      await readFile(path, "utf8"),
    ])
  )
);

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(
  !entries.navigation.includes('href: "/admin/actualizaciones"'),
  "Actualizaciones no debe seguir como módulo principal del menú administrativo."
);
expect(
  entries.contextBar.includes('id: "actualizacion"') &&
    entries.contextBar.includes("/actualizacion") &&
    entries.contextBar.includes("publicacion|actualizacion"),
  "Actualizar debe formar parte real de la navegación contextual del juego."
);
expect(
  entries.catalog.includes("/actualizacion") &&
    entries.catalog.includes("Actualizar"),
  "El catálogo de juegos debe ofrecer la acción Actualizar por juego."
);
expect(
  entries.workspace.includes("Publicar actualización") &&
    entries.workspace.includes("GameDownloadEditor") &&
    entries.workspace.includes("expectedRevision") &&
    entries.workspace.includes("getPublicGameBySlug"),
  "El espacio de actualización debe integrar versión, descargas, control de revisión y mostrar la referencia realmente pública."
);
expect(
  entries.route.includes("publishIntegratedGameUpdate") &&
    entries.route.includes("revalidatePublicGameSurfaces") &&
    entries.route.includes("hasExactAdminFormFields"),
  "La ruta unificada debe usar publicación atómica, revalidación y protección exacta del formulario."
);
expect(
  entries.gameCoreRoute.includes("getGamePublicationIdentity") &&
    entries.gameCoreRoute.includes("version-por-actualizacion"),
  "La ficha normal de un juego publicado no debe permitir cambiar versión evitando el flujo de Actualizar."
);
expect(
  entries.gameDownloadRoute.includes("saveGameDownloadDraft") &&
    !entries.gameDownloadRoute.includes("descargas-por-actualizacion") &&
    entries.notices.includes("mantenimiento de mirrors"),
  "Descargas debe seguir disponible para mantenimiento operativo de mirrors sin obligar a inventar una versión nueva."
);
expect(
  entries.service.includes("withAdminTransaction") &&
    entries.service.includes("FOR UPDATE") &&
    entries.service.includes('outcome: "pending_changes"') &&
    entries.service.includes('outcome: "same_version"') &&
    entries.service.includes("resolveGameDownload") &&
    entries.service.includes("normalizeVersionToken") &&
    entries.service.includes("versionAlreadyRegistered") &&
    entries.service.includes('"game_update"'),
  "La publicación integrada debe bloquear concurrencia, cambios pendientes, versiones equivalentes o históricas y publicar juego + aviso en una transacción."
);
expect(
  entries.legacyIndex.includes('redirect("/admin/juegos")') &&
    entries.legacyCreate.includes('redirect("/admin/juegos")'),
  "Los flujos globales antiguos deben redirigir a Juegos para evitar dos experiencias de actualización."
);
expect(
  entries.legacyEditor.includes("publicationState?.publicVisible") &&
    entries.legacyEditor.includes("!publicationState.hasUnpublishedChanges") &&
    entries.legacyEditor.includes("/actualizacion"),
  "El editor antiguo sólo debe quedar como compatibilidad para borradores históricos no resueltos."
);
expect(
  entries.publicUpdates.includes("getPublicResolvedUpdates") &&
    entries.publicGame.includes("getPublicUpdatesForGame"),
  "La página pública de Actualizaciones y el historial del juego deben conservarse."
);

if (failures.length > 0) {
  console.error("Actualizaciones integradas: REGRESIÓN\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Actualizaciones integradas: OK (URL estable, nueva versión + descargas + aviso atómicos, mantenimiento de mirrors separado, duplicados bloqueados, historial público preservado y navegación administrativa simplificada)."
);
