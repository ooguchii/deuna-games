import { z } from "zod";

import { expectedRevisionSchema } from "./content-forms";
import { editorialGameTaxonomySchema } from "./content-validation";

const taxonomyJsonSchema = z
  .string()
  .max(100_000)
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
