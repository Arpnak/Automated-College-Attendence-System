-- AttendX v4 Migration — Multi-Photo Onboarding + Multi-Institution Support
-- Safe to re-run (IF NOT EXISTS / IF column doesn't exist guards)

-- ── 1. Track how many reference face photos each student uploaded ─────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_images_count SMALLINT NOT NULL DEFAULT 0;

-- ── 2. Multi-institution student map ─────────────────────────────────────────
-- A student can belong to multiple institutions (admin-initiated only).
-- roll_number is per-institution (not globally unique).
CREATE TABLE IF NOT EXISTS student_institution_map (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  roll_number    TEXT,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_sim_student      ON student_institution_map(student_id);
CREATE INDEX IF NOT EXISTS idx_sim_institution  ON student_institution_map(institution_id);

-- ── 3. Migrate existing users.institution_id into the map ────────────────────
-- Students who already have an institution_id get a row in the map.
INSERT INTO student_institution_map (student_id, institution_id)
SELECT id, institution_id
FROM users
WHERE role = 'student' AND institution_id IS NOT NULL
ON CONFLICT (student_id, institution_id) DO NOTHING;
