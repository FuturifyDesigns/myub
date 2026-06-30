-- Optional Supabase migration for GPA goal (run in SQL editor if desired)
-- App works with localStorage if columns are missing

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gpa_goal NUMERIC(3,2);

-- CA fields on courses (optional; app stores CA in localStorage by default)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ca_weight INTEGER DEFAULT 40;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS exam_weight INTEGER DEFAULT 60;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ca_mark NUMERIC(5,2);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS exam_mark NUMERIC(5,2);
