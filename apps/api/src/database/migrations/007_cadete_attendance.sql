CREATE TABLE training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  training_date date NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, training_date)
);

CREATE TABLE training_absences (
  training_session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (training_session_id, player_id)
);

CREATE TABLE match_convocations (
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('called_up', 'not_called')),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX training_sessions_team_date_idx ON training_sessions (team_id, training_date);
CREATE INDEX training_absences_player_idx ON training_absences (player_id);
CREATE INDEX match_convocations_player_idx ON match_convocations (player_id);

INSERT INTO seasons (id, club_id, name, starts_on, ends_on, is_current)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  '2026/2027',
  '2026-09-01',
  '2027-08-31',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (id, club_id, season_id, name, category, category_id, gender, status)
SELECT
  '00000000-0000-0000-0000-000000000003',
  c.club_id,
  s.id,
  'Cadete Masculino',
  c.name,
  c.id,
  'male',
  'active'
FROM categories c
JOIN seasons s ON s.id = '00000000-0000-0000-0000-000000000004'
WHERE c.club_id = '00000000-0000-0000-0000-000000000001'
  AND lower(c.name) = 'cadete'
ON CONFLICT (id) DO NOTHING;

INSERT INTO people (club_id, first_name, last_name, birth_date, status)
SELECT '00000000-0000-0000-0000-000000000001', source.first_name, source.last_name, source.birth_date::date, 'active'
FROM (VALUES
  ('Saúl', 'González González', '2011-01-26'),
  ('José Antonio', 'Rodríguez Enríquez', '2011-02-22'),
  ('Juan', 'Cañas Poveda', '2011-03-16'),
  ('Dario', 'García Merino', '2011-04-13'),
  ('Adrián', 'Martínez Jorge', '2011-05-02'),
  ('Ulises', 'Jiménez Carmona', '2011-05-11'),
  ('David', 'Ortega Camacho', '2011-07-03'),
  ('Luis', 'Carrasco Roldán', '2011-07-16'),
  ('Eloy', 'Rivero Troiteiro', '2011-08-08'),
  ('Antonio Daniel', 'Rosado Sánchez', '2011-08-31'),
  ('Miguel', 'Guerrero Rivas', '2011-09-23'),
  ('Alejandro', 'Navarro Hurtado', '2011-11-25'),
  ('Pablo', 'Moreno Arcas', '2012-01-02'),
  ('Fabio', 'Torres Mansukhani', '2012-05-24'),
  ('José Pablo', 'Robles Valero', '2012-06-16'),
  ('Lucas', 'Borges Rodríguez', '2012-07-04'),
  ('Samir', 'Martínez Derouach', '2012-07-16'),
  ('Alejandro', 'Moreno Rosa', '2012-07-18'),
  ('Alejandro', 'Santana Alba', '2012-10-29'),
  ('Nicolas', 'Lucena González', '2012-11-17')
) AS source(first_name, last_name, birth_date)
WHERE NOT EXISTS (
  SELECT 1 FROM people p
  WHERE p.club_id = '00000000-0000-0000-0000-000000000001'
    AND p.first_name = source.first_name
    AND p.last_name = source.last_name
    AND p.birth_date = source.birth_date::date
);

INSERT INTO players (person_id, current_team_id, jersey_number)
SELECT p.id, '00000000-0000-0000-0000-000000000003', source.jersey_number
FROM (VALUES
  ('Saúl', 'González González', '2011-01-26', 26),
  ('José Antonio', 'Rodríguez Enríquez', '2011-02-22', 4),
  ('Juan', 'Cañas Poveda', '2011-03-16', 8),
  ('Dario', 'García Merino', '2011-04-13', 5),
  ('Adrián', 'Martínez Jorge', '2011-05-02', 18),
  ('Ulises', 'Jiménez Carmona', '2011-05-11', 36),
  ('David', 'Ortega Camacho', '2011-07-03', 13),
  ('Luis', 'Carrasco Roldán', '2011-07-16', 9),
  ('Eloy', 'Rivero Troiteiro', '2011-08-08', 11),
  ('Antonio Daniel', 'Rosado Sánchez', '2011-08-31', 77),
  ('Miguel', 'Guerrero Rivas', '2011-09-23', 16),
  ('Alejandro', 'Navarro Hurtado', '2011-11-25', 24),
  ('Pablo', 'Moreno Arcas', '2012-01-02', 2),
  ('Fabio', 'Torres Mansukhani', '2012-05-24', 31),
  ('José Pablo', 'Robles Valero', '2012-06-16', 0),
  ('Lucas', 'Borges Rodríguez', '2012-07-04', 12),
  ('Samir', 'Martínez Derouach', '2012-07-16', 88),
  ('Alejandro', 'Moreno Rosa', '2012-07-18', 23),
  ('Alejandro', 'Santana Alba', '2012-10-29', 22),
  ('Nicolas', 'Lucena González', '2012-11-17', 20)
) AS source(first_name, last_name, birth_date, jersey_number)
JOIN people p ON p.club_id = '00000000-0000-0000-0000-000000000001'
  AND p.first_name = source.first_name
  AND p.last_name = source.last_name
  AND p.birth_date = source.birth_date::date
WHERE NOT EXISTS (SELECT 1 FROM players existing WHERE existing.person_id = p.id);
