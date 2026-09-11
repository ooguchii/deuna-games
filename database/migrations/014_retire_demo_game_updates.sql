-- Retira únicamente las siete actualizaciones de demostración que formaban
-- parte del fixture bundled original. El historial de publicaciones se
-- conserva intacto y una actualización que haya sido publicada con cambios
-- editoriales no se toca: en ese caso el snapshot público ya no coincide con
-- la fuente demo que la originó.
UPDATE deuna_admin.editorial_items
SET public_visible = false,
    updated_at = now()
WHERE item_type = 'game_update'
  AND item_key IN (
    'elden-ring-v1-10-1',
    'palworld-v0-3-2',
    'stellar-blade-v1-3-1',
    'enshrouded-v0-8-5',
    'helldivers-2-v1-000-302',
    'talos-principle-2-v1-2-0',
    'god-of-war-ragnarok-v1-5-3'
  )
  AND public_visible = true
  AND published_checksum = source_checksum
  AND published_payload = source_payload;
