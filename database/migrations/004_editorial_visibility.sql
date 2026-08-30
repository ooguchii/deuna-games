ALTER TABLE deuna_admin.editorial_items
  ADD COLUMN IF NOT EXISTS public_visible boolean;

UPDATE deuna_admin.editorial_items
SET public_visible = true
WHERE public_visible IS NULL;

ALTER TABLE deuna_admin.editorial_items
  ALTER COLUMN public_visible SET NOT NULL,
  ALTER COLUMN public_visible SET DEFAULT true;

ALTER TABLE deuna_admin.editorial_revisions
  DROP CONSTRAINT IF EXISTS editorial_revisions_action_check,
  ADD CONSTRAINT editorial_revisions_action_check CHECK (
    action IN (
      'imported',
      'source_refreshed',
      'created',
      'draft_saved',
      'draft_restored'
    )
  );

COMMENT ON COLUMN deuna_admin.editorial_items.public_visible IS
  'Control explicito de visibilidad publica. Los contenidos creados en el panel nacen ocultos y solo se activan mediante Publicar.';
