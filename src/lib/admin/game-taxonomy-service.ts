import "server-only";

import type { PoolClient } from "pg";

import type { Game } from "@/types/game";
import type { GameTaxonomy } from "@/types/game-taxonomy";

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

type TaxonomyItemRow = {
  id: string;
  draft_payload: unknown;
  source_checksum: string;
  revision: number;
};

type GamePayloadRow = {
  draft_payload: unknown;
};

export type GameTaxonomyMutationResult =
  | { outcome: "saved"; revision: number }
  | { outcome: "conflict"; revision: number }
  | { outcome: "in_use"; revision: number }
  | { outcome: "not_found" };

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function gameValues(games: Game[]) {
  return {
    categories: games.map((game) => game.category),
    genres: games.flatMap((game) => game.genres ?? []),
    tags: games.flatMap((game) => game.tags ?? []),
  };
}

function preservesUsedGameTerms(
  taxonomy: GameTaxonomy,
  games: Game[]
) {
  const values = gameValues(games);

  for (const kind of [
    "categories",
    "genres",
    "tags",
  ] as const) {
    const available = new Set(
      taxonomy[kind].map((term) =>
        normalizeLabel(term.label)
      )
    );

    for (const value of values[kind]) {
      if (!available.has(normalizeLabel(value))) {
        return false;
      }
    }
  }

  return true;
}

async function readGames(client: PoolClient) {
  const result = await client.query<GamePayloadRow>(
    `SELECT draft_payload
       FROM deuna_admin.editorial_items
      WHERE item_type = 'game'
      ORDER BY item_key ASC`
  );

  return result.rows.map((row) =>
    parseEditorialPayload("game", row.draft_payload)
  );
}

export async function saveGameTaxonomyDraft(
  expectedRevision: number,
  actorUserId: string,
  input: GameTaxonomy
): Promise<GameTaxonomyMutationResult> {
  const session = await verifyAdminSession();

  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }

  return withAdminTransaction(async (client) => {
    const result = await client.query<TaxonomyItemRow>(
      `SELECT
         id,
         draft_payload,
         source_checksum,
         revision
       FROM deuna_admin.editorial_items
       WHERE item_type = 'game_taxonomy'
         AND item_key = 'games'
       LIMIT 1
       FOR UPDATE`
    );
    const item = result.rows[0];

    if (!item) return { outcome: "not_found" };

    if (item.revision !== expectedRevision) {
      return {
        outcome: "conflict",
        revision: item.revision,
      };
    }

    const current = parseEditorialPayload(
      "game_taxonomy",
      item.draft_payload
    );
    const next = normalizeEditorialPayload(
      parseEditorialPayload("game_taxonomy", input)
    );

    if (
      hashEditorialPayload(current) ===
      hashEditorialPayload(next)
    ) {
      return {
        outcome: "saved",
        revision: item.revision,
      };
    }

    const games = await readGames(client);
    if (!preservesUsedGameTerms(next, games)) {
      return {
        outcome: "in_use",
        revision: item.revision,
      };
    }

    const serialized = JSON.stringify(next);
    const digest = hashEditorialPayload(next);
    const nextRevision = item.revision + 1;
    const status =
      digest === item.source_checksum
        ? "synced"
        : "modified";

    await client.query(
      `UPDATE deuna_admin.editorial_items
       SET draft_payload = $2::jsonb,
           draft_status = $3,
           revision = $4,
           updated_at = now(),
           updated_by = $5
       WHERE id = $1`,
      [
        item.id,
        serialized,
        status,
        nextRevision,
        actorUserId,
      ]
    );

    await client.query(
      `INSERT INTO deuna_admin.editorial_revisions
         (item_id, revision, payload, action, actor_user_id)
       VALUES ($1, $2, $3::jsonb, 'draft_saved', $4)`,
      [item.id, nextRevision, serialized, actorUserId]
    );

    await client.query(
      `INSERT INTO deuna_admin.admin_audit_log
         (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'taxonomy_saved', 'game_taxonomy', 'games', $2::jsonb)`,
      [
        actorUserId,
        JSON.stringify({ revision: nextRevision }),
      ]
    );

    return {
      outcome: "saved",
      revision: nextRevision,
    };
  });
}
