import "server-only";

import type {
  PoolClient,
} from "pg";

import {
  adminQuery,
  withAdminTransaction,
} from "./database";
import {
  hashEditorialPayload,
  normalizeEditorialPayload,
} from "./content-hash";
import {
  parseEditorialPayload,
  type EditorialAboutConfig,
  type EditorialHomeConfig,
  type EditorialItemType,
  type EditorialPayloadByType,
  type EditorialPublicPagesConfig,
  type EditorialSiteConfig,
} from "./content-validation";
import {
  verifyAdminSession,
} from "./session";

import type {
  Game,
  GameHardwareRequirements,
} from "@/types/game";
import type { GameUpdate } from "@/types/update";

type EditorialStatus = "synced" | "modified";

type EditorialListRow = {
  item_key: string;
  draft_payload: unknown;
  draft_status: EditorialStatus;
  revision: number;
  source_present: boolean;
  updated_at: Date;
};

type EditorialItemRow = EditorialListRow & {
  id: string;
  item_type: EditorialItemType;
  source_checksum: string;
};

type EditorialRevisionRow = {
  id: string;
  revision: number;
  action:
    | "imported"
    | "source_refreshed"
    | "draft_saved"
    | "draft_restored";
  created_at: Date;
};

type RestoreRevisionRow = {
  revision_id: string;
  payload: unknown;
  item_id: string;
  item_type: EditorialItemType;
  item_key: string;
  source_checksum: string;
  current_revision: number;
};

type EditorialOverviewRow = {
  games: string;
  updates: string;
  modified: string;
};

export type EditorialListItem<
  Type extends EditorialItemType,
> = {
  key: string;
  payload: EditorialPayloadByType[Type];
  status: EditorialStatus;
  revision: number;
  sourcePresent: boolean;
  updatedAt: Date;
};

export type EditorialRevision = {
  id: string;
  revision: number;
  action: EditorialRevisionRow["action"];
  createdAt: Date;
};

export type EditorialItem<
  Type extends EditorialItemType,
> = EditorialListItem<Type> & {
  id: string;
  type: Type;
  revisions: EditorialRevision[];
};

export type EditorialMutationResult =
  | { outcome: "saved"; revision: number }
  | { outcome: "conflict"; revision: number }
  | { outcome: "not_found" };

export type GameCoreDraftInput = Pick<
  Game,
  | "title"
  | "description"
  | "category"
  | "version"
  | "badge"
  | "rating"
  | "reviews"
  | "imageAlt"
>;

export type GameAdvancedDraftInput = Pick<
  Game,
  | "shortTitle"
  | "highlightedTitle"
  | "developer"
  | "publisher"
  | "releaseDate"
  | "genres"
  | "tags"
  | "platforms"
>;

export type GameDownloadDraftInput = Pick<
  NonNullable<Game["download"]>,
  | "sizeGb"
  | "fileCount"
  | "platform"
  | "sources"
>;

export type GameRequirementsDraftInput = {
  minimum?: GameHardwareRequirements;
  recommended?: GameHardwareRequirements;
};

export type GameMediaDraftInput = Pick<
  Game,
  | "coverImage"
  | "heroImage"
  | "cardImage"
  | "detailImage"
  | "backgroundImage"
  | "screenshots"
  | "imageMedia"
  | "mediaModes"
  | "videoMedia"
  | "previewMode"
  | "previewClip"
  | "youtubePreview"
>;

export type UpdateDraftInput = Pick<
  GameUpdate,
  | "version"
  | "publishedAt"
  | "title"
  | "summary"
  | "changes"
  | "image"
  | "gameSlug"
>;

type GlobalConfigType =
  | "site_config"
  | "home_config"
  | "public_pages_config"
  | "about_config";

type GlobalConfigPayload =
  | EditorialSiteConfig
  | EditorialHomeConfig
  | EditorialPublicPagesConfig
  | EditorialAboutConfig;

function compactHardwareRequirements(
  input: GameHardwareRequirements | undefined
) {
  if (!input) return undefined;

  const compact = Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) =>
        typeof value === "string" &&
        value.trim().length > 0
    )
  ) as GameHardwareRequirements;

  return Object.keys(compact).length > 0
    ? compact
    : undefined;
}

function normalizeRow<
  Type extends EditorialItemType,
>(
  type: Type,
  row: EditorialListRow
): EditorialListItem<Type> {
  return {
    key: row.item_key,
    payload: parseEditorialPayload(
      type,
      row.draft_payload
    ),
    status: row.draft_status,
    revision: row.revision,
    sourcePresent: row.source_present,
    updatedAt: row.updated_at,
  };
}

function normalizeRevision(
  row: EditorialRevisionRow
): EditorialRevision {
  return {
    id: row.id,
    revision: row.revision,
    action: row.action,
    createdAt: row.created_at,
  };
}

