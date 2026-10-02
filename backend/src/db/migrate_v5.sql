-- AttendX v5 Migration — Ensure course_working_days exists
-- Safe to re-run (IF NOT EXISTS guards).
--
-- course_working_days was added to schema.sql (the from-scratch bootstrap
-- script, which starts with DROP TABLE ... CASCADE on everything) but was
-- never added to any of the versioned incremental migrations (v2/v3/v4).
-- Any environment provisioned before that table landed in schema.sql, and
-- only ever run forward via runV2/V3/V4Migration since, will be missing this
-- table in production. Every session-creation call does an unconditional
-- INSERT INTO course_working_days, so that call — and therefore attendance
-- entirely — would fail outright on such a deployment.

CREATE TABLE IF NOT EXISTS course_working_days (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (course_id, date)
);
