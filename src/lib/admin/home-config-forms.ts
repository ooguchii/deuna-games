import { z } from "zod";

import {
  expectedRevisionSchema,
} from "./content-forms";

const slugPattern =
  /^[a-z0-9][a-z0-9._-]*$/;

function slugListSchema(maximum: number) {
  return z
    .string()
    .max(4_000)
    .transform((value) =>
      value
        .split(/[,\r\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .pipe(
      z
        .array(
          z
            .string()
            .min(1)
            .max(160)
            .regex(slugPattern)
        )
        .max(maximum)
        .superRefine((items, context) => {
          const seen = new Set<string>();

          items.forEach((item, index) => {
            if (seen.has(item)) {
              context.addIssue({
                code: "custom",
                path: [index],
                message: "Un slug no puede repetirse dentro de la misma colección.",
              });
            }
            seen.add(item);
          });
        })
    );
}

export const editorialHomeConfigFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    heroSlugsText: slugListSchema(8),
    popularSlugsText: slugListSchema(24),
    lowSpecSlugsText: slugListSchema(24),
    recommendedSlugsText: slugListSchema(24),
  })
  .strict();