async function currentEditorialItem(
  client: PoolClient,
  type: EditorialItemType,
  key: string
) {
  const result = await client.query<
    Pick<EditorialItemRow, "id" | "draft_payload" | "revision">
  >(
    `SELECT id, draft_payload, revision
       FROM admin_editorial_items
      WHERE item_type = $1
        AND item_key = $2
      FOR UPDATE`,
    [type, key]
  );

  return result.rows[0];
}

async function insertRevision(
  client: PoolClient,
  itemId: string,
  revision: number,
  action: EditorialRevisionRow["action"],
  payload: unknown,
  actorUserId: string | null
) {
  await client.query(
    `INSERT INTO admin_editorial_revisions
      (item_id, revision, action, payload, actor_user_id)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [
      itemId,
      revision,
      action,
      JSON.stringify(payload),
      actorUserId,
    ]
  );
}

export async function listEditorialItems<
  Type extends EditorialItemType,
>(
  type: Type
): Promise<EditorialListItem<Type>[]> {
  const result = await adminQuery<EditorialListRow>(
    `SELECT item_key,
            draft_payload,
            draft_status,
            revision,
            source_present,
            updated_at
       FROM admin_editorial_items
      WHERE item_type = $1
      ORDER BY item_key ASC`,
    [type]
  );

  return result.rows.map(
    (row) => normalizeRow(type, row)
  );
}

export async function getEditorialItem<
  Type extends EditorialItemType,
>(
  type: Type,
  key: string
): Promise<EditorialItem<Type> | null> {
  const result = await adminQuery<EditorialItemRow>(
    `SELECT id,
            item_type,
            item_key,
            draft_payload,
            draft_status,
            revision,
            source_checksum,
            source_present,
            updated_at
       FROM admin_editorial_items
      WHERE item_type = $1
        AND item_key = $2
      LIMIT 1`,
    [type, key]
  );
  const row = result.rows[0];
  if (!row) return null;

  const revisionsResult = await adminQuery<EditorialRevisionRow>(
    `SELECT id,
            revision,
            action,
            created_at
       FROM admin_editorial_revisions
      WHERE item_id = $1
      ORDER BY revision DESC
      LIMIT 12`,
    [row.id]
  );

  return {
    ...normalizeRow(type, row),
    id: row.id,
    type,
    revisions: revisionsResult.rows.map(
      normalizeRevision
    ),
  };
}

export async function getGlobalConfig<
  Type extends GlobalConfigType,
>(
  type: Type,
  key: string
): Promise<EditorialItem<Type> | null> {
  return getEditorialItem(type, key);
}

export async function getEditorialOverview() {
  const result = await adminQuery<EditorialOverviewRow>(
    `SELECT
       COUNT(*) FILTER (WHERE item_type = 'game')::text AS games,
       COUNT(*) FILTER (WHERE item_type = 'update')::text AS updates,
       COUNT(*) FILTER (WHERE draft_status = 'modified')::text AS modified
       FROM admin_editorial_items`
  );
  const row = result.rows[0];

  return {
    games: Number(row?.games ?? 0),
    updates: Number(row?.updates ?? 0),
    modified: Number(row?.modified ?? 0),
  };
}

export async function updateEditorialDraft<
  Type extends EditorialItemType,
>(
  type: Type,
  key: string,
  expectedRevision: number,
  actorUserId: string,
  update: (
    current: EditorialPayloadByType[Type]
  ) => EditorialPayloadByType[Type]
): Promise<EditorialMutationResult> {
  return withAdminTransaction(async (client) => {
    const row = await currentEditorialItem(
      client,
      type,
      key
    );
    if (!row) return { outcome: "not_found" };
    if (row.revision !== expectedRevision) {
      return {
        outcome: "conflict",
        revision: row.revision,
      };
    }

    const current = parseEditorialPayload(
      type,
      row.draft_payload
    );
    const next = update(current);
    const normalized = normalizeEditorialPayload(
      type,
      next
    );
    const nextRevision = row.revision + 1;

    await client.query(
      `UPDATE admin_editorial_items
          SET draft_payload = $3::jsonb,
              draft_status = 'modified',
              revision = $4,
              updated_at = NOW()
        WHERE item_type = $1
          AND item_key = $2`,
      [type, key, JSON.stringify(normalized), nextRevision]
    );

    await insertRevision(
      client,
      row.id,
      nextRevision,
      "draft_saved",
      normalized,
      actorUserId
    );

    return {
      outcome: "saved",
      revision: nextRevision,
    };
  });
}

export async function restoreEditorialRevision(
  revisionId: string,
  expectedRevision: number,
  actorUserId: string
): Promise<
  | (EditorialMutationResult & {
      type: EditorialItemType;
      key: string;
    })
  | { outcome: "revision_not_found" }
> {
  return withAdminTransaction(async (client) => {
    const revisionResult = await client.query<RestoreRevisionRow>(
      `SELECT r.id AS revision_id,
              r.payload,
              i.id AS item_id,
              i.item_type,
              i.item_key,
              i.source_checksum,
              i.revision AS current_revision
         FROM admin_editorial_revisions r
         JOIN admin_editorial_items i ON i.id = r.item_id
        WHERE r.id = $1
        FOR UPDATE`,
      [revisionId]
    );
    const row = revisionResult.rows[0];
    if (!row) {
      return { outcome: "revision_not_found" };
    }
    if (row.current_revision !== expectedRevision) {
      return {
        outcome: "conflict",
        revision: row.current_revision,
        type: row.item_type,
        key: row.item_key,
      };
    }

    const normalized = normalizeEditorialPayload(
      row.item_type,
      row.payload
    );
    const nextRevision = row.current_revision + 1;

    await client.query(
      `UPDATE admin_editorial_items
          SET draft_payload = $2::jsonb,
              draft_status = 'modified',
              revision = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [row.item_id, JSON.stringify(normalized), nextRevision]
    );

    await insertRevision(
      client,
      row.item_id,
      nextRevision,
      "draft_restored",
      normalized,
      actorUserId
    );

    return {
      outcome: "saved",
      revision: nextRevision,
      type: row.item_type,
      key: row.item_key,
    };
  });
}

