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

type DraftGameRow = {
  draft_payload: unknown;
  revision: number;
};

type HistoricalGamePublicationRow = {
  payload: unknown;
  item_key: string;
  current_publication_number: number;
};

export type GameDraftPublicationCandidate = {
  game: Game;
  revision: number;
};

export type HistoricalGamePublicationCandidate = {
  game: Game;
  key: string;
  currentPublicationNumber: number;
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

export async function getGameDraftPublicationCandidate(
  key: string
): Promise<GameDraftPublicationCandidate | null> {
  await verifyAdminSession();

  const result = await adminQuery<DraftGameRow>(
    `SELECT draft_payload, revision
     FROM deuna_admin.editorial_items
     WHERE item_type = 'game'
       AND item_key = $1
     LIMIT 1`,
    [key]
  );
  const row = result.rows[0];

  if (!row) return null;

  return {
    game: parseEditorialPayload(
      "game",
      row.draft_payload
    ),
    revision: row.revision,
  };
}

export async function getHistoricalGamePublicationCandidate(
  publicationId: string
): Promise<HistoricalGamePublicationCandidate | null> {
  await verifyAdminSession();

  const result =
    await adminQuery<HistoricalGamePublicationRow>(
      `SELECT
         publication.payload,
         item.item_key,
         item.publication_number AS current_publication_number
       FROM deuna_admin.editorial_publications AS publication
       INNER JOIN deuna_admin.editorial_items AS item
         ON item.id = publication.item_id
       WHERE publication.id = $1
         AND item.item_type = 'game'
       LIMIT 1`,
      [publicationId]
    );
  const row = result.rows[0];

  if (!row) return null;

  return {
    game: parseEditorialPayload(
      "game",
      row.payload
    ),
    key: row.item_key,
    currentPublicationNumber:
      row.current_publication_number,
  };
}
