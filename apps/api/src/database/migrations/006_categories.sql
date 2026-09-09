CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  age_min smallint CHECK (age_min IS NULL OR age_min >= 0),
  age_max smallint CHECK (age_max IS NULL OR age_max >= 0),
  birth_year_from smallint CHECK (birth_year_from IS NULL OR birth_year_from BETWEEN 1900 AND 2200),
  birth_year_to smallint CHECK (birth_year_to IS NULL OR birth_year_to BETWEEN 1900 AND 2200),
  birth_year_label text,
  sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (age_max IS NULL OR age_min IS NULL OR age_max >= age_min),
  CHECK (birth_year_to IS NULL OR birth_year_from IS NULL OR birth_year_to >= birth_year_from),
  UNIQUE (club_id, name)
);

CREATE UNIQUE INDEX categories_club_lower_name_idx ON categories (club_id, lower(name));
CREATE INDEX categories_club_status_order_idx ON categories (club_id, status, sort_order, name);

INSERT INTO categories (club_id, name, age_min, age_max, birth_year_from, birth_year_to, birth_year_label, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Baby Basket', 4, 5, 2021, 2022, '2021-2022', 10),
  ('00000000-0000-0000-0000-000000000001', 'Prebenjamín', 6, 7, 2019, 2020, '2019-2020', 20),
  ('00000000-0000-0000-0000-000000000001', 'Benjamín', 8, 9, 2017, 2018, '2017-2018', 30),
  ('00000000-0000-0000-0000-000000000001', 'Alevín', 10, 11, 2015, 2016, '2015-2016', 40),
  ('00000000-0000-0000-0000-000000000001', 'Infantil', 12, 13, 2013, 2014, '2013-2014', 50),
  ('00000000-0000-0000-0000-000000000001', 'Cadete', 14, 15, 2011, 2012, '2011-2012', 60),
  ('00000000-0000-0000-0000-000000000001', 'Junior', 16, 17, 2009, 2010, '2009-2010', 70),
  ('00000000-0000-0000-0000-000000000001', 'Sub-22', 18, 21, 2005, 2008, '2005-2008', 80),
  ('00000000-0000-0000-0000-000000000001', 'Senior', 22, NULL, NULL, 2004, '2004 o anterior', 90)
ON CONFLICT (club_id, name) DO NOTHING;

ALTER TABLE teams ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

UPDATE teams t
SET category_id = c.id
FROM categories c
WHERE c.club_id = t.club_id
  AND lower(trim(c.name)) = lower(trim(t.category));

CREATE INDEX teams_category_idx ON teams (category_id);
