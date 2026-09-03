ALTER TABLE deuna_admin.editorial_items
  ADD COLUMN IF NOT EXISTS published_payload jsonb,
  ADD COLUMN IF NOT EXISTS published_checksum char(64),
  ADD COLUMN IF NOT EXISTS published_from_revision integer,
  ADD COLUMN IF NOT EXISTS publication_number integer,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid
    REFERENCES deuna_admin.admin_users(id)
    ON DELETE SET NULL;

UPDATE deuna_admin.editorial_items
SET published_payload = source_payload,
    published_checksum = source_checksum,
    publication_number = 1,
    published_at = now(),
    published_by = NULL
WHERE published_payload IS NULL
   OR published_checksum IS NULL
   OR publication_number IS NULL
   OR published_at IS NULL;

ALTER TABLE deuna_admin.editorial_items
  ALTER COLUMN published_payload SET NOT NULL,
  ALTER COLUMN published_checksum SET NOT NULL,
  ALTER COLUMN publication_number SET NOT NULL,
  ALTER COLUMN publication_number SET DEFAULT 1,
  ALTER COLUMN published_at SET NOT NULL,
  ALTER COLUMN published_at SET DEFAULT now();

ALTER TABLE deuna_admin.editorial_items
  DROP CONSTRAINT IF EXISTS editorial_items_published_payload_check,
  ADD CONSTRAINT editorial_items_published_payload_check CHECK (
    jsonb_typeof(published_payload) = 'object'
  ),
  DROP CONSTRAINT IF EXISTS editorial_items_published_checksum_check,
  ADD CONSTRAINT editorial_items_published_checksum_check CHECK (
    published_checksum ~ '^[0-9a-f]{64}$'
  ),
  DROP CONSTRAINT IF EXISTS editorial_items_published_revision_check,
  ADD CONSTRAINT editorial_items_published_revision_check CHECK (
    published_from_revision IS NULL OR
    published_from_revision >= 1
  ),
  DROP CONSTRAINT IF EXISTS editorial_items_publication_number_check,
  ADD CONSTRAINT editorial_items_publication_number_check CHECK (
    publication_number >= 1
  );

CREATE TABLE IF NOT EXISTS deuna_admin.editorial_publications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id uuid NOT NULL
    REFERENCES deuna_admin.editorial_items(id)
    ON DELETE CASCADE,
  publication_number integer NOT NULL,
  payload jsonb NOT NULL,
  checksum char(64) NOT NULL,
  source_revision integer,
  action varchar(30) NOT NULL,
  actor_user_id uuid
    REFERENCES deuna_admin.admin_users(id)
    ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_publications_number_check CHECK (
    publication_number >= 1
  ),
  CONSTRAINT editorial_publications_payload_check CHECK (
    jsonb_typeof(payload) = 'object'
  ),
  CONSTRAINT editorial_publications_checksum_check CHECK (
    checksum ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT editorial_publications_source_revision_check CHECK (
    source_revision IS NULL OR source_revision >= 1
  ),
  CONSTRAINT editorial_publications_action_check CHECK (
    action IN ('bootstrap', 'published', 'rollback')
  ),
  CONSTRAINT editorial_publications_item_number_unique UNIQUE (
    item_id,
    publication_number
  )
);

CREATE INDEX IF NOT EXISTS editorial_publications_recent
  ON deuna_admin.editorial_publications (
    item_id,
    publication_number DESC
  );

INSERT INTO deuna_admin.editorial_publications (
  item_id,
  publication_number,
  payload,
  checksum,
  source_revision,
  action,
  actor_user_id,
  created_at
)
SELECT
  item.id,
  1,
  item.published_payload,
  item.published_checksum,
  item.published_from_revision,
  'bootstrap',
  NULL,
  item.published_at
FROM deuna_admin.editorial_items AS item
WHERE NOT EXISTS (
  SELECT 1
  FROM deuna_admin.editorial_publications AS publication
  WHERE publication.item_id = item.id
);

COMMENT ON COLUMN deuna_admin.editorial_items.published_payload IS
  'Snapshot actualmente publicado. Se mantiene separado del borrador para que guardar y publicar sean operaciones independientes.';

COMMENT ON TABLE deuna_admin.editorial_publications IS
  'Historial inmutable de snapshots publicados y reversiones editoriales, sin datos de visitantes.';
