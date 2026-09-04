import "server-only";

import type { Game } from "@/types/game";

import {
  parseEditorialPayload,
} from "@/lib/admin/content-validation";
import {
  adminQuery,
} from "@/lib/admin/database";
import {
  listGameImageReferences,
  listGameVideoReferences,
} from "@/lib/admin/game-media-integrity";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

type HistoricalPayloadRow = {
  payload: unknown;
};

export async function getHistoricalGameMediaReferences(
  slug: string
) {
  await verifyAdminSession();

  const result = await adminQuery<HistoricalPayloadRow>(
    `SELECT publication.payload
       FROM deuna_admin.editorial_publications AS publication
       INNER JOIN deuna_admin.editorial_items AS item
         ON item.id = publication.item_id
      WHERE item.item_type = 'game'
        AND item.item_key = $1`,
    [slug]
  );

  const references = new Set<string>();

  for (const row of result.rows) {
    let game: Game;
    try {
      game = parseEditorialPayload("game", row.payload);
    } catch {
      // Un snapshot histórico inválido ya no es restaurable por validación de
      // contenido; no debe retener archivos indefinidamente por un payload
      // que el sistema no puede interpretar.
      continue;
    }

    for (const reference of listGameImageReferences(game)) {
      references.add(reference);
    }
    for (const reference of listGameVideoReferences(game)) {
      references.add(reference);
    }
  }

  return [...references];
}
