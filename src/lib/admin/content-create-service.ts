import "server-only";

import {
  randomUUID,
} from "node:crypto";

import type {
  PoolClient,
} from "pg";

import type { Game } from "@/types/game";
import type { GameUpdate } from "@/types/update";

import {
  hashEditorialPayload,
  normalizeEditorialPayload,
} from "./content-hash";
import {
  parseEditorialPayload,
  type EditorialItemType,
} from "./content-validation";
import {
  withAdminTransaction,
} from "./database";
import {
  verifyAdminSession,
} from "./session";

export type CreateGameDraftInput = Pick<
  Game,
  | "slug"
  | "title"
  | "description"
  | "category"
  | "version"
  | "badge"
  | "imageAlt"
>;

export type CreateUpdateDraftInput = Pick<
  GameUpdate,
  | "id"
  | "gameSlug"
  | "version"
  | "publishedAt"
  | "type"
  | "summary"
  | "featured"
>;

export type CreateEditorialDraftResult =
  | {
      outcome: "created";
      key: string;
    }
  | {
      outcome: "exists";
      key: string;
    };

export type CreateUpdateDraftResult =
  | CreateEditorialDraftResult
  | {
      outcome: "game_not_found";
      key: string;
    };

async function assertActor(
  actorUserId: string
) {
  const session = await verifyAdminSession();

  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }
}

async function insertHiddenEditorialItem(
  client: PoolClient,
  type: Extract<EditorialItemType, "game" | "game_update">,
  key: string,
  payload: unknown,
  actorUserId: string
): Promise<boolean> {
  const normalized = normalizeEditorialPayload(
    parseEditorialPayload(type, payload)
  );
  const serialized = JSON.stringify(normalized);
  const digest = hashEditorialPayload(normalized);
  const sourcePayload = {};
  const sourceSerialized = JSON.stringify(sourcePayload);
  const sourceDigest = hashEditorialPayload(sourcePayload);
  const id = randomUUID();
  const inserted = await client.query<{
    id: string;
  }>(
    `INSERT INTO deuna_admin.editorial_items
       (
         id,
         item_type,
         item_key,
         source_payload,
         source_checksum,
         source_present,
         draft_payload,
         draft_status,
         published_payload,
         published_checksum,
         public_visible,
         updated_by
       )
     VALUES (
       $1,
       $2,
       $3,
       $4::jsonb,
       $5,
       false,
       $6::jsonb,
       'modified',
       $6::jsonb,
       $7,
       false,
       $8
     )
     ON CONFLICT (item_type, item_key)
     DO NOTHING
     RETURNING id`,
    [
      id,
      type,
      key,
      sourceSerialized,
      sourceDigest,
      serialized,
      digest,
      actorUserId,
    ]
  );

  if (!inserted.rows[0]) {
    return false;
  }

  await client.query(
    `INSERT INTO deuna_admin.editorial_revisions
       (item_id, revision, payload, action, actor_user_id)
     VALUES ($1, 1, $2::jsonb, 'draft_saved', $3)`,
    [id, serialized, actorUserId]
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
     VALUES ($1, 1, $2::jsonb, $3, 1, 'bootstrap', $4)`,
    [id, serialized, digest, actorUserId]
  );
  await client.query(
    `INSERT INTO deuna_admin.admin_audit_log
       (user_id, action, entity_type, entity_id, details)
     VALUES ($1, 'content_created', $2, $3, $4::jsonb)`,
    [
      actorUserId,
      type,
      key,
      JSON.stringify({
        publicVisible: false,
        revision: 1,
        publicationNumber: 1,
      }),
    ]
  );

  return true;
}

export async function createGameDraft(
  actorUserId: string,
  input: CreateGameDraftInput
): Promise<CreateEditorialDraftResult> {
  await assertActor(actorUserId);

  const game = {
    id: input.slug,
    slug: input.slug,
    title: input.title,
    description: input.description,
    category: input.category,
    version: input.version,
    badge: input.badge,
    imageAlt: input.imageAlt,
    platforms: ["PC"],
  };

  return withAdminTransaction(async (client) => {
    const created = await insertHiddenEditorialItem(
      client,
      "game",
      input.slug,
      game,
      actorUserId
    );

    return {
      outcome: created ? "created" : "exists",
      key: input.slug,
    };
  });
}

export async function createUpdateDraft(
  actorUserId: string,
  input: CreateUpdateDraftInput
): Promise<CreateUpdateDraftResult> {
  await assertActor(actorUserId);

  return withAdminTransaction(async (client) => {
    const game = await client.query<{
      id: string;
    }>(
      `SELECT id
       FROM deuna_admin.editorial_items
       WHERE item_type = 'game'
         AND item_key = $1
       LIMIT 1`,
      [input.gameSlug]
    );

    if (!game.rows[0]) {
      return {
        outcome: "game_not_found",
        key: input.id,
      };
    }

    const created = await insertHiddenEditorialItem(
      client,
      "game_update",
      input.id,
      input,
      actorUserId
    );

    return {
      outcome: created ? "created" : "exists",
      key: input.id,
    };
  });
}
