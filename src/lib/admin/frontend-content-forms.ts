import { z } from "zod";

import {
  editorialHomeConfigSchema,
  editorialPublicPagesConfigSchema,
  editorialSiteConfigSchema,
} from "./content-validation";
import {
  expectedRevisionSchema,
} from "./content-forms";

function jsonField(maximum: number) {
  return z
    .string()
    .max(maximum)
    .transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({
          code: "custom",
          message: "El contenido estructurado no contiene JSON válido.",
        });
        return z.NEVER;
      }
    });
}

const siteFields = editorialSiteConfigSchema.extend({
  footerTagline: z.string().trim().min(1).max(180),
});

export const frontendSiteConfigFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
  })
  .merge(siteFields);

const homePresentationSchema = editorialHomeConfigSchema
  .pick({
    sections: true,
    copy: true,
  })
  .required();

export const homePresentationFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  presentationJson: jsonField(24_000).pipe(
    homePresentationSchema
  ),
});

export const publicGamesFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
  })
  .merge(editorialPublicPagesConfigSchema.shape.games);

export const publicUpdatesFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
  })
  .merge(editorialPublicPagesConfigSchema.shape.updates);

export const publicFinderFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
  })
  .merge(editorialPublicPagesConfigSchema.shape.finder);