export async function saveGlobalConfigDraft<
  Type extends GlobalConfigType,
>(
  type: Type,
  key: string,
  expectedRevision: number,
  actorUserId: string,
  payload: GlobalConfigPayload
) {
  return updateEditorialDraft(
    type,
    key,
    expectedRevision,
    actorUserId,
    () => payload as EditorialPayloadByType[Type]
  );
}

export function saveGameCoreDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: GameCoreDraftInput
) {
  return updateEditorialDraft(
    "game",
    key,
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      ...input,
    })
  );
}

export function saveGameAdvancedDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: GameAdvancedDraftInput
) {
  return updateEditorialDraft(
    "game",
    key,
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      ...input,
    })
  );
}

export function saveGameDownloadDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: GameDownloadDraftInput
) {
  return updateEditorialDraft(
    "game",
    key,
    expectedRevision,
    actorUserId,
    (current) => {
      const previous = current.download;
      const nextDownload = {
        ...(previous?.href
          ? { href: previous.href }
          : {}),
        ...(previous?.label
          ? { label: previous.label }
          : {}),
        ...(input.sources?.length
          ? { sources: input.sources }
          : {}),
        ...(input.sizeGb !== undefined
          ? { sizeGb: input.sizeGb }
          : {}),
        ...(input.fileCount !== undefined
          ? { fileCount: input.fileCount }
          : {}),
        ...(input.platform
          ? { platform: input.platform }
          : {}),
      };

      return {
        ...current,
        download:
          Object.keys(nextDownload).length > 0
            ? nextDownload
            : undefined,
      };
    }
  );
}

export function saveGameRequirementsDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: GameRequirementsDraftInput
) {
  return updateEditorialDraft(
    "game",
    key,
    expectedRevision,
    actorUserId,
    (current) => {
      const minimum = compactHardwareRequirements(
        input.minimum
      );
      const recommended = compactHardwareRequirements(
        input.recommended
      );

      return {
        ...current,
        requirements:
          minimum || recommended
            ? {
                ...(minimum ?? {}),
                ...(minimum ? { minimum } : {}),
                ...(recommended
                  ? { recommended }
                  : {}),
              }
            : undefined,
      };
    }
  );
}

export function saveGameMediaDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: GameMediaDraftInput
) {
  return updateEditorialDraft(
    "game",
    key,
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      ...input,
    })
  );
}

export function saveUpdateDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: UpdateDraftInput
) {
  return updateEditorialDraft(
    "update",
    key,
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      ...input,
    })
  );
}

export function saveSiteConfigDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: EditorialSiteConfig
) {
  return saveGlobalConfigDraft(
    "site_config",
    key,
    expectedRevision,
    actorUserId,
    input
  );
}

export function saveHomeConfigDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: EditorialHomeConfig
) {
  return saveGlobalConfigDraft(
    "home_config",
    key,
    expectedRevision,
    actorUserId,
    input
  );
}

export function savePublicPagesConfigDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: EditorialPublicPagesConfig
) {
  return saveGlobalConfigDraft(
    "public_pages_config",
    key,
    expectedRevision,
    actorUserId,
    input
  );
}

export function saveAboutConfigDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: EditorialAboutConfig
) {
  return saveGlobalConfigDraft(
    "about_config",
    key,
    expectedRevision,
    actorUserId,
    input
  );
}

export async function getAuthenticatedAdminContext() {
  const session = await verifyAdminSession();
  const overview = await getEditorialOverview();

  return {
    session,
    overview,
  };
}