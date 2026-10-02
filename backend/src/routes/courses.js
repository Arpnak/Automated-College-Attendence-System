import 'dotenv/config';
import { Router } from 'express';
import pool from '../db/pool.js';
import redis from '../redis/client.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();

// ── GET /courses — role-branched ─────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  const { user } = req;
  try {
    if (user.role === 'professor') {
      const { rows } = await pool.query(
        `SELECT c.*,
           (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'approved') AS "enrolledCount",
           (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'pending')  AS "pendingCount"
         FROM courses c WHERE c.professor_id = $1 ORDER BY c.created_at DESC`,
        [user.id]
      );
      return res.json(rows);
    }

    if (user.role === 'student') {
      const { rows: [u] } = await pool.query('SELECT institution_id FROM users WHERE id = $1', [user.id]);
      if (!u?.institution_id) return res.json([]);

      const { rows } = await pool.query(
        `SELECT c.*,
           json_build_object('id', p.id, 'name', p.name, 'email', p.email) AS professor,
           ce.status AS enrollment_status
         FROM courses c
         LEFT JOIN users p ON p.id = c.professor_id
         LEFT JOIN course_enrollments ce ON ce.course_id = c.id AND ce.student_id = $1
         WHERE c.institution_id = $2
         ORDER BY c.name`,
        [user.id, u.institution_id]
      );
      return res.json(rows);
    }

    // admin
    const { rows: [admin] } = await pool.query('SELECT institution_id FROM users WHERE id = $1', [user.id]);
    if (!admin?.institution_id) return res.json([]);

    const { rows } = await pool.query(
      `SELECT c.*,
         json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS professor
       FROM courses c
       LEFT JOIN users u ON u.id = c.professor_id
       WHERE c.institution_id = $1
       ORDER BY c.created_at DESC`,
      [admin.institution_id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /courses — admin only ────────────────────────────────────────────────
router.post('/', requireRole('admin'), async (req, res, next) => {
  const { name, code, professorId, term, startDate, endDate } = req.body;
  try {
    const { rows: [admin] } = await pool.query('SELECT institution_id FROM users WHERE id = $1', [req.user.id]);
    if (!admin?.institution_id) return next(new AppError('Admin has no institution.', 'NO_INSTITUTION', 400));

    const collectionId = `attendx-${code.toLowerCase()}-${term.toLowerCase().replace(/\s/g, '-')}`;
    const { rows: [course] } = await pool.query(
      `INSERT INTO courses (name, code, professor_id, term, institution_id, rekognition_collection_id, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, code, professorId || null, term, admin.institution_id, collectionId, startDate || null, endDate || null]
    );
    res.status(201).json(course);
  } catch (err) {
    if (err.code === '23505') return next(new AppError('Course code + term already exists in this institution.', 'COURSE_EXISTS', 409));
    next(err);
  }
});

// ── PATCH /courses/:id — admin updates course (professor or dates) ─────────────
router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  const { professorId, startDate, endDate } = req.body;
  try {
    const { rows: [admin] } = await pool.query('SELECT institution_id FROM users WHERE id = $1', [req.user.id]);
    const { rows: [course] } = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND institution_id = $2', [req.params.id, admin.institution_id]
    );
    if (!course) return next(new AppError('Course not found.', 'NOT_FOUND', 404));

    const { rows: [updated] } = await pool.query(
      `UPDATE courses
       SET professor_id = CASE WHEN $1::boolean THEN NULL ELSE COALESCE($2, professor_id) END,
           start_date   = COALESCE($3::date, start_date),
           end_date     = COALESCE($4::date, end_date)
       WHERE id = $5
       RETURNING *`,
      [professorId === null, professorId ?? null, startDate ?? null, endDate ?? null, req.params.id]
    );
    res.json(updated);
  } catch (err) { next(err); }
});


// ── DELETE /courses/:id — admin deletes course and all related data ──────────
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  
  const client = await pool.connect();
  try {
    const { rows: [admin] } = await client.query('SELECT institution_id FROM users WHERE id = $1', [req.user.id]);
    
    // Verify course belongs to admin's institution
    const { rows: [course] } = await client.query(
      'SELECT id FROM courses WHERE id = $1 AND institution_id = $2', 
      [req.params.id, admin.institution_id]
    );
    if (!course) {
      client.release();
      return next(new AppError('Course not found.', 'NOT_FOUND', 404));
    }

    await client.query('BEGIN');

    // Wipe all related data manually to ensure referential integrity before course deletion
    await client.query('DELETE FROM manual_attendance WHERE course_id = $1', [req.params.id]);
    await client.query(`DELETE FROM attendance_logs WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id = $1)`, [req.params.id]);
    await client.query(`DELETE FROM session_images WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id = $1)`, [req.params.id]);
    await client.query(`DELETE FROM unidentified_faces WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id = $1)`, [req.params.id]);
    await client.query(`DELETE FROM privacy_audit_log WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id = $1)`, [req.params.id]);
    await client.query('DELETE FROM attendance_sessions WHERE course_id = $1', [req.params.id]);
    
    await client.query('DELETE FROM course_enrollments WHERE course_id = $1', [req.params.id]);
    await client.query('DELETE FROM course_working_days WHERE course_id = $1', [req.params.id]);
    
    await client.query('DELETE FROM courses WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── GET /courses/:id — roster + pending (professor/admin) ─────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: [course] } = await pool.query(
      `SELECT c.*, json_build_object('id', p.id, 'name', p.name, 'email', p.email) AS professor
       FROM courses c LEFT JOIN users p ON p.id = c.professor_id WHERE c.id = $1`,
      [req.params.id]
    );
    if (!course) return next(new AppError('Course not found.', 'NOT_FOUND', 404));

    if (req.user.role === 'student') {
      const { id, name, code, term, professor, institution_id, start_date, end_date } = course;
      return res.json({ id, name, code, term, professor, institution_id, start_date, end_date });
    }

    const { rows: roster } = await pool.query(
      `SELECT u.id, u.name, u.email, u.student_number, u.face_indexed_at,
              ce.status AS enrollment_status, ce.requested_at
       FROM course_enrollments ce JOIN users u ON u.id = ce.student_id
       WHERE ce.course_id = $1 AND ce.status = 'approved' ORDER BY u.name`,
      [req.params.id]
    );

    const { rows: pending } = await pool.query(
      `SELECT u.id, u.name, u.email, u.student_number, ce.requested_at
       FROM course_enrollments ce JOIN users u ON u.id = ce.student_id
       WHERE ce.course_id = $1 AND ce.status = 'pending' ORDER BY ce.requested_at`,
      [req.params.id]
    );

    res.json({ ...course, roster, pending });
  } catch (err) { next(err); }
});

// ── GET /courses/:id/history?studentId= ──────────────────────────────────────
// Returns attendance from both AI sessions and manual markings, date-keyed
router.get('/:id/history', requireAuth, async (req, res, next) => {
  const { studentId } = req.query;
  const sid = studentId || req.user.id;
  try {
    // AI session attendance logs
    const { rows: sessionRows } = await pool.query(
      `SELECT DATE(s.started_at AT TIME ZONE 'UTC')::text AS date, al.status
       FROM attendance_sessions s
       JOIN attendance_logs al ON al.session_id = s.id AND al.student_id = $1
       WHERE s.course_id = $2`,
      [sid, req.params.id]
    );

    // Manual attendance markings
    const { rows: manualRows } = await pool.query(
      `SELECT date::text AS date, status FROM manual_attendance
       WHERE course_id = $1 AND student_id = $2`,
      [req.params.id, sid]
    );

    // Merge: manual overrides session for the same date
    const merged = new Map();
    sessionRows.forEach((r) => {
      // If already present for the day, don't let a later session overwrite with absent
      if (merged.get(r.date) === 'present' && r.status === 'absent') return;
      merged.set(r.date, r.status);
    });
    manualRows.forEach((r)  => merged.set(r.date, r.status));

    const rows = Array.from(merged.entries())
      .map(([date, status]) => ({ date, status }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /courses/:id/roster-stats — enrolled students with attendance % ────────
// Used by professor CourseRoster to show colour indicators
router.get('/:id/roster-stats', requireRole('professor', 'admin'), async (req, res, next) => {
  try {
    const { rows: [course] } = await pool.query(
      'SELECT start_date, end_date, created_at FROM courses WHERE id = $1', [req.params.id]
    );
    if (!course) return next(new AppError('Course not found.', 'NOT_FOUND', 404));

    const { rows: students } = await pool.query(
      `SELECT u.id, u.name, u.email, u.student_number
       FROM course_enrollments ce JOIN users u ON u.id = ce.student_id
       WHERE ce.course_id = $1 AND ce.status = 'approved' ORDER BY u.name`,
      [req.params.id]
    );

    const { rows: workingDaysRows } = await pool.query(
      'SELECT date FROM course_working_days WHERE course_id = $1', [req.params.id]
    );
    const workingDays = workingDaysRows.map(r => r.date);

    // For each student, compute attended days from both sources
    const statsPromises = students.map(async (s) => {
      const { rows: sessionRows } = await pool.query(
        `SELECT DISTINCT DATE(sess.started_at AT TIME ZONE 'UTC')::text AS date, al.status
         FROM attendance_sessions sess
         JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = $1
         WHERE sess.course_id = $2`,
        [s.id, req.params.id]
      );
      const { rows: manualRows } = await pool.query(
        `SELECT date::text AS date, status FROM manual_attendance
         WHERE course_id = $1 AND student_id = $2`,
        [req.params.id, s.id]
      );

      const dateMap = new Map();
      sessionRows.forEach((r) => {
        if (dateMap.get(r.date) === 'present' && r.status === 'absent') return;
        dateMap.set(r.date, r.status);
      });
      manualRows.forEach((r)  => dateMap.set(r.date, r.status));
      const attended = Array.from(dateMap.values()).filter((v) => v === 'present').length;

      return { ...s, attended, totalRecords: workingDays.length, working_days: workingDays };
    });

    const withStats = await Promise.all(statsPromises);
    res.json({ course, students: withStats, working_days: workingDays });
  } catch (err) { next(err); }
});

// ── GET /courses/:id/attendance/:studentId — full date→status map for heatmap ──
router.get('/:id/attendance/:studentId', requireAuth, async (req, res, next) => {
  try {
    const { rows: [course] } = await pool.query(
      'SELECT start_date, end_date, created_at FROM courses WHERE id = $1', [req.params.id]
    );

    const sid = req.params.studentId === 'me' ? req.user.id : req.params.studentId;

    const { rows: sessionRows } = await pool.query(
      `SELECT DATE(s.started_at AT TIME ZONE 'UTC')::text AS date, al.status
       FROM attendance_sessions s
       JOIN attendance_logs al ON al.session_id = s.id AND al.student_id = $1
       WHERE s.course_id = $2`,
      [sid, req.params.id]
    );

    const { rows: manualRows } = await pool.query(
      `SELECT date::text AS date, status FROM manual_attendance
       WHERE course_id = $1 AND student_id = $2`,
      [req.params.id, sid]
    );

    const dateMap = {};
    sessionRows.forEach((r) => { 
      if (dateMap[r.date] === 'present' && r.status === 'absent') return;
      dateMap[r.date] = r.status; 
    });
    manualRows.forEach((r)  => { dateMap[r.date] = r.status; });

    const { rows: workingDaysRows } = await pool.query(
      'SELECT date FROM course_working_days WHERE course_id = $1', [req.params.id]
    );
    const workingDays = workingDaysRows.map(r => r.date);

    res.json({
      start_date: course.start_date || course.created_at,
      end_date: course.end_date,
      attendance: dateMap,
      working_days: workingDays
    });
  } catch (err) { next(err); }
});

// ── POST /courses/:id/attendance/:studentId — professor toggles a date ─────────
// Body: { date: 'YYYY-MM-DD', status: 'present'|'absent' }
// Validation: date must be <= today
router.post('/:id/attendance/:studentId', requireRole('professor'), async (req, res, next) => {
  const { date, status } = req.body;
  if (!date || !['present', 'absent'].includes(status)) {
    return next(new AppError('date and status (present|absent) required.', 'VALIDATION', 400));
  }

  const today = new Date().toISOString().slice(0, 10);
  if (date > today) {
    return next(new AppError('Cannot mark attendance for future dates.', 'FUTURE_DATE', 400));
  }

  try {
    // Verify professor owns this course
    const { rows: [course] } = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND professor_id = $2', [req.params.id, req.user.id]
    );
    if (!course) return next(new AppError('Course not found or not yours.', 'FORBIDDEN', 403));

    // Verify student is enrolled (approved)
    const { rows: [enroll] } = await pool.query(
      `SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2 AND status = 'approved'`,
      [req.params.id, req.params.studentId]
    );
    if (!enroll) return next(new AppError('Student is not enrolled in this course.', 'NOT_FOUND', 404));

    await pool.query(
      `INSERT INTO manual_attendance (course_id, student_id, date, status, marked_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (course_id, student_id, date)
       DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now()`,
      [req.params.id, req.params.studentId, date, status, req.user.id]
    );

    // 🔔 Fire real-time event so student's browser updates instantly
    await redis.publish(
      `attendance:${req.params.studentId}:updated`,
      JSON.stringify({ type: 'ATTENDANCE_UPDATED', payload: { courseId: req.params.id, date, status } })
    );

    res.json({ ok: true, date, status });
  } catch (err) { next(err); }
});

// ── POST /courses/:id/working-days ──────────────────────────────────────────
router.post('/:id/working-days', requireRole('professor'), async (req, res, next) => {
  const { date, isWorkingDay } = req.body;
  if (!date) return next(new AppError('date is required.', 'VALIDATION', 400));
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) return next(new AppError('Cannot mark future dates as working days.', 'FUTURE_DATE', 400));

  try {
    const { rows: [course] } = await pool.query('SELECT id FROM courses WHERE id = $1 AND professor_id = $2', [req.params.id, req.user.id]);
    if (!course) return next(new AppError('Course not found or not yours.', 'FORBIDDEN', 403));

    if (isWorkingDay) {
      await pool.query('INSERT INTO course_working_days (course_id, date) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, date]);
    } else {
      await pool.query('DELETE FROM course_working_days WHERE course_id = $1 AND date = $2', [req.params.id, date]);
    }

    const { rows: workingDaysRows } = await pool.query('SELECT date FROM course_working_days WHERE course_id = $1', [req.params.id]);
    res.json({ working_days: workingDaysRows.map(r => r.date) });
  } catch (err) { next(err); }
});

// ── POST /courses/:id/approve ─────────────────────────────────────────────────
router.post('/:id/approve', requireRole('professor'), async (req, res, next) => {
  const { studentId } = req.body;
  try {
    await pool.query(
      `UPDATE course_enrollments SET status = 'approved', decided_at = now()
       WHERE course_id = $1 AND student_id = $2 AND status = 'pending'`,
      [req.params.id, studentId]
    );
    res.json({ ok: true });   // ← was sendStatus(200) — caused "OK" JSON parse error
  } catch (err) { next(err); }
});

// ── POST /courses/:id/deny ────────────────────────────────────────────────────
router.post('/:id/deny', requireRole('professor'), async (req, res, next) => {
  const { studentId } = req.body;
  try {
    await pool.query(
      `UPDATE course_enrollments SET status = 'denied', decided_at = now()
       WHERE course_id = $1 AND student_id = $2 AND status = 'pending'`,
      [req.params.id, studentId]
    );
    res.json({ ok: true });   // ← was sendStatus(200)
  } catch (err) { next(err); }
});

// ── DELETE /courses/:id/students/:studentId ───────────────────────────────────
router.delete('/:id/students/:studentId', requireRole('professor', 'admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM course_enrollments
       WHERE course_id = $1 AND student_id = $2 AND status = 'approved'
       RETURNING id`,
      [req.params.id, req.params.studentId]
    );
    if (result.rowCount === 0) return next(new AppError('Enrollment not found.', 'NOT_FOUND', 404));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /courses/:id/enroll ──────────────────────────────────────────────────
router.post('/:id/enroll', requireRole('student'), async (req, res, next) => {
  const studentId = req.user.id;
  try {
    const { rows: [u] } = await pool.query('SELECT institution_id FROM users WHERE id = $1', [studentId]);
    const { rows: [course] } = await pool.query('SELECT institution_id FROM courses WHERE id = $1', [req.params.id]);
    if (!course) return next(new AppError('Course not found.', 'NOT_FOUND', 404));
    if (course.institution_id !== u.institution_id) {
      return next(new AppError('You can only enroll in courses at your institution.', 'FORBIDDEN', 403));
    }

    await pool.query(
      `INSERT INTO course_enrollments (course_id, student_id, status)
       VALUES ($1, $2, 'pending')`,
      [req.params.id, studentId]
    );
    res.status(201).json({ ok: true, status: 'pending' });  // ← was sendStatus(201)
  } catch (err) {
    if (err.code === '23505') return next(new AppError('Enrollment request already exists.', 'ENROLLMENT_ALREADY_EXISTS', 409));
    next(err);
  }
});

export default router;
