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
  | "screenshots"
  | "previewMode"
  | "previewClip"
  | "youtubePreview"
  | "directPreview"
>;

export type UpdateDraftInput = Pick<
  GameUpdate,
  | "version"
  | "publishedAt"
  | "type"
  | "summary"
  | "featured"
>;

export type AboutHeroDraftInput =
  EditorialAboutConfig["hero"];

export type AboutPrinciplesDraftInput = Pick<
  EditorialAboutConfig,
  "intro" | "principles"
>;

export type AboutReasonDraftInput = Pick<
  EditorialAboutConfig,
  "reason" | "ecosystem"
>;

export type AboutManifestoDraftInput = Pick<
  EditorialAboutConfig,
  "manifesto" | "ctaTitle"
>;

type GamePerformanceDraftInput =
  NonNullable<Game["performance"]>;

function parseCount(value: string | number) {
  const parsed =
    typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asEditorialItem<
  Type extends EditorialItemType,
>(
  row: EditorialListRow,
  type?: Type,
  id?: string,
  revisions: EditorialRevision[] = []
): EditorialListItem<Type> | EditorialItem<Type> {
  const base: EditorialListItem<Type> = {
    key: row.item_key,
    payload: parseEditorialPayload(
      type ?? ("game" as Type),
      row.draft_payload
    ),
    status: row.draft_status,
    revision: row.revision,
    sourcePresent: row.source_present,
    updatedAt: row.updated_at,
  };

  if (!type || !id) return base;

  return {
    ...base,
    id,
    type,
    revisions,
  };
}

async function requireActor(actorUserId: string) {
  const session = await verifyAdminSession();

  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }
}

async function writeRevision<
  Type extends EditorialItemType,
>(
  client: PoolClient,
  item: EditorialItemRow,
  payload: EditorialPayloadByType[Type],
  actorUserId: string,
  action: EditorialRevisionRow["action"],
  metadata: Record<string, unknown> = {}
) {
  const normalized = normalizeEditorialPayload(payload);
  const checksum = hashEditorialPayload(payload);
  const revision = item.revision + 1;
  const status: EditorialStatus =
    checksum === item.source_checksum
      ? "synced"
      : "modified";

  await client.query(
    `UPDATE deuna_admin.editorial_items
     SET draft_payload = $2::jsonb,
         draft_checksum = $3,
         draft_status = $4,
         revision = $5,
         updated_at = now()
     WHERE id = $1`,
    [item.id, normalized, checksum, status, revision]
  );

  await client.query(
    `INSERT INTO deuna_admin.editorial_revisions (
       item_id,
       revision,
       action,
       payload,
       checksum,
       actor_user_id,
       metadata
     ) VALUES (
       $1,
       $2,
       $3,
       $4::jsonb,
       $5,
       $6,
       $7::jsonb
     )`,
    [
      item.id,
      revision,
      action,
      normalized,
      checksum,
      actorUserId,
      JSON.stringify(metadata),
    ]
  );

  return revision;
}

async function updateEditorialDraft<
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
  await requireActor(actorUserId);

  return withAdminTransaction(async (client) => {
    const result = await client.query<EditorialItemRow>(
      `SELECT
         id,
         item_type,
         item_key,
         source_checksum,
         draft_payload,
         draft_status,
         revision,
         source_present,
         updated_at
       FROM deuna_admin.editorial_items
       WHERE item_type = $1
         AND item_key = $2
       LIMIT 1
       FOR UPDATE`,
      [type, key]
    );
    const row = result.rows[0];

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
    const next = parseEditorialPayload(
      type,
      update(current)
    );
    const revision = await writeRevision(
      client,
      row,
      next,
      actorUserId,
      "draft_saved"
    );

    return { outcome: "saved", revision };
  });
}

function cleanText(value?: string) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function compactHardwareRequirements(
  value?: GameHardwareRequirements
) {
  if (!value) return undefined;

  const compact: GameHardwareRequirements = {
    ram: cleanText(value.ram),
    graphics: cleanText(value.graphics),
    processor: cleanText(value.processor),
    storage: cleanText(value.storage),
    system: cleanText(value.system),
  };

  return Object.values(compact).some(Boolean)
    ? compact
    : undefined;
}

export async function getEditorialOverview() {
  const result = await adminQuery<EditorialOverviewRow>(
    `SELECT
       count(*) FILTER (WHERE item_type = 'game')::text AS games,
       count(*) FILTER (WHERE item_type = 'game_update')::text AS updates,
       count(*) FILTER (WHERE draft_status = 'modified')::text AS modified
     FROM deuna_admin.editorial_items`
  );
  const row = result.rows[0];

  return {
    games: parseCount(row?.games ?? 0),
    updates: parseCount(row?.updates ?? 0),
    modified: parseCount(row?.modified ?? 0),
  };
}

export async function listEditorialItems<
  Type extends EditorialItemType,
>(type: Type) {
  const result = await adminQuery<EditorialListRow>(
    `SELECT
       item_key,
       draft_payload,
       draft_status,
       revision,
       source_present,
       updated_at
     FROM deuna_admin.editorial_items
     WHERE item_type = $1
     ORDER BY item_key ASC`,
    [type]
  );

  return result.rows.map(
    (row) => asEditorialItem<Type>(row) as EditorialListItem<Type>
  );
}

export async function getEditorialItem<
  Type extends EditorialItemType,
