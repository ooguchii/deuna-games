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

const headingField = z.string().trim().min(1).max(180);
const labelField = z.string().trim().min(1).max(100);
const paragraphField = z.string().trim().min(1).max(900);

function addIssues(
  context: z.RefinementCtx,
  issues: z.ZodIssue[]
) {
  issues.forEach((issue) => {
    context.addIssue({
      code: "custom",
      path: issue.path,
      message: issue.message,
    });
  });
}

const siteFields = editorialSiteConfigSchema.extend({
  footerTagline: z.string().trim().min(1).max(180),
  brandColor: z.string().regex(/^#[0-9a-f]{6}$/i),
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
    eyebrow: labelField,
    title: headingField,
    description: paragraphField,
    platformLabel: labelField,
    heroImage: z.string().trim().max(400),
  })
  .transform((value, context) => {
    const page =
      editorialPublicPagesConfigSchema.shape.games.safeParse({
        eyebrow: value.eyebrow,
        title: value.title,
        description: value.description,
        platformLabel: value.platformLabel,
        heroImage: value.heroImage || undefined,
      });

    if (!page.success) {
      addIssues(context, page.error.issues);
      return z.NEVER;
    }

    return {
      expectedRevision: value.expectedRevision,
      page: page.data,
    };
  });

export const publicUpdatesFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    eyebrow: labelField,
    title: headingField,
    highlight: headingField,
    description: paragraphField,
    info1Title: headingField,
    info1Text: paragraphField,
    info2Title: headingField,
    info2Text: paragraphField,
    info3Title: headingField,
    info3Text: paragraphField,
  })
  .transform((value, context) => {
    const page =
      editorialPublicPagesConfigSchema.shape.updates.safeParse({
        eyebrow: value.eyebrow,
        title: value.title,
        highlight: value.highlight,
        description: value.description,
        infoCards: [
          {
            title: value.info1Title,
            text: value.info1Text,
          },
          {
            title: value.info2Title,
            text: value.info2Text,
          },
          {
            title: value.info3Title,
            text: value.info3Text,
          },
        ],
      });

    if (!page.success) {
      addIssues(context, page.error.issues);
      return z.NEVER;
    }

    return {
      expectedRevision: value.expectedRevision,
      page: page.data,
    };
  });

export const publicFinderFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    eyebrow: labelField,
    title: headingField,
    highlight: headingField,
    description: paragraphField,
    flow1: labelField,
    flow2: labelField,
    flow3: labelField,
    trustText: paragraphField,
  })
  .transform((value, context) => {
    const page =
      editorialPublicPagesConfigSchema.shape.finder.safeParse({
        eyebrow: value.eyebrow,
        title: value.title,
        highlight: value.highlight,
        description: value.description,
        flow: [
          value.flow1,
          value.flow2,
          value.flow3,
        ],
        trustText: value.trustText,
      });

    if (!page.success) {
      addIssues(context, page.error.issues);
      return z.NEVER;
    }

    return {
      expectedRevision: value.expectedRevision,
      page: page.data,
    };
  });
