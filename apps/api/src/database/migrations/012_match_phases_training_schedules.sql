ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'regular_league',
  ADD COLUMN IF NOT EXISTS league_tier text;

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_phase_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_phase_check
  CHECK (phase IN ('preliminary', 'regular_league', 'playoffs', 'cup', 'friendly', 'tournament', 'other'));

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_league_tier_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_league_tier_check
  CHECK (league_tier IS NULL OR league_tier IN ('bronze', 'silver', 'gold'));

CREATE TABLE IF NOT EXISTS team_training_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  venue_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (team_id, weekday, starts_at)
);

CREATE INDEX IF NOT EXISTS team_training_schedules_team_idx
  ON team_training_schedules (team_id, weekday, starts_at);
