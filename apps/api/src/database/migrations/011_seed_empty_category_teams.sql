INSERT INTO teams (club_id, season_id, name, category, category_id, gender, status)
SELECT
  c.club_id,
  s.id,
  c.name,
  c.name,
  c.id,
  'unspecified',
  'active'
FROM categories c
JOIN seasons s
  ON s.club_id = c.club_id
 AND s.is_current = true
WHERE c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM teams t
    WHERE t.club_id = c.club_id
      AND t.season_id = s.id
      AND t.category_id = c.id
  );
