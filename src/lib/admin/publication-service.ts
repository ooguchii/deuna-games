import "server-only";

import type {
  PoolClient,
} from "pg";

import {
  hashEditorialPayload,
  normalizeEditorialPayload,
} from "./content-hash";
import {
  parseEditorialPayload,
} from "./content-validation";
import {
  adminQuery,
  withAdminTransaction,
} from "./database";
import {
  verifyAdminSession,
} from "./session";

type PublicationAction =
  | "bootstrap"
  | "published"
  | "rollback";

type PublicationItemRow = {
  id: string;
  item_key: string;
  draft_payload: unknown;
  revision: number;
  published_checksum: string;
  published_from_revision: number | null;
  publication_number: number;
  published_at: Date;
};

type PublicationHistoryRow = {
  id: string;
  publication_number: number;
  checksum: string;
  source_revision: number | null;
  action: PublicationAction;
  created_at: Date;
};

type RestorePublicationRow = {
  publication_id: string;
  payload: unknown;
  checksum: string;
  source_revision: number | null;
  target_publication_number: number;
  item_id: string;
  item_key: string;
  current_publication_number: number;
  current_published_checksum: string;
};

export type EditorialPublication = {
  id: string;
  publicationNumber: number;
  checksum: string;
  sourceRevision: number | null;
  action: PublicationAction;
  createdAt: Date;
};

export type GamePublicationState = {
  itemId: string;
  key: string;
  draftRevision: number;
  publicationNumber: number;
  publishedFromRevision: number | null;
  publishedAt: Date;
  hasUnpublishedChanges: boolean;
  publications: EditorialPublication[];
};

export type PublishGameResult =
  | {
      outcome: "published";
      publicationNumber: number;
    }
  | {
      outcome: "no_changes";
      publicationNumber: number;
    }
  | {
      outcome: "conflict";
      revision: number;
    }
  | { outcome: "not_found" };

export type RestorePublicationResult =
  | {
      outcome: "restored";
      key: string;
      publicationNumber: number;
    }
  | {
      outcome: "no_changes";
      key: string;
      publicationNumber: number;
    }
  | {
      outcome: "conflict";
      key: string;
      publicationNumber: number;
    }
  | { outcome: "not_found" };

function normalizeGamePayload(payload: unknown) {
  return normalizeEditorialPayload(
    parseEditorialPayload("game", payload)
  );
}

async function writePublicationAudit(
  client: PoolClient,
  actorUserId: string,
  key: string,
  action: "content_published" | "publication_restored",
  details: Record<string, unknown>
) {
  await client.query(
    `INSERT INTO deuna_admin.admin_audit_log
       (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'game', $3, $4::jsonb)`,
    [
      actorUserId,
      action,
      key,
      JSON.stringify(details),
    ]
  );
}

export async function getGamePublicationState(
  key: string
): Promise<GamePublicationState | null> {
  await verifyAdminSession();

  const itemResult = await adminQuery<PublicationItemRow>(
    `SELECT
       id,
       item_key,
       draft_payload,
       revision,
       published_checksum,
       published_from_revision,
       publication_number,
       published_at
     FROM deuna_admin.editorial_items
     WHERE item_type = 'game'
       AND item_key = $1
     LIMIT 1`,
    [key]
  );
  const item = itemResult.rows[0];

  if (!item) return null;

  const draft = normalizeGamePayload(item.draft_payload);
  const draftChecksum = hashEditorialPayload(draft);
  const historyResult =
    await adminQuery<PublicationHistoryRow>(
      `SELECT
         id::text,
         publication_number,
         checksum,
         source_revision,
         action,
         created_at
       FROM deuna_admin.editorial_publications
       WHERE item_id = $1
       ORDER BY publication_number DESC
       LIMIT 12`,
      [item.id]
    );

  return {
    itemId: item.id,
    key: item.item_key,
    draftRevision: item.revision,
    publicationNumber: item.publication_number,
    publishedFromRevision:
      item.published_from_revision,
    publishedAt: item.published_at,
    hasUnpublishedChanges:
      draftChecksum !== item.published_checksum,
    publications: historyResult.rows.map(
      (publication) => ({
        id: publication.id,
        publicationNumber:
          publication.publication_number,
        checksum: publication.checksum,
        sourceRevision:
          publication.source_revision,
        action: publication.action,
        createdAt: publication.created_at,
      })
    ),
  };
}

