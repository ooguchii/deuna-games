import "server-only";

import { parseEditorialPayload } from "./content-validation";
import { adminQuery } from "./database";
import { listGameVideoReferences } from "./game-media-integrity";
import { verifyAdminSession } from "./session";

type PublishedGamePayloadRow = {
  published_payload: unknown;
  public_visible: boolean;
};

export async function getPublishedGameVideoReferences(
  key: string
) {
  await verifyAdminSession();

  const result = await adminQuery<PublishedGamePayloadRow>(
    `SELECT
       published_payload,
       public_visible
     FROM deuna_admin.editorial_items
     WHERE item_type = 'game'
       AND item_key = $1
     LIMIT 1`,
    [key]
  );
  const row = result.rows[0];

  if (!row?.public_visible) return [];

  try {
    return listGameVideoReferences(
      parseEditorialPayload("game", row.published_payload)
    );
  } catch {
    return [];
  }
}
