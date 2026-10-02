-- AttendX v3 Migration — Course Scheduling + Manual Attendance Marking
-- Safe to run multiple times (IF EXISTS / IF NOT EXISTS guards)

-- ── 1. Add scheduling columns to courses ─────────────────────────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS end_date   DATE;

-- ── 2. Manual attendance records (professor toggle, date-keyed) ───────────────
-- Separate from attendance_sessions (which are AI-camera sessions).
-- A professor can mark/toggle any past or today's date for a specific student.
CREATE TABLE IF NOT EXISTS manual_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      attendance_status NOT NULL DEFAULT 'present',
  marked_by   UUID REFERENCES users(id),
  marked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_manual_att_course_student ON manual_attendance(course_id, student_id);
CREATE INDEX IF NOT EXISTS idx_manual_att_course_date    ON manual_attendance(course_id, date);
