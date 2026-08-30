import "server-only";

import type { Game } from "@/types/game";

import {
  parseEditorialPayload,
} from "./content-validation";
import {
  adminQuery,
} from "./database";
import {
  verifyAdminSession,
} from "./session";

type PublishedGameRow = {
  published_payload: unknown;
};

export async function getPublishedGameSnapshot(
  key: string
): Promise<Game | null> {
  await verifyAdminSession();

  const result = await adminQuery<PublishedGameRow>(
    `SELECT published_payload
     FROM deuna_admin.editorial_items
     WHERE item_type = 'game'
       AND item_key = $1
     LIMIT 1`,
    [key]
  );
  const row = result.rows[0];

  if (!row) return null;

  return parseEditorialPayload(
    "game",
    row.published_payload
  );
}
