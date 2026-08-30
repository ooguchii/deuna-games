import "server-only";

import {
  adminQuery,
} from "./database";
import {
  verifyAdminSession,
} from "./session";

type PublishableType =
  | "game"
  | "game_update"
  | "site_config"
  | "home_config"
  | "about_config";

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
  item_type: PublishableType;
  item_key: string;
  publication_number: number;
  action: "published" | "rollback";
  created_at: Date;
};

type ItemPublicationStateRow = {
  item_key: string;
  publication_number: number;
  public_visible: boolean;
  has_unpublished_changes: boolean;
  panel_created: boolean;
  ever_published: boolean;
};

type ItemPublicationIdentityRow = {
  panel_created: boolean;
  ever_published: boolean;
};

export type RecentPublication = {
  id: string;
  type: PublishableType;
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

export type ItemPublicationState = {
  key: string;
  publicationNumber: number;
  publicVisible: boolean;
  hasUnpublishedChanges: boolean;
  panelCreated: boolean;
  everPublished: boolean;
};

export type ItemPublicationIdentity = {
  panelCreated: boolean;
  everPublished: boolean;
};

const unavailableOverview: PublicationOverview = {
  available: false,
  games: 0,
  updates: 0,
  pending: 0,
  recent: [],
};

async function publicationWorkspaceAvailable() {
  const workspace =
    await adminQuery<PublicationTableRow>(
      `SELECT
         to_regclass(
           'deuna_admin.editorial_publications'
         )::text AS publication_table`
    );

  return Boolean(
    workspace.rows[0]?.publication_table
  );
}

export async function getPublicationOverview():
  Promise<PublicationOverview> {
  await verifyAdminSession();

  if (!(await publicationWorkspaceAvailable())) {
    return unavailableOverview;
  }

  const [countsResult, recentResult] =
    await Promise.all([
      adminQuery<PublicationCountsRow>(
        `SELECT
           COUNT(*) FILTER (
             WHERE item_type = 'game'
               AND public_visible = true
           )::int AS games,
           COUNT(*) FILTER (
             WHERE item_type = 'game_update'
               AND public_visible = true
           )::int AS updates,
           COUNT(*) FILTER (
             WHERE item_type IN (
               'game',
               'game_update',
               'site_config',
               'home_config',
               'about_config'
             )
               AND (
                 public_visible = false OR
                 draft_payload IS DISTINCT FROM published_payload
               )
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
         WHERE item.item_type IN (
             'game',
             'game_update',
             'site_config',
             'home_config',
             'about_config'
           )
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

export async function listPublicationStates(
  type: PublishableType
): Promise<ItemPublicationState[] | null> {
  await verifyAdminSession();

  if (!(await publicationWorkspaceAvailable())) {
    return null;
  }

  const result =
    await adminQuery<ItemPublicationStateRow>(
      `SELECT
         item.item_key,
         item.publication_number,
         item.public_visible,
         (
           item.public_visible = false OR
           item.draft_payload IS DISTINCT FROM item.published_payload
         ) AS has_unpublished_changes,
         EXISTS (
           SELECT 1
           FROM deuna_admin.editorial_revisions AS revision
           WHERE revision.item_id = item.id
             AND revision.revision = 1
             AND revision.action = 'draft_saved'
         ) AS panel_created,
         EXISTS (
           SELECT 1
           FROM deuna_admin.editorial_publications AS publication
           WHERE publication.item_id = item.id
             AND publication.action IN ('published', 'rollback')
         ) AS ever_published
       FROM deuna_admin.editorial_items AS item
       WHERE item.item_type = $1
       ORDER BY item.item_key ASC`,
      [type]
    );

  return result.rows.map((item) => ({
    key: item.item_key,
    publicationNumber: item.publication_number,
    publicVisible: item.public_visible,
    hasUnpublishedChanges:
      item.has_unpublished_changes,
    panelCreated: item.panel_created,
    everPublished: item.ever_published,
  }));
}

export async function getGamePublicationIdentity(
  key: string
): Promise<ItemPublicationIdentity | null> {
  await verifyAdminSession();

  if (!(await publicationWorkspaceAvailable())) {
    return null;
  }

  const result =
    await adminQuery<ItemPublicationIdentityRow>(
      `SELECT
         EXISTS (
           SELECT 1
           FROM deuna_admin.editorial_revisions AS revision
           WHERE revision.item_id = item.id
             AND revision.revision = 1
             AND revision.action = 'draft_saved'
         ) AS panel_created,
         EXISTS (
           SELECT 1
           FROM deuna_admin.editorial_publications AS publication
           WHERE publication.item_id = item.id
             AND publication.action IN ('published', 'rollback')
         ) AS ever_published
       FROM deuna_admin.editorial_items AS item
       WHERE item.item_type = 'game'
         AND item.item_key = $1
       LIMIT 1`,
      [key]
    );
  const identity = result.rows[0];

  if (!identity) return null;

  return {
    panelCreated: identity.panel_created,
    everPublished: identity.ever_published,
  };
}
