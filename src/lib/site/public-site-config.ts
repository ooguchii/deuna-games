import "server-only";

import { cache } from "react";

import {
  adminQuery,
} from "@/lib/admin/database";
import {
  parseEditorialPayload,
  type EditorialSiteConfig,
} from "@/lib/admin/content-validation";
import {
  siteConfig as sourceSiteConfig,
} from "@/lib/site";

type PublishedSiteConfigRow = {
  published_payload: unknown;
};

export type PublicSiteConfig = Omit<
  EditorialSiteConfig,
  "footerTagline" | "brandColor"
> & {
  footerTagline: string;
  brandColor: string;
};

function sourceFallback(): PublicSiteConfig {
  return {
    ...sourceSiteConfig,
  };
}

async function readPublishedSiteConfig() {
  const result =
    await adminQuery<PublishedSiteConfigRow>(
      `SELECT published_payload
         FROM deuna_admin.editorial_items
        WHERE item_type = 'site_config'
          AND item_key = 'site'
          AND public_visible = true
        LIMIT 1`
    );
  const row = result.rows[0];

  if (!row) return null;

  return parseEditorialPayload(
    "site_config",
    row.published_payload
  );
}

export const getPublicSiteConfig = cache(
  async (): Promise<PublicSiteConfig> => {
    try {
      const published = await readPublishedSiteConfig();
      return {
        ...sourceFallback(),
        ...(published ?? {}),
      };
    } catch {
      /*
       * La identidad fuente es un fallback deliberado. Una caída de
       * PostgreSQL o una migración aún no aplicada nunca debe romper
       * metadata, manifest, Header, Footer ni la navegación pública.
       */
      return sourceFallback();
    }
  }
);
