CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_status AS ENUM ('active', 'invited', 'disabled');
CREATE TYPE membership_role AS ENUM ('club_admin', 'coordinator', 'coach', 'assistant', 'viewer');
CREATE TYPE team_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE team_gender AS ENUM ('female', 'male', 'mixed', 'unspecified');
CREATE TYPE person_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE activity_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE match_status AS ENUM ('scheduled', 'completed', 'postponed', 'cancelled');

CREATE TABLE clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 160),
  password_hash text,
  status user_status NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE club_memberships (
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role membership_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  UNIQUE (club_id, name)
);

CREATE UNIQUE INDEX seasons_one_current_per_club ON seasons (club_id) WHERE is_current;

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 80),
  gender team_gender NOT NULL DEFAULT 'unspecified',
  status team_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, name),
  UNIQUE (id, club_id)
);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  first_name text NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 120),
  birth_date date,
  email text,
  phone text,
  status person_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
  current_team_id uuid,
  jersey_number smallint CHECK (jersey_number BETWEEN 0 AND 99),
  positions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (current_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE TABLE team_coaches (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, person_id)
);

CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status activity_status NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL UNIQUE REFERENCES activities(id) ON DELETE CASCADE,
  opponent_name text NOT NULL CHECK (length(trim(opponent_name)) BETWEEN 1 AND 160),
  is_home boolean NOT NULL,
  competition text,
  status match_status NOT NULL DEFAULT 'scheduled',
  home_score smallint CHECK (home_score IS NULL OR home_score >= 0),
  away_score smallint CHECK (away_score IS NULL OR away_score >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  note text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, player_id)
);

CREATE TABLE match_player_stats (
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  minutes_played smallint CHECK (minutes_played IS NULL OR minutes_played >= 0),
  points smallint CHECK (points IS NULL OR points >= 0),
  assists smallint CHECK (assists IS NULL OR assists >= 0),
  rebounds smallint CHECK (rebounds IS NULL OR rebounds >= 0),
  steals smallint CHECK (steals IS NULL OR steals >= 0),
  blocks smallint CHECK (blocks IS NULL OR blocks >= 0),
  turnovers smallint CHECK (turnovers IS NULL OR turnovers >= 0),
  comments text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 120),
  entity_type text NOT NULL CHECK (length(trim(entity_type)) BETWEEN 1 AND 80),
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teams_club_season_idx ON teams (club_id, season_id);
CREATE INDEX people_club_status_idx ON people (club_id, status);
CREATE INDEX activities_team_starts_idx ON activities (team_id, starts_at);
CREATE INDEX matches_status_idx ON matches (status);
CREATE INDEX attendance_player_idx ON attendance (player_id);
CREATE INDEX audit_events_club_created_idx ON audit_events (club_id, created_at DESC);

INSERT INTO clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Club de baloncesto', 'club-basket')
ON CONFLICT (id) DO NOTHING;

INSERT INTO seasons (id, club_id, name, starts_on, ends_on, is_current)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '2025/2026',
  '2025-09-01',
  '2026-08-31',
  true
)
ON CONFLICT (id) DO NOTHING;
