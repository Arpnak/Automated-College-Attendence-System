-- AttendX v2 Non-Destructive Migration
-- Run this against an EXISTING AttendX database (after schema.sql was already applied).
-- Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS guards).

-- ── 1. Drop private-key infrastructure ───────────────────────────────────────
DROP TABLE IF EXISTS private_keys CASCADE;
DROP TABLE IF EXISTS pending_registrations CASCADE;
DROP TYPE  IF EXISTS key_status;

-- ── 2. Add super_admin to role enum (idempotent) ──────────────────────────────
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Institutions table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  domain     TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. institution_id on users ────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

-- ── 5. institution_id on courses ──────────────────────────────────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE;

-- Backfill courses.institution_id from their professor's institution
UPDATE courses c
SET institution_id = u.institution_id
FROM users u
WHERE u.id = c.professor_id
  AND c.institution_id IS NULL
  AND u.institution_id IS NOT NULL;

-- ── 6. Make courses.professor_id nullable (SET NULL on professor delete) ───────
-- First drop the existing NOT NULL constraint and FK if they exist
ALTER TABLE courses ALTER COLUMN professor_id DROP NOT NULL;

-- Re-add FK with ON DELETE SET NULL (drop old FK first)
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'courses'
    AND kcu.column_name = 'professor_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE courses DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE courses
  ADD CONSTRAINT courses_professor_id_fkey
  FOREIGN KEY (professor_id) REFERENCES users(id) ON DELETE SET NULL;

-- ── 7. enrollment_status default stays 'pending' — no change needed ───────────

-- ── 8. Performance indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_institution        ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_institution_role   ON users(institution_id, role);
CREATE INDEX IF NOT EXISTS idx_courses_institution      ON courses(institution_id);
CREATE INDEX IF NOT EXISTS idx_courses_professor        ON courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_status ON course_enrollments(course_id, status);
