CREATE TABLE IF NOT EXISTS deuna_accounts.game_ratings (
  user_id uuid NOT NULL
    REFERENCES deuna_accounts.account_users(id)
    ON DELETE CASCADE,
  game_slug text NOT NULL,
  rating smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_ratings_primary_key PRIMARY KEY (user_id, game_slug),
  CONSTRAINT game_ratings_slug_check CHECK (
    game_slug ~ '^[a-z0-9][a-z0-9-]{0,159}$'
  ),
  CONSTRAINT game_ratings_value_check CHECK (
    rating BETWEEN 1 AND 5
  )
);

CREATE INDEX IF NOT EXISTS game_ratings_by_game
  ON deuna_accounts.game_ratings (
    game_slug,
    updated_at DESC
  );

CREATE TABLE IF NOT EXISTS deuna_admin.game_insight_scores (
  game_slug text PRIMARY KEY,
  score numeric(5,2) NOT NULL,
  confidence varchar(12) NOT NULL,
  evidence_count bigint NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_by uuid
    REFERENCES deuna_admin.admin_users(id)
    ON DELETE SET NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_insight_scores_slug_check CHECK (
    game_slug ~ '^[a-z0-9][a-z0-9-]{0,159}$'
  ),
  CONSTRAINT game_insight_scores_value_check CHECK (
    score >= 0 AND score <= 100
  ),
  CONSTRAINT game_insight_scores_confidence_check CHECK (
    confidence IN ('low', 'medium', 'high')
  ),
  CONSTRAINT game_insight_scores_evidence_check CHECK (
    evidence_count >= 0
  ),
  CONSTRAINT game_insight_scores_breakdown_check CHECK (
    jsonb_typeof(breakdown) = 'object'
  )
);

COMMENT ON TABLE deuna_accounts.game_ratings IS
  'Valoraciones explícitas 1–5 de usuarios autenticados. Un usuario mantiene un único voto modificable por juego.';

COMMENT ON TABLE deuna_admin.game_insight_scores IS
  'Snapshots del Índice DeUna calculados exclusivamente desde señales de cuenta agregadas y valoraciones reales; no almacena navegación, IP, ubicación ni huellas de visitantes.';
