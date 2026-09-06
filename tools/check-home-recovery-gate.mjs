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

const [curationEditor, presentationEditor] = await Promise.all([
  source("src/components/admin/HomeCurationEditor.tsx"),
  source("src/components/admin/HomePresentationEditor.tsx"),
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

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Home recovery gate: ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    "Home recovery gate: OK (cualquier copia pendiente exige Recuperar/Descartar antes de editar y una copia obsoleta nunca puede rebasarse).",
  );
}
