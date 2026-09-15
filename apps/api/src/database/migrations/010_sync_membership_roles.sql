CREATE OR REPLACE FUNCTION sync_membership_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.roles IS NULL OR cardinality(NEW.roles) = 0 THEN
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

UPDATE club_memberships
SET roles = ARRAY[role]::membership_role[]
WHERE roles IS NULL OR cardinality(roles) = 0;
