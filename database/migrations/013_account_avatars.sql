CREATE TABLE IF NOT EXISTS deuna_accounts.avatars (
  user_id uuid PRIMARY KEY
    REFERENCES deuna_accounts.users(id) ON DELETE CASCADE,
  digest char(64) NOT NULL,
  image_webp bytea NOT NULL,
  width smallint NOT NULL,
  height smallint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_avatars_digest_check CHECK (
    digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT account_avatars_bytes_check CHECK (
    octet_length(image_webp) BETWEEN 20 AND 524288
  ),
  CONSTRAINT account_avatars_dimensions_check CHECK (
    width BETWEEN 64 AND 1024 AND
    height BETWEEN 64 AND 1024 AND
    width = height
  )
);

COMMENT ON TABLE deuna_accounts.avatars IS
  'Avatar privado de Mi DeUna. Sólo se sirve al usuario autenticado propietario y se elimina en cascada con la cuenta.';

COMMENT ON COLUMN deuna_accounts.avatars.image_webp IS
  'WebP saneado sin EXIF, XMP ni perfil ICC; máximo 512 KiB y formato cuadrado.';
