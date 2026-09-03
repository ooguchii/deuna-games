CREATE SCHEMA IF NOT EXISTS deuna_admin;

REVOKE ALL ON SCHEMA deuna_admin FROM PUBLIC;

CREATE TABLE IF NOT EXISTS deuna_admin.admin_users (
  id uuid PRIMARY KEY,
  username varchar(40) NOT NULL,
  username_key varchar(40) NOT NULL UNIQUE,
  role varchar(20) NOT NULL DEFAULT 'owner',
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_role_check CHECK (role = 'owner'),
  CONSTRAINT admin_users_username_check CHECK (
    char_length(username) BETWEEN 3 AND 40 AND
    username = btrim(username)
  ),
  CONSTRAINT admin_users_username_key_check CHECK (
    char_length(username_key) BETWEEN 3 AND 40 AND
    username_key = lower(username_key)
  ),
  CONSTRAINT admin_users_failed_login_check CHECK (
    failed_login_count BETWEEN 0 AND 1000
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_one_active_owner
  ON deuna_admin.admin_users ((role))
  WHERE active = true;

CREATE TABLE IF NOT EXISTS deuna_admin.admin_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES deuna_admin.admin_users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT admin_sessions_token_hash_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT admin_sessions_expiry_check CHECK (
    expires_at > created_at
  )
);

CREATE INDEX IF NOT EXISTS admin_sessions_active_lookup
  ON deuna_admin.admin_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS admin_sessions_user_lookup
  ON deuna_admin.admin_sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS deuna_admin.admin_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES deuna_admin.admin_users(id) ON DELETE SET NULL,
  event_type varchar(60) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT admin_events_type_check CHECK (
    char_length(event_type) BETWEEN 3 AND 60
  ),
  CONSTRAINT admin_events_details_check CHECK (
    jsonb_typeof(details) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS admin_events_recent
  ON deuna_admin.admin_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS deuna_admin.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES deuna_admin.admin_users(id) ON DELETE SET NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(60) NOT NULL,
  entity_id varchar(160),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT admin_audit_action_check CHECK (
    char_length(action) BETWEEN 3 AND 80
  ),
  CONSTRAINT admin_audit_entity_check CHECK (
    char_length(entity_type) BETWEEN 3 AND 60
  ),
  CONSTRAINT admin_audit_details_check CHECK (
    jsonb_typeof(details) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS admin_audit_recent
  ON deuna_admin.admin_audit_log (occurred_at DESC);

COMMENT ON SCHEMA deuna_admin IS
  'Datos privados del panel. No almacena actividad de visitantes, IP, ubicación ni huellas de dispositivo.';

COMMENT ON TABLE deuna_admin.admin_events IS
  'Eventos mínimos de autenticación del propietario, sin IP ni user-agent.';

COMMENT ON TABLE deuna_admin.admin_audit_log IS
  'Cambios administrativos: actor, acción, entidad y fecha; sin rastreo de visitantes.';
