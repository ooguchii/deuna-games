import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import "./universal-game-card-3d-browser-smoke.mjs";

const outputDir = path.resolve(
  process.env.DEUNA_VISUAL_OUTPUT_DIR ??
  "artifacts/visual-smoke"
);
const reportPath = path.join(outputDir, "report.json");

const report = JSON.parse(
  await readFile(reportPath, "utf8")
);

if (!Array.isArray(report.results)) {
  throw new Error(
    "El reporte visual no contiene una lista de resultados válida."
  );
}

const regressions = report.results.filter((result) =>
  typeof result?.page === "string" &&
  result.page.startsWith("admin-") &&
  result.viewport === "mobile" &&
  Array.isArray(result.audit?.smallTouchTargets) &&
  result.audit.smallTouchTargets.length > 0
);

if (regressions.length > 0) {
  console.error("\nTargets táctiles del Admin: REGRESIÓN\n");
  for (const result of regressions) {
    console.error(
      `- ${result.page}: ${JSON.stringify(result.audit.smallTouchTargets)}`
    );
  }
  process.exit(1);
}

console.log(
  "Targets táctiles del Admin: OK (vistas mobile del smoke sin controles visuales interactivos menores a 44px)."
);
