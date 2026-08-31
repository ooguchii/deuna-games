CREATE TABLE deuna_accounts.reward_profiles (
  user_id uuid PRIMARY KEY
    REFERENCES deuna_accounts.users(id)
    ON DELETE CASCADE,
  xp_total bigint NOT NULL DEFAULT 0,
  credits_balance bigint NOT NULL DEFAULT 0,
  streak_days integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_claim_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reward_profiles_xp_check CHECK (
    xp_total >= 0 AND xp_total <= 1000000000
  ),
  CONSTRAINT reward_profiles_credits_check CHECK (
    credits_balance >= 0 AND credits_balance <= 1000000000
  ),
  CONSTRAINT reward_profiles_streak_check CHECK (
    streak_days >= 0 AND streak_days <= 1000000
  ),
  CONSTRAINT reward_profiles_best_streak_check CHECK (
    best_streak >= streak_days AND best_streak <= 1000000
  )
);

CREATE TABLE deuna_accounts.reward_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES deuna_accounts.users(id)
    ON DELETE CASCADE,
  event_type varchar(64) NOT NULL,
  event_key varchar(160) NOT NULL,
  xp_delta integer NOT NULL DEFAULT 0,
  credits_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reward_events_type_check CHECK (
    event_type ~ '^[a-z][a-z0-9_]{0,63}$'
  ),
  CONSTRAINT reward_events_key_check CHECK (
    event_key ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$'
  ),
  CONSTRAINT reward_events_xp_check CHECK (
    xp_delta >= 0 AND xp_delta <= 1000000
  ),
  CONSTRAINT reward_events_credits_check CHECK (
    credits_delta >= -1000000 AND credits_delta <= 1000000
  ),
  CONSTRAINT reward_events_nonzero_check CHECK (
    xp_delta <> 0 OR credits_delta <> 0
  ),
  UNIQUE (user_id, event_type, event_key)
);

CREATE INDEX reward_events_user_created_idx
  ON deuna_accounts.reward_events (user_id, created_at DESC);

CREATE INDEX reward_events_user_type_created_idx
  ON deuna_accounts.reward_events (user_id, event_type, created_at DESC);

REVOKE ALL ON deuna_accounts.reward_profiles FROM PUBLIC;
REVOKE ALL ON deuna_accounts.reward_events FROM PUBLIC;
