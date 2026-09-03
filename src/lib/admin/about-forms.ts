import { z } from "zod";

import {
  expectedRevisionSchema,
} from "./content-forms";

const title = z.string().trim().min(1).max(180);
const copy = z.string().trim().min(1).max(500);
const eyebrow = z.string().trim().min(1).max(60);

export const aboutHeroFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  heroTitle: title,
  heroHighlight: title,
  heroText: copy,
  signal1Title: title,
  signal1Text: copy,
  signal2Title: title,
  signal2Text: copy,
  signal3Title: title,
  signal3Text: copy,
});

export const aboutPrinciplesFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  introTitle: title,
  introHighlight: title,
  introParagraph1: copy,
  introParagraph2: copy,
  principle1Eyebrow: eyebrow,
  principle1Title: title,
  principle1Text: copy,
  principle2Eyebrow: eyebrow,
  principle2Title: title,
  principle2Text: copy,
  principle3Eyebrow: eyebrow,
  principle3Title: title,
  principle3Text: copy,
});

export const aboutReasonFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  reasonTitle: title,
  reasonHighlight: title,
  reasonParagraph1: copy,
  reasonParagraph2: copy,
  ecosystem1Title: title,
  ecosystem1Text: copy,
  ecosystem2Title: title,
  ecosystem2Text: copy,
  ecosystem3Title: title,
  ecosystem3Text: copy,
});

export const aboutManifestoFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  manifestoTitle: title,
  manifestoHighlight: title,
  manifestoText: copy,
  ctaTitle: title,
});
