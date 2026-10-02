-- AttendX PostgreSQL Schema v2 — Open Registration + Institution Partitioning
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ==========================================
-- 1. CLEANUP: Drop old tables and types
-- ==========================================
DROP TABLE IF EXISTS privacy_audit_log, unidentified_faces, attendance_logs, session_images,
  attendance_sessions, course_enrollments, courses, face_embeddings, users,
  institutions, pending_registrations, private_keys CASCADE;

DROP TYPE IF EXISTS user_role, key_status, attendance_status, enrollment_status, session_status CASCADE;

-- ==========================================
-- 2. ENUMS
-- ==========================================
CREATE TYPE user_role      AS ENUM ('super_admin', 'admin', 'professor', 'student');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'needs_review');
CREATE TYPE enrollment_status AS ENUM ('pending', 'approved', 'denied');
CREATE TYPE session_status AS ENUM ('indexing', 'live', 'finalizing', 'finalized', 'expired');

-- ==========================================
-- 3. INSTITUTIONS
-- ==========================================
CREATE TABLE institutions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  domain     TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 4. USERS
-- ==========================================
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role                 user_role NOT NULL,
  name                 TEXT NOT NULL,
  email                CITEXT UNIQUE NOT NULL,
  password_hash        TEXT,
  student_number       TEXT UNIQUE,
  institution_id       UUID REFERENCES institutions(id) ON DELETE SET NULL,
  rekognition_face_id  TEXT,
  face_indexed_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 5. FACE EMBEDDINGS (local mode)
-- ==========================================
CREATE TABLE face_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding  JSONB NOT NULL,
  model      TEXT NOT NULL DEFAULT 'VGG-Face',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 6. COURSES
--    professor_id is NULLABLE — when a professor is removed from the institution,
--    their courses survive with professor_id = NULL for admin reassignment.
-- ==========================================
CREATE TABLE courses (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  code                     TEXT NOT NULL,
  term                     TEXT NOT NULL,
  professor_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  institution_id           UUID REFERENCES institutions(id) ON DELETE CASCADE,
  rekognition_collection_id TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, term, institution_id)
);

-- ==========================================
-- 7. COURSE ENROLLMENTS (professor-gated: default = 'pending')
-- ==========================================
CREATE TABLE course_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       enrollment_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  UNIQUE (course_id, student_id)
);

-- ==========================================
-- 8. ATTENDANCE SESSIONS
-- ==========================================
CREATE TABLE attendance_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id           UUID NOT NULL REFERENCES courses(id),
  started_by          UUID NOT NULL REFERENCES users(id),
  status              session_status NOT NULL DEFAULT 'indexing',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at        TIMESTAMPTZ,
  images_deleted      BOOLEAN NOT NULL DEFAULT false,
  total_faces_detected INT,
  ttl_expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 hours')
);

-- ==========================================
-- 9. SESSION IMAGES
-- ==========================================
CREATE TABLE session_images (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  picture_index       SMALLINT NOT NULL CHECK (picture_index BETWEEN 1 AND 3),
  cloudinary_public_id TEXT NOT NULL,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- ==========================================
-- 10. ATTENDANCE LOGS
-- ==========================================
CREATE TABLE attendance_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id            UUID NOT NULL REFERENCES users(id),
  status                attendance_status NOT NULL DEFAULT 'absent',
  confidence            NUMERIC(5,2),
  source                TEXT NOT NULL DEFAULT 'rekognition',
  matched_picture_index SMALLINT,
  decided_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- ==========================================
-- 11. UNIDENTIFIED FACES
-- ==========================================
CREATE TABLE unidentified_faces (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  crop_cloudinary_id   TEXT NOT NULL,
  best_guess_student_id UUID REFERENCES users(id),
  confidence           NUMERIC(5,2),
  resolved             BOOLEAN NOT NULL DEFAULT false,
  resolved_student_id  UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 12. PRIVACY AUDIT LOG
-- ==========================================
CREATE TABLE privacy_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES attendance_sessions(id),
  action      TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 13. INDEXES — institution-partitioned, composite, performance-critical
-- ==========================================
-- Users: fast lookup by institution + role
CREATE INDEX idx_users_institution        ON users(institution_id);
CREATE INDEX idx_users_institution_role   ON users(institution_id, role);

-- Courses: fast lookup by institution, by professor
CREATE INDEX idx_courses_institution      ON courses(institution_id);
CREATE INDEX idx_courses_professor        ON courses(professor_id);

-- Enrollments: institution+course composite for face-matching query
CREATE INDEX idx_enrollments_course       ON course_enrollments(course_id);
CREATE INDEX idx_enrollments_student      ON course_enrollments(student_id);
CREATE INDEX idx_enrollments_course_status ON course_enrollments(course_id, status);

-- Face embeddings: per-student
CREATE INDEX idx_embeddings_student       ON face_embeddings(student_id);

-- Sessions / Logs
CREATE INDEX idx_attendance_session       ON attendance_logs(session_id);
CREATE INDEX idx_sessions_course          ON attendance_sessions(course_id);
CREATE INDEX idx_unidentified_session     ON unidentified_faces(session_id);

-- ==========================================
-- 13. COURSE WORKING DAYS
-- ==========================================
CREATE TABLE course_working_days (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (course_id, date)
);

