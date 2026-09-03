CREATE TABLE deuna_accounts.game_preferences (
  user_id uuid NOT NULL
    REFERENCES deuna_accounts.users(id)
    ON DELETE CASCADE,
  game_slug varchar(160) NOT NULL,
  favorite boolean NOT NULL DEFAULT false,
  library_state text,
  follow_updates boolean NOT NULL DEFAULT false,
  followed_at timestamptz,
  updates_seen_through timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_slug),
  CONSTRAINT game_preferences_slug_check CHECK (
    game_slug ~ '^[a-z0-9][a-z0-9._-]{0,159}$'
  ),
  CONSTRAINT game_preferences_library_state_check CHECK (
    library_state IS NULL OR
    library_state IN ('want_to_play', 'playing', 'completed')
  ),
  CONSTRAINT game_preferences_follow_state_check CHECK (
    (
      follow_updates = true AND
      followed_at IS NOT NULL
    ) OR (
      follow_updates = false AND
      followed_at IS NULL AND
      updates_seen_through IS NULL
    )
  ),
  CONSTRAINT game_preferences_meaningful_check CHECK (
    favorite = true OR
    library_state IS NOT NULL OR
    follow_updates = true
  )
);

CREATE INDEX game_preferences_user_follow_idx
  ON deuna_accounts.game_preferences (user_id, follow_updates)
  WHERE follow_updates = true;

CREATE TABLE deuna_accounts.hardware_profiles (
  user_id uuid PRIMARY KEY
    REFERENCES deuna_accounts.users(id)
    ON DELETE CASCADE,
  cpu_id varchar(120) NOT NULL,
  gpu_id varchar(120) NOT NULL,
  ram_gb numeric(5,1) NOT NULL,
  memory_mode text NOT NULL DEFAULT 'unknown',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hardware_profiles_cpu_id_check CHECK (
    cpu_id ~ '^[a-z0-9][a-z0-9._-]{0,119}$'
  ),
  CONSTRAINT hardware_profiles_gpu_id_check CHECK (
    gpu_id ~ '^[a-z0-9][a-z0-9._-]{0,119}$'
  ),
  CONSTRAINT hardware_profiles_ram_check CHECK (
    ram_gb >= 1 AND ram_gb <= 256
  ),
  CONSTRAINT hardware_profiles_memory_mode_check CHECK (
    memory_mode IN ('unknown', 'single', 'dual')
  )
);

REVOKE ALL ON deuna_accounts.game_preferences FROM PUBLIC;
REVOKE ALL ON deuna_accounts.hardware_profiles FROM PUBLIC;