export async function publishGameDraft(
  key: string,
  expectedRevision: number,
  actorUserId: string
): Promise<PublishGameResult> {
  const session = await verifyAdminSession();

  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }

  return withAdminTransaction(async (client) => {
    const result = await client.query<PublicationItemRow>(
      `SELECT
         id,
         item_key,
         draft_payload,
         revision,
         published_checksum,
         published_from_revision,
         publication_number,
         published_at
       FROM deuna_admin.editorial_items
       WHERE item_type = 'game'
         AND item_key = $1
       LIMIT 1
       FOR UPDATE`,
      [key]
    );
    const item = result.rows[0];

    if (!item) return { outcome: "not_found" };

    if (item.revision !== expectedRevision) {
      return {
        outcome: "conflict",
        revision: item.revision,
      };
    }

    const normalized = normalizeGamePayload(
      item.draft_payload
    );
    const digest = hashEditorialPayload(normalized);

    if (digest === item.published_checksum) {
      return {
        outcome: "no_changes",
        publicationNumber: item.publication_number,
      };
    }

    const serialized = JSON.stringify(normalized);
    const nextPublication =
      item.publication_number + 1;

    await client.query(
      `UPDATE deuna_admin.editorial_items
       SET published_payload = $2::jsonb,
           published_checksum = $3,
           published_from_revision = $4,
           publication_number = $5,
           published_at = now(),
           published_by = $6
       WHERE id = $1`,
      [
        item.id,
        serialized,
        digest,
        item.revision,
        nextPublication,
        actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO deuna_admin.editorial_publications
         (
           item_id,
           publication_number,
           payload,
           checksum,
           source_revision,
           action,
           actor_user_id
         )
       VALUES ($1, $2, $3::jsonb, $4, $5, 'published', $6)`,
      [
        item.id,
        nextPublication,
        serialized,
        digest,
        item.revision,
        actorUserId,
      ]
    );
    await writePublicationAudit(
      client,
      actorUserId,
      item.item_key,
      "content_published",
      {
        publicationNumber: nextPublication,
        revision: item.revision,
      }
    );

    return {
      outcome: "published",
      publicationNumber: nextPublication,
    };
  });
}

export async function restoreGamePublication(
  publicationId: string,
  expectedPublicationNumber: number,
  actorUserId: string
): Promise<RestorePublicationResult> {
  const session = await verifyAdminSession();

  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }

  return withAdminTransaction(async (client) => {
    const result =
      await client.query<RestorePublicationRow>(
        `SELECT
           publication.id::text AS publication_id,
           publication.payload,
           publication.checksum,
           publication.source_revision,
           publication.publication_number AS target_publication_number,
           item.id AS item_id,
           item.item_key,
           item.publication_number AS current_publication_number,
           item.published_checksum AS current_published_checksum
         FROM deuna_admin.editorial_publications AS publication
         INNER JOIN deuna_admin.editorial_items AS item
           ON item.id = publication.item_id
         WHERE publication.id = $1
           AND item.item_type = 'game'
         LIMIT 1
         FOR UPDATE OF item`,
        [publicationId]
      );
    const row = result.rows[0];

    if (!row) return { outcome: "not_found" };

    if (
      row.current_publication_number !==
      expectedPublicationNumber
    ) {
      return {
        outcome: "conflict",
        key: row.item_key,
        publicationNumber:
          row.current_publication_number,
      };
    }

    const normalized = normalizeGamePayload(row.payload);
    const digest = hashEditorialPayload(normalized);

    if (digest !== row.checksum) {
      throw new Error(
        "La publicación histórica no supera la verificación de integridad."
      );
    }

    if (digest === row.current_published_checksum) {
      return {
        outcome: "no_changes",
        key: row.item_key,
        publicationNumber:
          row.current_publication_number,
      };
    }

    const serialized = JSON.stringify(normalized);
    const nextPublication =
      row.current_publication_number + 1;

    await client.query(
      `UPDATE deuna_admin.editorial_items
       SET published_payload = $2::jsonb,
           published_checksum = $3,
           published_from_revision = $4,
           publication_number = $5,
           published_at = now(),
           published_by = $6
       WHERE id = $1`,
      [
        row.item_id,
        serialized,
        digest,
        row.source_revision,
        nextPublication,
        actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO deuna_admin.editorial_publications
         (
           item_id,
           publication_number,
           payload,
           checksum,
           source_revision,
           action,
           actor_user_id
         )
       VALUES ($1, $2, $3::jsonb, $4, $5, 'rollback', $6)`,
      [
        row.item_id,
        nextPublication,
        serialized,
        digest,
        row.source_revision,
        actorUserId,
      ]
    );
    await writePublicationAudit(
      client,
      actorUserId,
      row.item_key,
      "publication_restored",
      {
        publicationNumber: nextPublication,
        restoredFromPublication:
          row.target_publication_number,
      }
    );

    return {
      outcome: "restored",
      key: row.item_key,
      publicationNumber: nextPublication,
    };
  });
}
