import { z } from "zod";

import { expectedRevisionSchema } from "./content-forms";
import { editorialGameTaxonomySchema } from "./content-validation";

export const GAME_TAXONOMY_MAX_JSON_CHARS = 100_000;

/*
 * application/x-www-form-urlencoded puede expandir una unidad UTF-16 hasta
 * nueve bytes ASCII (%XX por cada byte UTF-8). Este techo incluye además el
 * campo expectedRevision y los separadores del formulario.
 */
export const GAME_TAXONOMY_MAX_FORM_BYTES =
  "expectedRevision".length +
  1 +
  10 +
  1 +
  "taxonomyJson".length +
  1 +
  GAME_TAXONOMY_MAX_JSON_CHARS * 9;

const taxonomyJsonSchema = z
  .string()
  .max(GAME_TAXONOMY_MAX_JSON_CHARS)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message: "El catálogo no contiene JSON válido.",
      });
      return z.NEVER;
    }
  })
  .pipe(editorialGameTaxonomySchema);

export const gameTaxonomyFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    taxonomyJson: taxonomyJsonSchema,
  })
  .strict();