-- Super Admin additions: add super_admin role, institutions table, institution_id link
-- Run this against an existing AttendX database (after the main schema.sql)

-- 1. Add super_admin to the role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Institutions table — each university is one institution
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,                          -- e.g. "mit.edu"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Link users to institutions
--    super_admin: institution_id IS NULL (platform-level)
--    admin:       institution_id = their university
--    professor/student: same institution as their admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);
