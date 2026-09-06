import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [curationEditor, presentationEditor, heroBoundary] = await Promise.all([
  source("src/components/admin/HomeCurationEditor.tsx"),
  source("src/components/admin/HomePresentationEditor.tsx"),
  source("src/components/admin/HomeHeroSaveBoundary.tsx"),
]);

for (const [label, editor, minimumInertRegions] of [
  ["Curaduría", curationEditor, 4],
  ["Presentación", presentationEditor, 3],
]) {
  assert(
    editor.includes("const recoveryRequiresDecision = Boolean(recovery)") &&
      !editor.includes("const recoveryIsStale =") &&
      (editor.match(/inert=\{recoveryRequiresDecision\}/g) ?? []).length >=
        minimumInertRegions,
    `${label} debe bloquear sus controles editables mientras exista cualquier copia local pendiente de Recuperar/Descartar.`,
  );

  assert(
    editor.includes("Recupérala o descártala antes de continuar editando") &&
      editor.includes("Descarta la copia para desbloquear la edición de la revisión actual"),
    `${label} debe explicar la decisión requerida tanto para copias de la revisión actual como para copias obsoletas.`,
  );

  assert(
    editor.includes("disabled={!recoveryMatchesRevision}") &&
      editor.includes("if (!recoveryMatchesRevision) return"),
    `${label} nunca debe permitir recuperar una copia obsoleta sobre una revisión posterior.`,
  );
}

assert(
  heroBoundary.includes("function readBlockedHeroRecovery(") &&
    heroBoundary.includes("typeof parsed.revision === \"number\"") &&
    heroBoundary.includes("recoveryRevision === currentRevision") &&
    heroBoundary.includes("return { revision: null }") &&
    heroBoundary.includes("useSyncExternalStore(") &&
    heroBoundary.includes("readBlockedHeroRecoverySnapshot(revision)") &&
    !heroBoundary.includes("setBlockedRecovery("),
  "Hero debe derivar con snapshot SSR estable cualquier copia cuya revisión no coincida o cuyo origen no pueda verificarse, sin setState dentro de efectos.",
);

assert(
  heroBoundary.includes("inert={busy || blockedRecovery !== null || undefined}") &&
    heroBoundary.includes("if (saving.current || blockedRecovery) return") &&
    heroBoundary.includes("Descartar copia obsoleta") &&
    heroBoundary.includes("setDismissedBlockedSnapshot(blockedRecoverySnapshot)"),
  "Hero debe quedar inerte ante una copia obsoleta y sólo desbloquearse mediante descarte explícito.",
);

assert(
  heroBoundary.includes("mantenlos en esta pestaña") &&
    heroBoundary.includes("antes de recargar") &&
    !heroBoundary.includes("recarga y revísalos antes de volver a guardar"),
  "El mensaje de conflicto de Hero no debe sugerir recargar una copia que luego quedaría obsoleta.",
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Home recovery gate: ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    "Home recovery gate: OK (Curaduría/Presentación exigen resolver cualquier copia pendiente y Hero bloquea copias de otra revisión o de origen no verificable con snapshot SSR estable).",
  );
}
