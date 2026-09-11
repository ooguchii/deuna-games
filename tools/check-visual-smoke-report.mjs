import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDir = path.resolve(
  process.env.DEUNA_VISUAL_OUTPUT_DIR ??
  "artifacts/visual-smoke"
);
const reportPath = path.join(outputDir, "report.json");
const sitewideReportPath = path.join(
  outputDir,
  "sitewide",
  "report.json"
);

const [report, sitewideReport] = await Promise.all([
  readFile(reportPath, "utf8").then(JSON.parse),
  readFile(sitewideReportPath, "utf8").then(JSON.parse),
]);

if (!Array.isArray(report.results)) {
  throw new Error(
    "El reporte visual no contiene una lista de resultados válida."
  );
}

if (!Array.isArray(sitewideReport.results)) {
  throw new Error(
    "El reporte browser global no contiene una lista de resultados válida."
  );
}

const regressions = report.results.filter((result) =>
  typeof result?.page === "string" &&
  result.page.startsWith("admin-") &&
  result.viewport === "mobile" &&
  Array.isArray(result.audit?.smallTouchTargets) &&
  result.audit.smallTouchTargets.length > 0
);

const expectedHomeViewports = [
  "desktop",
  "tablet",
  "mobile",
];
const homeHeadingFailures = [];

for (const viewport of expectedHomeViewports) {
  const matches = sitewideReport.results.filter((result) =>
    result?.page === "public-home" &&
    result.viewport === viewport
  );

  if (matches.length !== 1) {
    homeHeadingFailures.push(
      `${viewport}: se esperaban 1 resultado de Home y aparecieron ${matches.length}.`
    );
    continue;
  }

  const h1Count = matches[0]?.audit?.h1Count;
  if (h1Count !== 1) {
    homeHeadingFailures.push(
      `${viewport}: h1Count=${String(h1Count)}; se esperaba exactamente 1.`
    );
  }
}

let blocked = false;

if (regressions.length > 0) {
  blocked = true;
  console.error("\nTargets táctiles del Admin: REGRESIÓN\n");
  for (const result of regressions) {
    console.error(
      `- ${result.page}: ${JSON.stringify(result.audit.smallTouchTargets)}`
    );
  }
}

if (homeHeadingFailures.length > 0) {
  blocked = true;
  console.error("\nJerarquía H1 de Home: REGRESIÓN\n");
  for (const failure of homeHeadingFailures) {
    console.error(`- ${failure}`);
  }
}

if (blocked) {
  process.exit(1);
}

console.log(
  "Targets táctiles del Admin: OK (vistas mobile del smoke sin controles visuales interactivos menores a 44px)."
);
console.log(
  "Jerarquía H1 de Home: OK (1 H1 canónico en desktop/tablet/mobile)."
);
