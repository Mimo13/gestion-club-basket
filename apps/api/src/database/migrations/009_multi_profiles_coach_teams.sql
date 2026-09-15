ALTER TABLE club_memberships
  ADD COLUMN IF NOT EXISTS roles membership_role[] NOT NULL DEFAULT ARRAY[]::membership_role[];

UPDATE club_memberships
SET roles = ARRAY[role]::membership_role[]
WHERE cardinality(roles) = 0;

CREATE OR REPLACE FUNCTION sync_membership_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF cardinality(NEW.roles) = 0 THEN
    NEW.roles := ARRAY[NEW.role]::membership_role[];
  ELSIF NEW.role <> NEW.roles[1] THEN
    NEW.role := NEW.roles[1];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS club_memberships_sync_roles ON club_memberships;
CREATE TRIGGER club_memberships_sync_roles
BEFORE INSERT OR UPDATE ON club_memberships
FOR EACH ROW EXECUTE FUNCTION sync_membership_roles();

ALTER TABLE club_memberships
  DROP CONSTRAINT IF EXISTS club_memberships_roles_not_empty;

ALTER TABLE club_memberships
  ADD CONSTRAINT club_memberships_roles_not_empty CHECK (cardinality(roles) > 0);

CREATE TABLE IF NOT EXISTS user_team_coaches (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, team_id)
);

CREATE INDEX IF NOT EXISTS user_team_coaches_team_idx ON user_team_coaches (team_id, user_id);
