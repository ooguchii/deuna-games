import "server-only";

import { cache } from "react";

import {
  sourceAboutConfig,
} from "@/data/about-config";
import {
  adminQuery,
} from "@/lib/admin/database";
import {
  parseEditorialPayload,
  type EditorialAboutConfig,
} from "@/lib/admin/content-validation";

type PublishedAboutConfigRow = {
  published_payload: unknown;
};

function sourceFallback(): EditorialAboutConfig {
  return {
    hero: {
      title: sourceAboutConfig.hero.title,
      highlight: sourceAboutConfig.hero.highlight,
      text: sourceAboutConfig.hero.text,
      signals: sourceAboutConfig.hero.signals.map(
        (signal) => ({ ...signal })
      ),
    },
    intro: {
      title: sourceAboutConfig.intro.title,
      highlight: sourceAboutConfig.intro.highlight,
      paragraphs: [...sourceAboutConfig.intro.paragraphs],
    },
    principles: sourceAboutConfig.principles.map(
      (principle) => ({ ...principle })
    ),
    reason: {
      title: sourceAboutConfig.reason.title,
      highlight: sourceAboutConfig.reason.highlight,
      paragraphs: [...sourceAboutConfig.reason.paragraphs],
    },
    ecosystem: sourceAboutConfig.ecosystem.map(
      (item) => ({ ...item })
    ),
    manifesto: {
      ...sourceAboutConfig.manifesto,
    },
    ctaTitle: sourceAboutConfig.ctaTitle,
  };
}

async function readPublishedAboutConfig() {
  const result =
    await adminQuery<PublishedAboutConfigRow>(
      `SELECT published_payload
         FROM deuna_admin.editorial_items
        WHERE item_type = 'about_config'
          AND item_key = 'about'
          AND public_visible = true
        LIMIT 1`
    );
  const row = result.rows[0];

  if (!row) return null;

  return parseEditorialPayload(
    "about_config",
    row.published_payload
  );
}

export const getPublicAboutConfig = cache(
  async (): Promise<EditorialAboutConfig> => {
    try {
      return (
        (await readPublishedAboutConfig()) ??
        sourceFallback()
      );
    } catch {
      return sourceFallback();
    }
  }
);
