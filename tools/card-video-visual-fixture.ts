import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import {
  hashEditorialPayload,
  normalizeEditorialPayload,
} from "../src/lib/admin/content-hash";
import { parseEditorialPayload } from "../src/lib/admin/content-validation";
import { getAdminDatabaseConfig } from "../src/lib/admin/database-config";

const FIXTURE_FLAG = "DEUNA_CARD_VIDEO_VISUAL_FIXTURE";
const FIXTURE_CLIP = "/__visual-fixtures/card-video.webm";
const FIXTURE_WEBM_BASE64 =
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAIwEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggIa7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAf0AAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WI/QvhMWERGgmcgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QdzWUA4JCwgUC6gSSagQJVsIRVuYEBElTDZ0B/c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2MS43LjEwM3Nz2mPAi2PFiP0L4TFhERoJZ8ilRaOHRU5DT0RFUkSHmExhdmM2MS4xOS4xMDEgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDAuNTAwMDAwMDAwAB9DtnXt54EAo+iBAACAgkmDQgAD8AI2BjgkHBhCAAAgQABrQ///6UT+4KU3o8VSrdtJ/1U/RntlFLTcdJsyP6m92VMvCYN3//3Ceh0emoFV9EmWoW/eg7Wi7Hj2c8ZrczM2o/qbSj6QjAHsSPtzSmIhoBxTu2uRu4+zgQC3iveBAfGCAajwgQM=";

function assertVisualCiOnly() {
  if (
    process.env[FIXTURE_FLAG] !== "1" ||
    process.env.CI !== "true" ||
    process.env.DEUNA_VISUAL_OUTPUT_DIR === undefined ||
    process.env.DEUNA_VISUAL_ADMIN_USERNAME === undefined
  ) {
    throw new Error(
      `${FIXTURE_FLAG}=1 sólo puede usarse dentro del job visual aislado de CI.`
    );
  }

  const host = process.env.DEUNA_DATABASE_HOST?.trim();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(
      "El fixture visual de Card video exige una PostgreSQL local/efímera."
    );
  }
}

async function writeFixtureWebm() {
  const destination = path.resolve(
    ".next/standalone/public/__visual-fixtures/card-video.webm"
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(FIXTURE_WEBM_BASE64, "base64"));
}

async function main() {
  assertVisualCiOnly();
  await writeFixtureWebm();

  const client = new Client(getAdminDatabaseConfig("migration"));
  await client.connect();

  try {
    await client.query("BEGIN");

    const actorResult = await client.query<{ id: string }>(
      `SELECT id::text
       FROM deuna_admin.admin_users
       WHERE username_key = lower($1)
         AND active = true
       LIMIT 1`,
      [process.env.DEUNA_VISUAL_ADMIN_USERNAME]
    );
    const actorUserId = actorResult.rows[0]?.id;
    if (!actorUserId) {
      throw new Error("No se encontró el owner visual aislado de CI.");
    }

    const itemResult = await client.query<{
      id: string;
      item_key: string;
      source_checksum: string;
      published_payload: unknown;
      revision: number;
      publication_number: number;
    }>(
      `SELECT
         id::text,
         item_key,
         source_checksum,
         published_payload,
         revision,
         publication_number
       FROM deuna_admin.editorial_items
       WHERE item_type = 'game'
         AND public_visible = true
         AND COALESCE(published_payload ->> 'cardImage', '') <> ''
       ORDER BY item_key ASC
       LIMIT 1
       FOR UPDATE`
    );
    const item = itemResult.rows[0];
    if (!item) {
      throw new Error(
        "No hay un juego publicado con Card base para el fixture visual."
      );
    }

    const current = parseEditorialPayload("game", item.published_payload);
    const next = parseEditorialPayload("game", {
      ...current,
      mediaModes: {
        ...(current.mediaModes ?? {}),
        card: "video",
      },
      videoMedia: {
        ...(current.videoMedia ?? {}),
        card: {
          source: "independent",
          clip: FIXTURE_CLIP,
          viewport: {
            x: 0.5,
            y: 0.5,
            zoom: 1,
            aspect: "3:2",
            confirmed: true,
          },
          playback: "always",
        },
      },
    });
    const normalized = normalizeEditorialPayload(next);
    const serialized = JSON.stringify(normalized);
    const digest = hashEditorialPayload(normalized);
    const draftStatus =
      digest === item.source_checksum ? "synced" : "modified";
    const nextRevision = item.revision + 1;
    const nextPublication = item.publication_number + 1;

    await client.query(
      `UPDATE deuna_admin.editorial_items
       SET draft_payload = $2::jsonb,
           draft_status = $3,
           revision = $4,
           updated_at = now(),
           updated_by = $5
       WHERE id = $1`,
      [item.id, serialized, draftStatus, nextRevision, actorUserId]
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
       VALUES ($1, 'draft_saved', 'game', $2, $3::jsonb)`,
      [
        actorUserId,
        item.item_key,
        JSON.stringify({
          revision: nextRevision,
          fixture: "card-video-browser-runtime",
        }),
      ]
    );

    await client.query(
      `UPDATE deuna_admin.editorial_items
       SET published_payload = $2::jsonb,
           published_checksum = $3,
           published_from_revision = $4,
           publication_number = $5,
           published_at = now(),
           published_by = $6,
           public_visible = true
       WHERE id = $1`,
      [
        item.id,
        serialized,
        digest,
        nextRevision,
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
        nextRevision,
        actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO deuna_admin.admin_audit_log
         (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'content_published', 'game', $2, $3::jsonb)`,
      [
        actorUserId,
        item.item_key,
        JSON.stringify({
          publicationNumber: nextPublication,
          revision: nextRevision,
          firstVisibility: false,
          fixture: "card-video-browser-runtime",
        }),
      ]
    );

    await client.query("COMMIT");

    const outputRoot = path.resolve(
      process.env.DEUNA_VISUAL_OUTPUT_DIR ?? "artifacts/visual-smoke"
    );
    await mkdir(outputRoot, { recursive: true });
    await writeFile(
      path.join(outputRoot, "card-video-fixture.json"),
      `${JSON.stringify(
        {
          itemKey: item.item_key,
          slug: normalized.slug,
          clip: FIXTURE_CLIP,
          revision: nextRevision,
          publicationNumber: nextPublication,
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    console.log(
      `Card video visual fixture: OK (${normalized.slug}, revision=${nextRevision}, publication=${nextPublication}).`
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

await main();
