ALTER TABLE deuna_admin.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE deuna_admin.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner', 'admin'));

DROP INDEX IF EXISTS deuna_admin.admin_one_active_owner;

CREATE UNIQUE INDEX admin_one_active_owner
  ON deuna_admin.admin_users ((role))
  WHERE active = true AND role = 'owner';

ALTER TABLE deuna_admin.admin_users
  ADD COLUMN IF NOT EXISTS display_name varchar(80),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid
    REFERENCES deuna_admin.admin_users(id) ON DELETE SET NULL;

ALTER TABLE deuna_admin.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_display_name_check;

ALTER TABLE deuna_admin.admin_users
  ADD CONSTRAINT admin_users_display_name_check CHECK (
    display_name IS NULL OR (
      char_length(display_name) BETWEEN 1 AND 80 AND
      display_name = btrim(display_name)
    )
  );

CREATE SCHEMA IF NOT EXISTS deuna_accounts;
REVOKE ALL ON SCHEMA deuna_accounts FROM PUBLIC;

CREATE TABLE IF NOT EXISTS deuna_accounts.users (
  id uuid PRIMARY KEY,
  username varchar(40) NOT NULL,
  username_key varchar(40) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name varchar(80),
  email_encrypted text,
  bio varchar(500),
  active boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_users_username_check CHECK (
    char_length(username) BETWEEN 3 AND 40 AND
    username = btrim(username)
  ),
  CONSTRAINT account_users_username_key_check CHECK (
    char_length(username_key) BETWEEN 3 AND 40 AND
    username_key = lower(username_key)
  ),
  CONSTRAINT account_users_display_name_check CHECK (
    display_name IS NULL OR (
      char_length(display_name) BETWEEN 1 AND 80 AND
      display_name = btrim(display_name)
    )
  ),
  CONSTRAINT account_users_bio_check CHECK (
    bio IS NULL OR char_length(bio) BETWEEN 1 AND 500
  ),
  CONSTRAINT account_users_failed_login_check CHECK (
    failed_login_count BETWEEN 0 AND 1000
  )
);

CREATE TABLE IF NOT EXISTS deuna_accounts.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES deuna_accounts.users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT account_sessions_token_hash_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT account_sessions_expiry_check CHECK (
    expires_at > created_at
  )
);

CREATE INDEX IF NOT EXISTS account_sessions_active_lookup
  ON deuna_accounts.sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS account_sessions_user_lookup
  ON deuna_accounts.sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS deuna_accounts.recovery_codes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES deuna_accounts.users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  CONSTRAINT account_recovery_code_hash_check CHECK (
    code_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS account_recovery_codes_user_lookup
  ON deuna_accounts.recovery_codes (user_id, used_at);

COMMENT ON SCHEMA deuna_accounts IS
  'Cuentas públicas con minimización de datos. No almacena IP, ubicación, user-agent, huellas de dispositivo ni historial de navegación.';

COMMENT ON COLUMN deuna_accounts.users.email_encrypted IS
  'Correo opcional cifrado por la aplicación. Nunca se usa como requisito para crear una cuenta.';

COMMENT ON TABLE deuna_accounts.recovery_codes IS
  'Códigos de recuperación de un solo uso almacenados únicamente como hash.';
