import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { sourceHomeConfig } from "../src/data/home-config.ts";
import {
  homeHeroPresentationEditorSchema,
  homeHeroPresentationInputSchema,
} from "../src/lib/home/hero-schema.ts";

const failures = [];
const root = process.cwd();

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function clone(value) {
  return structuredClone(value);
}

const current = clone(sourceHomeConfig.heroPresentation);
assert(
  homeHeroPresentationEditorSchema.safeParse(current).success,
  "La presentación fuente del Hero debe cumplir el contrato completo del editor."
);
assert(
  homeHeroPresentationInputSchema.safeParse(current).success,
  "La presentación fuente del Hero debe ser válida como revisión persistida."
);

const legacy = {
  composition: current.composition,
  previewCount: current.previewCount,
  motion: current.motion,
  autoplayMs: current.autoplayMs,
};
assert(
  homeHeroPresentationInputSchema.safeParse(legacy).success,
  "El contrato persistido debe seguir aceptando revisiones anteriores a los controles visuales nuevos."
);

const oldEditorDraft = clone(current);
delete oldEditorDraft.navigation;
for (const device of ["desktop", "tablet", "mobile"]) {
  delete oldEditorDraft.responsive[device].spaceBefore;
  delete oldEditorDraft.responsive[device].spaceAfter;
  delete oldEditorDraft.responsive[device].spacingReference;
}
const migratedDraft = homeHeroPresentationEditorSchema.safeParse(oldEditorDraft);
assert(
  migratedDraft.success &&
    migratedDraft.data.navigation.style === "segmented-pro" &&
    migratedDraft.data.responsive.desktop.spaceBefore === 28 &&
    migratedDraft.data.responsive.mobile.spaceAfter === 38,
  "El contrato del editor debe migrar borradores locales anteriores sin inventar geometría distinta de los defaults actuales."
);

const invalidScale = clone(current);
invalidScale.positions.main.scale = 1.61;
assert(
  !homeHeroPresentationEditorSchema.safeParse(invalidScale).success &&
    !homeHeroPresentationInputSchema.safeParse(invalidScale).success,
  "Editor y contrato persistido deben rechazar escalas fuera del límite compartido."
);

const invalidFrame = clone(current);
invalidFrame.responsive.desktop.cardWidth = 1801;
assert(
  !homeHeroPresentationEditorSchema.safeParse(invalidFrame).success &&
    !homeHeroPresentationInputSchema.safeParse(invalidFrame).success,
  "Editor y contrato persistido deben rechazar anchos de tarjeta fuera del límite compartido."
);

const unknownPosition = clone(current);
unknownPosition.positions.ghost = clone(current.positions.main);
assert(
  !homeHeroPresentationInputSchema.safeParse(unknownPosition).success,
  "Las revisiones persistidas no deben aceptar posiciones arbitrarias fuera del contrato del Hero."
);

const formSource = await readFile(
  path.join(root, "src/lib/admin/home-config-forms.ts"),
  "utf8"
);
assert(
  formSource.includes("homeHeroPresentationEditorSchema") &&
    formSource.includes('from "@/lib/home/hero-schema"') &&
    !formSource.includes("const positionStyleSchema") &&
    !formSource.includes("const heroPresentationSchema") &&
    !formSource.includes("const navigationStyles"),
  "Los formularios del Hero deben consumir el contrato compartido y no reintroducir una segunda copia de sus límites."
);

if (failures.length > 0) {
  console.error("\nHero schema: BLOQUEADO\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Hero schema: OK (contrato actual único, límites compartidos y compatibilidad de borradores antiguos)."
  );
}
