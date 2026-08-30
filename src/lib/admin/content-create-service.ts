import "server-only";

import {
  randomUUID,
} from "node:crypto";

import type { Game } from "@/types/game";

import {
  hashEditorialPayload,
  normalizeEditorialPayload,
} from "./content-hash";
import {
  parseEditorialPayload,
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

export type CreateGameDraftResult =
  | {
      outcome: "created";
      key: string;
    }
  | {
      outcome: "exists";
      key: string;
    };

export async function createGameDraft(
  actorUserId: string,
  input: CreateGameDraftInput
): Promise<CreateGameDraftResult> {
  const session = await verifyAdminSession();

  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }

  const game = normalizeEditorialPayload(
    parseEditorialPayload("game", {
      id: input.slug,
      slug: input.slug,
      title: input.title,
      description: input.description,
      category: input.category,
      version: input.version,
      badge: input.badge,
      imageAlt: input.imageAlt,
      platforms: ["PC"],
    })
  );
  const serialized = JSON.stringify(game);
  const digest = hashEditorialPayload(game);
  const sourcePayload = {};
  const sourceSerialized = JSON.stringify(sourcePayload);
  const sourceDigest = hashEditorialPayload(sourcePayload);

  return withAdminTransaction(async (client) => {
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
         'game',
         $2,
         $3::jsonb,
         $4,
         false,
         $5::jsonb,
         'modified',
         $5::jsonb,
         $6,
         false,
         $7
       )
       ON CONFLICT (item_type, item_key)
       DO NOTHING
       RETURNING id`,
      [
        id,
        game.slug,
        sourceSerialized,
        sourceDigest,
        serialized,
        digest,
        actorUserId,
      ]
    );

    if (!inserted.rows[0]) {
      return {
        outcome: "exists",
        key: game.slug,
      };
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
       VALUES ($1, 'content_created', 'game', $2, $3::jsonb)`,
      [
        actorUserId,
        game.slug,
        JSON.stringify({
          publicVisible: false,
          revision: 1,
          publicationNumber: 1,
        }),
      ]
    );

    return {
      outcome: "created",
      key: game.slug,
    };
  });
}
