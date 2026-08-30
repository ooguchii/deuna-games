import {
  randomUUID,
} from "node:crypto";
import process from "node:process";

import {
  Pool,
  type PoolClient,
} from "pg";

import {
  sourceAboutConfig,
} from "../../src/data/about-config.ts";
import { games } from "../../src/data/games.ts";
import {
  sourceHomeConfig,
} from "../../src/data/home-config.ts";
import {
  gameUpdates,
} from "../../src/data/update-records.ts";
import {
  siteConfig,
} from "../../src/lib/site.ts";
import {
  hashEditorialPayload,
  normalizeEditorialPayload,
} from "../../src/lib/admin/content-hash.ts";
import {
  parseEditorialPayload,
  type EditorialItemType,
} from "../../src/lib/admin/content-validation.ts";
import {
  getAdminDatabaseConfig,
} from "../../src/lib/admin/database-config.ts";

type SourceItem = {
  type: EditorialItemType;
  key: string;
  payload: Record<string, unknown>;
};

type ExistingItemRow = {
  id: string;
  source_checksum: string;
  draft_status: "synced" | "modified";
  revision: number;
};

const importLockKey = 1_926_042_787;
const validateOnly = process.argv.includes(
  "--validate-only"
);

function buildSourceItems(): SourceItem[] {
  if (
    games.length === 0 ||
    gameUpdates.length === 0
  ) {
    throw new Error(
      "La fuente editorial no puede importarse vacía."
    );
  }

  const gameSlugs = new Set(
    games.map((game) => game.slug)
  );

  for (const update of gameUpdates) {
    if (!gameSlugs.has(update.gameSlug)) {
      throw new Error(
        `La actualización ${update.id} referencia un juego inexistente.`
      );
    }
  }

  const homeConfig = normalizeEditorialPayload(
    parseEditorialPayload(
      "home_config",
      sourceHomeConfig
    )
  );
  const aboutConfig = normalizeEditorialPayload(
    parseEditorialPayload(
      "about_config",
      sourceAboutConfig
    )
  );

  for (const slug of new Set([
    ...homeConfig.heroSlugs,
    ...homeConfig.popularSlugs,
    ...homeConfig.lowSpecSlugs,
    ...homeConfig.recommendedSlugs,
  ])) {
    if (!gameSlugs.has(slug)) {
      throw new Error(
        `La portada fuente referencia el juego inexistente ${slug}.`
      );
    }
  }

  const items: SourceItem[] = [
    ...games.map((game) => ({
      type: "game" as const,
      key: game.slug,
      payload: normalizeEditorialPayload(
        parseEditorialPayload("game", game)
      ) as unknown as Record<string, unknown>,
    })),
    ...gameUpdates.map((update) => ({
      type: "game_update" as const,
      key: update.id,
      payload: normalizeEditorialPayload(
        parseEditorialPayload(
          "game_update",
          update
        )
      ) as unknown as Record<string, unknown>,
    })),
    {
      type: "site_config",
      key: "site",
      payload: normalizeEditorialPayload(
        parseEditorialPayload(
          "site_config",
          siteConfig
        )
      ) as Record<string, unknown>,
    },
    {
      type: "home_config",
      key: "home",
      payload: homeConfig as unknown as Record<string, unknown>,
    },
    {
      type: "about_config",
      key: "about",
      payload: aboutConfig as unknown as Record<string, unknown>,
    },
  ];
  const identities = new Set<string>();

  for (const item of items) {
    const identity = `${item.type}:${item.key}`;

    if (identities.has(identity)) {
      throw new Error(
        `Identidad editorial duplicada: ${identity}`
      );
    }

    identities.add(identity);
  }

  return items;
}