>(type: Type, key: string) {
  const [itemResult, revisionsResult] = await Promise.all([
    adminQuery<EditorialItemRow>(
      `SELECT
         id,
         item_type,
         item_key,
         source_checksum,
         draft_payload,
         draft_status,
         revision,
         source_present,
         updated_at
       FROM deuna_admin.editorial_items
       WHERE item_type = $1
         AND item_key = $2
       LIMIT 1`,
      [type, key]
    ),
    adminQuery<EditorialRevisionRow>(
      `SELECT
         id::text,
         revision,
         action,
         created_at
       FROM deuna_admin.editorial_revisions
       WHERE item_id = (
         SELECT id
         FROM deuna_admin.editorial_items
         WHERE item_type = $1
           AND item_key = $2
         LIMIT 1
       )
       ORDER BY revision DESC
       LIMIT 20`,
      [type, key]
    ),
  ]);
  const row = itemResult.rows[0];

  if (!row) return null;

  return asEditorialItem<Type>(
    row,
    type,
    row.id,
    revisionsResult.rows.map((revision) => ({
      id: revision.id,
      revision: revision.revision,
      action: revision.action,
      createdAt: revision.created_at,
    }))
  ) as EditorialItem<Type>;
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

export function saveGamePerformanceDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: GamePerformanceDraftInput | undefined
) {
  return updateEditorialDraft(
    "game",
    key,
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      performance: input,
    })
  );
}

export function saveGameDownloadDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string,
  input: GameDownloadDraftInput | undefined
) {
  return updateEditorialDraft(
    "game",
    key,
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      download: input
        ? {
            ...(current.download ?? {}),
            sizeGb: input.sizeGb,
            fileCount: input.fileCount,
            platform: input.platform,
            sources: input.sources,
            href:
              current.download?.href ??
              input.sources?.find(
                (source) => source.enabled !== false
              )?.href,
          }
        : undefined,
    })
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
    "game_update",
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
  expectedRevision: number,
  actorUserId: string,
  input: EditorialSiteConfig
) {
  return updateEditorialDraft(
    "site_config",
    "site",
    expectedRevision,
    actorUserId,
    () => input
  );
}

export function saveHomeConfigDraft(
  expectedRevision: number,
  actorUserId: string,
  input: EditorialHomeConfig
) {
  return updateEditorialDraft(
    "home_config",
    "home",
    expectedRevision,
    actorUserId,
    () => input
  );
}

export function savePublicPagesConfigDraft(
  expectedRevision: number,
  actorUserId: string,
  update: (
    current: EditorialPublicPagesConfig
  ) => EditorialPublicPagesConfig
) {
  return updateEditorialDraft(
    "public_pages_config",
    "public-pages",
    expectedRevision,
    actorUserId,
    update
  );
}

export function saveAboutHeroDraft(
  expectedRevision: number,
  actorUserId: string,
  input: AboutHeroDraftInput
) {
  return updateEditorialDraft(
    "about_config",
    "about",
    expectedRevision,
    actorUserId,
    () => ({
      ...input,
    })
  );
}

export function saveAboutPrinciplesDraft(
  expectedRevision: number,
  actorUserId: string,
  input: AboutPrinciplesDraftInput
) {
  return updateEditorialDraft(
    "about_config",
    "about",
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      ...input,
    })
  );
}

export function saveAboutReasonDraft(
  expectedRevision: number,
  actorUserId: string,
  input: AboutReasonDraftInput
) {
  return updateEditorialDraft(
    "about_config",
    "about",
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      ...input,
    })
  );
}

export function saveAboutManifestoDraft(
  expectedRevision: number,
  actorUserId: string,
  input: AboutManifestoDraftInput
) {
  return updateEditorialDraft(
    "about_config",
    "about",
    expectedRevision,
    actorUserId,
    (current) => ({
      ...current,
      ...input,
    })
  );
}

export async function restoreEditorialRevision(
  revisionId: string,
  expectedRevision: number,
  actorUserId: string
): Promise<
  EditorialMutationResult & {
    type?: EditorialItemType;
    key?: string;
  }
> {
  const session = await verifyAdminSession();

  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }

  return withAdminTransaction(async (client) => {
    const result = await client.query<RestoreRevisionRow>(
      `SELECT
         revision_row.id::text AS revision_id,
         revision_row.payload,
         item.id AS item_id,
         item.item_type,
         item.item_key,
         item.source_checksum,
         item.revision AS current_revision
       FROM deuna_admin.editorial_revisions AS revision_row
       INNER JOIN deuna_admin.editorial_items AS item
         ON item.id = revision_row.item_id
       WHERE revision_row.id = $1
       LIMIT 1
       FOR UPDATE OF item`,
      [revisionId]
    );
    const row = result.rows[0];

    if (!row) return { outcome: "not_found" };

    if (row.current_revision !== expectedRevision) {
      return {
        outcome: "conflict",
        revision: row.current_revision,
        type: row.item_type,
        key: row.item_key,
      };
    }

    const item: EditorialItemRow = {
      id: row.item_id,
      item_type: row.item_type,
      item_key: row.item_key,
      source_checksum: row.source_checksum,
      draft_payload: row.payload,
      draft_status: "modified",
      revision: row.current_revision,
      source_present: true,
      updated_at: new Date(),
    };
    const payload = parseEditorialPayload(
      row.item_type,
      row.payload
    );
    const revision = await writeRevision(
      client,
      item,
      payload,
      actorUserId,
      "draft_restored",
      {
        restoredFromRevisionId: row.revision_id,
      }
    );

    return {
      outcome: "saved",
      revision,
      type: row.item_type,
      key: row.item_key,
    };
  });
}
