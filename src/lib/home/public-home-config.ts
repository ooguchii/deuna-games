import "server-only";

import { cache } from "react";

import {
  resolveHomeConfig,
  sourceHomeConfig,
  type HomeConfig,
  type ResolvedHomeConfig,
} from "@/data/home-config";
import {
  adminQuery,
} from "@/lib/admin/database";
import {
  parseEditorialPayload,
} from "@/lib/admin/content-validation";

type PublishedHomeConfigRow = {
  published_payload: unknown;
};

function sourceFallback(): ResolvedHomeConfig {
  return resolveHomeConfig(sourceHomeConfig);
}

async function readPublishedHomeConfig(): Promise<HomeConfig | null> {
  const result =
    await adminQuery<PublishedHomeConfigRow>(
      `SELECT published_payload
         FROM deuna_admin.editorial_items
        WHERE item_type = 'home_config'
          AND item_key = 'home'
          AND public_visible = true
        LIMIT 1`
    );
  const row = result.rows[0];

  if (!row) return null;

  return parseEditorialPayload(
    "home_config",
    row.published_payload
  );
}

export const getPublicHomeConfig = cache(
  async (): Promise<ResolvedHomeConfig> => {
    try {
      const published = await readPublishedHomeConfig();
      return published
        ? resolveHomeConfig(published)
        : sourceFallback();
    } catch {
      return sourceFallback();
    }
  }
);