async function importItem(
  client: PoolClient,
  item: SourceItem
) {
  const payload = JSON.stringify(item.payload);
  const digest = hashEditorialPayload(item.payload);
  const existing = await client.query<ExistingItemRow>(
    `SELECT
       id,
       source_checksum,
       draft_status,
       revision
     FROM deuna_admin.editorial_items
     WHERE item_type = $1
       AND item_key = $2
     LIMIT 1
     FOR UPDATE`,
    [item.type, item.key]
  );
  const current = existing.rows[0];

  if (!current) {
    const id = randomUUID();

    await client.query(
      `INSERT INTO deuna_admin.editorial_items
         (
           id,
           item_type,
           item_key,
           source_payload,
           source_checksum,
           draft_payload,
           published_payload,
           published_checksum,
           publication_number
         )
       VALUES (
         $1,
         $2,
         $3,
         $4::jsonb,
         $5,
         $4::jsonb,
         $4::jsonb,
         $5,
         1
       )`,
      [id, item.type, item.key, payload, digest]
    );
    await client.query(
      `INSERT INTO deuna_admin.editorial_revisions
         (item_id, revision, payload, action)
       VALUES ($1, 1, $2::jsonb, 'imported')`,
      [id, payload]
    );
    await client.query(
      `INSERT INTO deuna_admin.editorial_publications
         (
           item_id,
           publication_number,
           payload,
           checksum,
           source_revision,
           action
         )
       VALUES ($1, 1, $2::jsonb, $3, 1, 'bootstrap')`,
      [id, payload, digest]
    );

    return "created" as const;
  }

  if (current.source_checksum === digest) {
    await client.query(
      `UPDATE deuna_admin.editorial_items
       SET source_present = true,
           source_imported_at = now()
       WHERE id = $1`,
      [current.id]
    );

    return "unchanged" as const;
  }

  if (current.draft_status === "modified") {
    await client.query(
      `UPDATE deuna_admin.editorial_items
       SET source_payload = $2::jsonb,
           source_checksum = $3,
           source_present = true,
           source_imported_at = now()
       WHERE id = $1`,
      [current.id, payload, digest]
    );

    return "conflict" as const;
  }

  const nextRevision = current.revision + 1;

  await client.query(
    `UPDATE deuna_admin.editorial_items
     SET source_payload = $2::jsonb,
         source_checksum = $3,
         source_present = true,
         draft_payload = $2::jsonb,
         draft_status = 'synced',
         revision = $4,
         source_imported_at = now(),
         updated_at = now(),
         updated_by = NULL
     WHERE id = $1`,
    [current.id, payload, digest, nextRevision]
  );
  await client.query(
    `INSERT INTO deuna_admin.editorial_revisions
       (item_id, revision, payload, action)
     VALUES ($1, $2, $3::jsonb, 'source_refreshed')`,
    [current.id, nextRevision, payload]
  );

  return "refreshed" as const;
}

async function markMissingSources(
  client: PoolClient,
  items: SourceItem[]
) {
  let missing = 0;

  for (const type of [
    "game",
    "game_update",
    "site_config",
    "home_config",
    "about_config",
  ] satisfies EditorialItemType[]) {
    const keys = items
      .filter((item) => item.type === type)
      .map((item) => item.key);
    const result = await client.query(
      `UPDATE deuna_admin.editorial_items
       SET source_present = false,
           source_imported_at = now()
       WHERE item_type = $1
         AND source_present = true
         AND NOT (item_key = ANY($2::text[]))`,
      [type, keys]
    );

    missing += result.rowCount ?? 0;
  }

  return missing;
}

async function main() {
  const items = buildSourceItems();

  if (validateOnly) {
    console.log(
      `Contenido editorial validado: ${games.length} juegos, ${gameUpdates.length} actualizaciones, 1 configuración, 1 portada y 1 página institucional.`
    );
    return;
  }

  const pool = new Pool(
    getAdminDatabaseConfig("migration")
  );
  const client = await pool.connect();
  const counts = {
    created: 0,
    unchanged: 0,
    refreshed: 0,
    conflict: 0,
    missing: 0,
  };

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [importLockKey]
    );

    for (const item of items) {
      const result = await importItem(client, item);
      counts[result] += 1;
    }

    counts.missing = await markMissingSources(
      client,
      items
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(
    `Importación editorial completa: ${counts.created} creados, ${counts.refreshed} actualizados, ${counts.unchanged} sin cambios, ${counts.conflict} borradores preservados ante conflicto y ${counts.missing} fuentes ausentes conservadas.`
  );
}

main().catch(() => {
  console.error(
    "No se pudo importar el contenido editorial. Ejecuta primero las migraciones y revisa la conexión privada."
  );
  process.exitCode = 1;
});
