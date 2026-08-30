import "server-only";

import { cache } from "react";

import {
  sourceHomeConfig,
  type HomeConfig,
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

function sourceFallback(): HomeConfig {
  return {
    heroSlugs: [...sourceHomeConfig.heroSlugs],
    popularSlugs: [...sourceHomeConfig.popularSlugs],
    lowSpecSlugs: [...sourceHomeConfig.lowSpecSlugs],
    recommendedSlugs: [
      ...sourceHomeConfig.recommendedSlugs,
    ],
  };
}

async function readPublishedHomeConfig() {
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
  async (): Promise<HomeConfig> => {
    try {
      return (
        (await readPublishedHomeConfig()) ??
        sourceFallback()
      );
    } catch {
      return sourceFallback();
    }
  }
);
