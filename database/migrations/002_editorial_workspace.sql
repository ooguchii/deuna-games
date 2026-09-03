CREATE TABLE IF NOT EXISTS deuna_admin.editorial_items (
  id uuid PRIMARY KEY,
  item_type varchar(30) NOT NULL,
  item_key varchar(160) NOT NULL,
  source_payload jsonb NOT NULL,
  source_checksum char(64) NOT NULL,
  source_present boolean NOT NULL DEFAULT true,
  draft_payload jsonb NOT NULL,
  draft_status varchar(20) NOT NULL DEFAULT 'synced',
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES deuna_admin.admin_users(id) ON DELETE SET NULL,
  CONSTRAINT editorial_items_identity_unique UNIQUE (item_type, item_key),
  CONSTRAINT editorial_items_type_check CHECK (
    item_type IN ('game', 'game_update', 'site_config')
  ),
  CONSTRAINT editorial_items_key_check CHECK (
    char_length(item_key) BETWEEN 1 AND 160 AND
    item_key = btrim(item_key)
  ),
  CONSTRAINT editorial_items_source_check CHECK (
    jsonb_typeof(source_payload) = 'object'
  ),
  CONSTRAINT editorial_items_draft_check CHECK (
    jsonb_typeof(draft_payload) = 'object'
  ),
  CONSTRAINT editorial_items_checksum_check CHECK (
    source_checksum ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT editorial_items_status_check CHECK (
    draft_status IN ('synced', 'modified')
  ),
  CONSTRAINT editorial_items_revision_check CHECK (revision >= 1)
);

CREATE INDEX IF NOT EXISTS editorial_items_type_status
  ON deuna_admin.editorial_items (item_type, draft_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS editorial_items_title
  ON deuna_admin.editorial_items (
    item_type,
    lower(COALESCE(draft_payload ->> 'title', draft_payload ->> 'name', item_key))
  );

CREATE TABLE IF NOT EXISTS deuna_admin.editorial_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES deuna_admin.editorial_items(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  payload jsonb NOT NULL,
  action varchar(30) NOT NULL,
  actor_user_id uuid REFERENCES deuna_admin.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_revisions_item_revision_unique UNIQUE (item_id, revision),
  CONSTRAINT editorial_revisions_number_check CHECK (revision >= 1),
  CONSTRAINT editorial_revisions_payload_check CHECK (
    jsonb_typeof(payload) = 'object'
  ),
  CONSTRAINT editorial_revisions_action_check CHECK (
    action IN ('imported', 'source_refreshed', 'draft_saved', 'draft_restored')
  )
);

CREATE INDEX IF NOT EXISTS editorial_revisions_recent
  ON deuna_admin.editorial_revisions (item_id, revision DESC);

COMMENT ON TABLE deuna_admin.editorial_items IS
  'Área editorial privada. Guarda la fuente importada y el borrador; no contiene actividad de visitantes.';

COMMENT ON TABLE deuna_admin.editorial_revisions IS
  'Historial inmutable de contenido administrativo para recuperar borradores, sin IP ni datos de visitantes.';
