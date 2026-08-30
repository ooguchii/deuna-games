import "server-only";

import {
  adminQuery,
} from "./database";
import {
  verifyAdminSession,
} from "./session";

type PublicationTableRow = {
  publication_table: string | null;
};

type PublicationCountsRow = {
  games: number;
  updates: number;
  pending: number;
};

type RecentPublicationRow = {
  id: string;
  item_type: "game" | "game_update";
  item_key: string;
  publication_number: number;
  action: "published" | "rollback";
  created_at: Date;
};

export type RecentPublication = {
  id: string;
  type: "game" | "game_update";
  key: string;
  publicationNumber: number;
  action: "published" | "rollback";
  createdAt: Date;
};

export type PublicationOverview = {
  available: boolean;
  games: number;
  updates: number;
  pending: number;
  recent: RecentPublication[];
};

const unavailableOverview: PublicationOverview = {
  available: false,
  games: 0,
  updates: 0,
  pending: 0,
  recent: [],
};

export async function getPublicationOverview():
  Promise<PublicationOverview> {
  await verifyAdminSession();

  const workspace =
    await adminQuery<PublicationTableRow>(
      `SELECT
         to_regclass(
           'deuna_admin.editorial_publications'
         )::text AS publication_table`
    );

  if (!workspace.rows[0]?.publication_table) {
    return unavailableOverview;
  }

  const [countsResult, recentResult] =
    await Promise.all([
      adminQuery<PublicationCountsRow>(
        `SELECT
           COUNT(*) FILTER (
             WHERE item_type = 'game'
           )::int AS games,
           COUNT(*) FILTER (
             WHERE item_type = 'game_update'
           )::int AS updates,
           COUNT(*) FILTER (
             WHERE item_type IN ('game', 'game_update')
               AND draft_payload IS DISTINCT FROM published_payload
           )::int AS pending
         FROM deuna_admin.editorial_items`
      ),
      adminQuery<RecentPublicationRow>(
        `SELECT
           publication.id::text,
           item.item_type,
           item.item_key,
           publication.publication_number,
           publication.action,
           publication.created_at
         FROM deuna_admin.editorial_publications AS publication
         INNER JOIN deuna_admin.editorial_items AS item
           ON item.id = publication.item_id
         WHERE item.item_type IN ('game', 'game_update')
           AND publication.action IN ('published', 'rollback')
         ORDER BY publication.created_at DESC,
                  publication.id DESC
         LIMIT 8`
      ),
    ]);
  const counts = countsResult.rows[0];

  return {
    available: true,
    games: counts?.games ?? 0,
    updates: counts?.updates ?? 0,
    pending: counts?.pending ?? 0,
    recent: recentResult.rows.map(
      (publication) => ({
        id: publication.id,
        type: publication.item_type,
        key: publication.item_key,
        publicationNumber:
          publication.publication_number,
        action: publication.action,
        createdAt: publication.created_at,
      })
    ),
  };
}
