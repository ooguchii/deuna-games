import { readFile } from "node:fs/promises";

const files = Object.fromEntries(
  await Promise.all(
    Object.entries({
      validation: "src/lib/admin/game-editor-section-validation.ts",
      compatibilityEditor: "src/components/admin/GameCompatibilityEditor.tsx",
      healthOverview: "src/components/admin/GameEditorHealthOverview.tsx",
      valuationRoute: "src/app/api/admin/content/games/[slug]/valuation/route.ts",
      valuationEditor: "src/components/admin/GameValuationEditor.tsx",
      sectionService: "src/lib/admin/game-editor-sections-service.ts",
      insights: "src/lib/admin/game-insights.ts",
      history: "src/lib/admin/game-history.ts",
      historyPanel: "src/components/admin/GameHistoryPanel.tsx",
    }).map(async ([key, path]) => [key, await readFile(path, "utf8")])
  )
);

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  files.validation.includes("hasPcRequirements") &&
    files.validation.includes('platformsJson?.includes("PC")') &&
    files.validation.includes("Los requisitos de hardware son específicos de PC"),
  "Compatibilidad debe rechazar requisitos de hardware si PC no está declarada como plataforma."
);
expect(
  files.compatibilityEditor.includes("legacyPcMismatch") &&
    files.compatibilityEditor.includes("borrador histórico") &&
    files.compatibilityEditor.includes("declarar PC") &&
    files.compatibilityEditor.includes("retirar esos requisitos"),
  "Compatibilidad debe advertir y permitir corregir snapshots históricos con requisitos PC contradictorios."
);

expect(
  files.healthOverview.includes("/publicacion") &&
    files.healthOverview.includes("Publicación") &&
    files.healthOverview.includes("readiness.essentialsReady") &&
    files.healthOverview.includes("Bloqueos pendientes") &&
    files.healthOverview.includes("Historial"),
  "El tablero global debe enlazar Publicación explícitamente y conservar Historial como auditoría separada."
);

expect(
  files.validation.includes('valuationMode: z.enum(["manual", "insight"])'),
  "Valoración debe distinguir explícitamente el modo manual de la sugerencia del Índice."
);
expect(
  files.valuationRoute.includes("getGameInsights") &&
    files.valuationRoute.includes('valuationMode === "insight"') &&
    files.valuationRoute.includes('confidence === "low"') &&
    files.valuationRoute.includes("nextRating = insightRating(insights.index.score)") &&
    files.valuationRoute.includes("insightEvidenceCount"),
  "La sugerencia de Valoración debe recalcularse en servidor, bloquear confianza baja y conservar evidencias en auditoría."
);
expect(
  files.valuationEditor.includes('name="valuationMode" value="manual"') &&
    files.valuationEditor.includes('name="valuationMode" value="insight"') &&
    files.valuationEditor.includes('name="rating" value=""') &&
    files.valuationEditor.includes("disabled={!suggestionReady}") &&
    files.valuationEditor.includes("al menos 25 evidencias agregadas"),
  "La UI de Valoración no debe enviar una sugerencia confiable desde el navegador ni habilitarla con evidencia baja."
);
expect(
  files.sectionService.includes('valuationSource: "manual" | "insight"') &&
    files.sectionService.includes("insightScore") &&
    files.sectionService.includes("insightConfidence") &&
    files.sectionService.includes("insightEvidenceCount") &&
    files.sectionService.includes("auditDetails"),
  "La revisión de Valoración debe registrar el origen y la evidencia de una sugerencia automática."
);
expect(
  files.insights.includes("evidenceCount >= 250 && ratingCount >= 25") &&
    files.insights.includes("evidenceCount >= 25") &&
    files.insights.includes('return "medium"') &&
    files.insights.includes('return "low"'),
  "El umbral de confianza del Índice debe permanecer explícito y auditable."
);

for (const field of [
  "ageRating",
  "compatibilityMetadata",
  "performanceMetadata",
  "mediaAccessibility",
  "distributionMetadata",
]) {
  expect(
    files.history.includes(`["${field}"`),
    `Historial debe rastrear ${field}.`
  );
}
expect(
  files.history.includes("JSON.stringify(value)") &&
    files.history.includes("Configuración modificada"),
  "Historial debe intentar mostrar cambios complejos reales antes de degradar a un mensaje genérico."
);
expect(
  files.historyPanel.includes('timeZone: "America/Argentina/Buenos_Aires"') &&
    files.historyPanel.includes("ART") &&
    !files.historyPanel.includes('timeZone: "UTC"'),
  "Historial administrativo debe mostrar revisiones y publicaciones en horario de Argentina."
);

if (failures.length > 0) {
  console.error("Auditoría transversal del editor: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Auditoría transversal del editor: OK (Compatibilidad coherente, Publicación visible, sugerencias servidor-autoritativas, Historial ampliado y hora Argentina)."
);
