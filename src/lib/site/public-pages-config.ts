import "server-only";

import { cache } from "react";

import {
  PUBLIC_PAGES_EDITORIAL_KEY,
  sourcePublicPagesConfig,
  type PublicPagesConfig,
} from "@/data/public-pages-config";
import {
  adminQuery,
} from "@/lib/admin/database";
import {
  parseEditorialPayload,
} from "@/lib/admin/content-validation";

type PublishedPublicPagesRow = {
  published_payload: unknown;
};

function sourceFallback(): PublicPagesConfig {
  return structuredClone(sourcePublicPagesConfig);
}

async function readPublishedPublicPagesConfig() {
  const result =
    await adminQuery<PublishedPublicPagesRow>(
      `SELECT published_payload
         FROM deuna_admin.editorial_items
        WHERE item_type = 'public_pages_config'
          AND item_key = $1
          AND public_visible = true
        LIMIT 1`,
      [PUBLIC_PAGES_EDITORIAL_KEY]
    );
  const row = result.rows[0];

  if (!row) return null;

  return parseEditorialPayload(
    "public_pages_config",
    row.published_payload
  );
}

export const getPublicPagesConfig = cache(
  async (): Promise<PublicPagesConfig> => {
    try {
      return (
        (await readPublishedPublicPagesConfig()) ??
        sourceFallback()
      );
    } catch {
      /*
       * La presentación fuente es un fallback deliberado. Una base
       * editorial no disponible nunca debe romper las rutas públicas.
       */
      return sourceFallback();
    }
  }
);
