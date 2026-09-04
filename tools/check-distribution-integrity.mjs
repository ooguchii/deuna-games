import { readFile } from "node:fs/promises";

const files = {
  types: "src/types/game.ts",
  validation: "src/lib/admin/content-validation.ts",
  forms: "src/lib/admin/content-forms.ts",
  service: "src/lib/admin/content-service.ts",
  route: "src/app/api/admin/content/games/[slug]/download/route.ts",
  editor: "src/components/admin/GameDistributionEditor.tsx",
  updateService: "src/lib/admin/game-update-publication-service.ts",
  updateRoute:
    "src/app/api/admin/content/games/[slug]/publish-update/route.ts",
  updatePage:
    "src/app/admin/(protected)/juegos/[slug]/actualizacion/page.tsx",
  resolver: "src/lib/games/download.ts",
  publicPage: "src/app/juegos/[slug]/descargar/page.tsx",
  preview:
    "src/app/admin/(protected)/juegos/[slug]/vista-previa/page.tsx",
  changes: "src/lib/admin/game-publication-changes.ts",
  readiness: "src/lib/admin/game-publication-readiness.ts",
};

const entries = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => [
      key,
      await readFile(file, "utf8"),
    ])
  )
);

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(
  entries.types.includes("export type GameDistributionChannel") &&
    entries.types.includes('"stable"') &&
    entries.types.includes('"beta"') &&
    entries.types.includes('"testing"') &&
    entries.types.includes("checksumSha256?: string") &&
    entries.types.includes("distributionMetadata?: GameDistributionMetadata"),
  "El modelo debe conservar canal y SHA-256 como metadata estructurada del snapshot del juego."
);

expect(
  entries.validation.includes("const distributionMetadataSchema") &&
    entries.validation.includes('z.enum(["stable", "beta", "testing"])') &&
    entries.validation.includes('/^[a-f0-9]{64}$/') &&
    entries.validation.includes("delete clean.distributionMetadata") &&
    entries.validation.includes("...(distributionMetadata ? { distributionMetadata } : {})"),
  "El parser editorial debe validar estrictamente canal/SHA-256 y mantener compatibilidad con snapshots antiguos."
);

expect(
  entries.forms.includes("optionalDistributionChannelSchema") &&
    entries.forms.includes("optionalSha256Schema") &&
    entries.forms.includes("value.toLowerCase()") &&
    entries.forms.includes("channel: optionalDistributionChannelSchema") &&
    entries.forms.includes("checksumSha256: optionalSha256Schema"),
  "El formulario debe aceptar sólo canales conocidos y normalizar un SHA-256 hexadecimal exacto."
);

expect(
  entries.service.includes("distributionMetadata?: GameDistributionMetadata") &&
    entries.service.includes("compactDistributionMetadata") &&
    entries.service.includes("const hasDownload = Object.keys(nextDownload).length > 0") &&
    entries.service.includes("distributionMetadata = hasDownload") &&
    entries.service.includes("distributionMetadata,"),
  "El mantenimiento de Distribución debe guardar o limpiar la integridad dentro de la misma revisión del paquete."
);

expect(
  entries.route.includes('"channel"') &&
    entries.route.includes('"checksumSha256"') &&
    entries.route.includes("hasExactAdminFormFields") &&
    entries.route.includes("distributionMetadata:") &&
    entries.route.includes("saveGameDownloadDraft"),
  "La ruta de Distribución debe usar lista blanca exacta y persistir canal/SHA junto con las descargas."
);

expect(
  entries.editor.includes('name="channel"') &&
    entries.editor.includes('name="checksumSha256"') &&
    entries.editor.includes("SHA-256 del paquete") &&
    entries.editor.includes("todos los mirrors") &&
    entries.editor.includes("evitar SSRF"),
  "El editor debe explicar canal, checksum por paquete y por qué no verifica mirrors arbitrarios desde el servidor."
);

expect(
  entries.updateService.includes("buildDistributionMetadata") &&
    entries.updateService.includes("distributionMetadata: nextDownload") &&
    entries.updateService.includes("input.distributionMetadata") &&
    entries.updateService.includes("checksumConfigured") &&
    entries.updateRoute.includes('"channel"') &&
    entries.updateRoute.includes('"checksumSha256"'),
  "Nueva versión debe reemplazar la integridad atómicamente con versión + descargas + publicación."
);

expect(
  entries.updatePage.includes('name="channel"') &&
    entries.updatePage.includes('name="checksumSha256"') &&
    entries.updatePage.includes("El checksum anterior nunca se hereda") &&
    !/name="checksumSha256"[\s\S]{0,220}defaultValue=/.test(entries.updatePage),
  "Nueva versión no debe precargar silenciosamente el checksum de la versión anterior."
);

expect(
  entries.resolver.includes("channel?: GameDistributionChannel") &&
    entries.resolver.includes("checksumSha256?: string") &&
    entries.resolver.includes("game.distributionMetadata?.channel") &&
    entries.resolver.includes('/^[a-f0-9]{64}$/'),
  "El resolver público debe exponer únicamente metadata de integridad validada."
);

expect(
  entries.publicPage.includes("distributionChannelLabels") &&
    entries.publicPage.includes("SHA-256 del paquete publicado") &&
    entries.publicPage.includes("download.checksumSha256") &&
    entries.publicPage.includes('"A confirmar"'),
  "La página de descarga debe mostrar canal/checksum publicados y mantener datos ausentes como pendientes."
);

expect(
  entries.preview.includes("distributionChannelLabel") &&
    entries.preview.includes("download?.checksumSha256 ?? \"Sin definir\"") &&
    entries.preview.includes("Paquete y fuentes visibles"),
  "La vista previa privada debe mostrar la identidad del paquete antes de publicar."
);

expect(
  entries.changes.includes("metadata: draft.distributionMetadata") &&
    entries.changes.includes("metadata: published.distributionMetadata") &&
    entries.changes.includes("canal o SHA-256"),
  "Publicación debe detectar cambios de integridad aunque las URLs de descarga no cambien."
);

expect(
  entries.readiness.includes('id: "distribution-integrity"') &&
    entries.readiness.includes("game.distributionMetadata?.channel") &&
    entries.readiness.includes("checksumSha256") &&
    entries.readiness.includes('priority: "recommended"'),
  "Readiness debe recomendar canal + SHA-256 sin bloquear publicaciones históricas."
);

expect(
  !entries.editor.includes("fetch(") &&
    !entries.route.includes("fetch(") &&
    !entries.updateService.includes("fetch("),
  "La integridad editorial no debe introducir comprobaciones remotas arbitrarias que abran superficie SSRF."
);

if (failures.length > 0) {
  console.error("Distribución e integridad: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Distribución e integridad: OK (canal + SHA-256 versionados, rotación atómica por versión, preview/público/readiness coherentes y sin verificación remota SSRF)."
);
