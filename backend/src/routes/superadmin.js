import 'dotenv/config';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();

// Every route requires super_admin role
const guard = requireRole('super_admin');

// ── Helper ────────────────────────────────────────────────────────────────────
function randomPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';
}

// ── GET /superadmin/metrics ───────────────────────────────────────────────────
router.get('/metrics', guard, async (_req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM institutions) AS "totalInstitutions",
        (SELECT COUNT(*) FROM institutions WHERE is_active = true) AS "activeInstitutions",
        (SELECT COUNT(*) FROM users WHERE role = 'admin') AS "totalAdmins",
        (SELECT COUNT(*) FROM users WHERE role = 'professor') AS "totalProfessors",
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS "totalStudents",
        (SELECT COUNT(*) FROM courses) AS "totalCourses",
        (SELECT COUNT(*) FROM attendance_sessions WHERE status = 'live') AS "activeSessions",
        (SELECT COUNT(*) FROM attendance_logs WHERE status = 'present') AS "totalAttendanceRecords"
    `);
    res.json(m);
  } catch (err) { next(err); }
});

// ── Institutions ──────────────────────────────────────────────────────────────

// GET /superadmin/institutions
router.get('/institutions', guard, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        i.*,
        (SELECT COUNT(*) FROM users u WHERE u.institution_id = i.id AND u.role = 'admin') AS "adminCount",
        (SELECT COUNT(*) FROM users u WHERE u.institution_id = i.id AND u.role = 'professor') AS "professorCount",
        (SELECT COUNT(*) FROM users u WHERE u.institution_id = i.id AND u.role = 'student') AS "studentCount",
        (SELECT COUNT(*) FROM courses c
          JOIN users u ON u.id = c.professor_id
          WHERE u.institution_id = i.id) AS "courseCount",
        (SELECT COUNT(*) FROM attendance_sessions s
          JOIN courses c ON c.id = s.course_id
          JOIN users u ON u.id = c.professor_id
          WHERE u.institution_id = i.id AND s.status = 'live') AS "activeSessionCount"
      FROM institutions i
      ORDER BY i.created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /superadmin/institutions — create institution
router.post('/institutions', guard, async (req, res, next) => {
  const { name, domain } = req.body;
  if (!name?.trim()) return next(new AppError('Institution name is required.', 'VALIDATION', 400));
  try {
    const { rows: [inst] } = await pool.query(
      'INSERT INTO institutions (name, domain) VALUES ($1, $2) RETURNING *',
      [name.trim(), domain?.trim() || null]
    );
    res.status(201).json(inst);
  } catch (err) { next(err); }
});

// GET /superadmin/institutions/:id — detail with full staff list
router.get('/institutions/:id', guard, async (req, res, next) => {
  try {
    const { rows: [inst] } = await pool.query('SELECT * FROM institutions WHERE id = $1', [req.params.id]);
    if (!inst) return next(new AppError('Institution not found.', 'NOT_FOUND', 404));

    const { rows: admins } = await pool.query(
      `SELECT id, name, email, created_at FROM users WHERE institution_id = $1 AND role = 'admin' ORDER BY name`,
      [req.params.id]
    );
    const { rows: professors } = await pool.query(
      `SELECT id, name, email FROM users WHERE institution_id = $1 AND role = 'professor' ORDER BY name`,
      [req.params.id]
    );
    const { rows: courses } = await pool.query(
      `SELECT c.id, c.name, c.code, c.term,
              u.name AS professor_name,
              (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'approved') AS enrolled
       FROM courses c
       JOIN users u ON u.id = c.professor_id
       WHERE u.institution_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    const { rows: recentSessions } = await pool.query(
      `SELECT s.id, s.status, s.started_at, s.finalized_at,
              c.name AS course_name, u.name AS professor_name
       FROM attendance_sessions s
       JOIN courses c ON c.id = s.course_id
       JOIN users u ON u.id = s.started_by
       WHERE u.institution_id = $1
       ORDER BY s.started_at DESC LIMIT 20`,
      [req.params.id]
    );

    res.json({ ...inst, admins, professors, courses, recentSessions });
  } catch (err) { next(err); }
});

// PUT /superadmin/institutions/:id — update name/domain/active
router.put('/institutions/:id', guard, async (req, res, next) => {
  const { name, domain, isActive } = req.body;
  try {
    const { rows: [inst] } = await pool.query(
      `UPDATE institutions SET
         name = COALESCE($1, name),
         domain = COALESCE($2, domain),
         is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [name || null, domain || null, isActive ?? null, req.params.id]
    );
    if (!inst) return next(new AppError('Institution not found.', 'NOT_FOUND', 404));
    res.json(inst);
  } catch (err) { next(err); }
});

// DELETE /superadmin/institutions/:id
router.delete('/institutions/:id', guard, async (req, res, next) => {
  try {
    // Disassociate all users first (soft delete approach)
    await pool.query('UPDATE users SET institution_id = NULL WHERE institution_id = $1', [req.params.id]);
    await pool.query('DELETE FROM institutions WHERE id = $1', [req.params.id]);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ── Admin Management ──────────────────────────────────────────────────────────

// GET /superadmin/admins — all admins across all institutions
router.get('/admins', guard, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.created_at,
             i.id AS institution_id, i.name AS institution_name
      FROM users u
      LEFT JOIN institutions i ON i.id = u.institution_id
      WHERE u.role = 'admin'
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /superadmin/admins — create admin for an institution
router.post('/admins', guard, async (req, res, next) => {
  const { name, email, password, institutionId } = req.body;
  if (!name || !email) return next(new AppError('Name and email are required.', 'VALIDATION', 400));

  const pwd = password?.trim() || randomPassword();
  try {
    const hash = await bcrypt.hash(pwd, 10);
    const { rows: [admin] } = await pool.query(
      `INSERT INTO users (role, name, email, password_hash, institution_id)
       VALUES ('admin', $1, $2, $3, $4)
       RETURNING id, name, email, created_at, institution_id`,
      [name, email, hash, institutionId || null]
    );
    // Return generated password only on creation (never stored plain)
    res.status(201).json({ ...admin, generatedPassword: pwd });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('Email already registered.', 'EMAIL_TAKEN', 409));
    next(err);
  }
});

// PUT /superadmin/admins/:id — update name/email or reset password
router.put('/admins/:id', guard, async (req, res, next) => {
  const { name, email, password, institutionId } = req.body;
  try {
    let hashClause = '';
    const params = [name || null, email || null, institutionId || null, req.params.id];
    if (password?.trim()) {
      const hash = await bcrypt.hash(password.trim(), 10);
      hashClause = ', password_hash = $5';
      params.splice(3, 0, hash); // insert before id param
      params[params.length - 1] = req.params.id;
    }
    const { rows: [admin] } = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         institution_id = COALESCE($3, institution_id)
         ${hashClause}
       WHERE id = $${params.length} AND role = 'admin'
       RETURNING id, name, email, institution_id, created_at`,
      params
    );
    if (!admin) return next(new AppError('Admin not found.', 'NOT_FOUND', 404));
    res.json(admin);
  } catch (err) { next(err); }
});

// DELETE /superadmin/admins/:id
router.delete('/admins/:id', guard, async (req, res, next) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1 AND role = 'admin'", [req.params.id]);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ── Global Sessions ────────────────────────────────────────────────────────────

// GET /superadmin/sessions — all sessions across all institutions
router.get('/sessions', guard, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.status, s.started_at, s.finalized_at, s.images_deleted,
             c.name AS course_name, c.code AS course_code,
             u.name AS professor_name,
             i.name AS institution_name,
             (SELECT COUNT(*) FROM attendance_logs al WHERE al.session_id = s.id AND al.status = 'present') AS present_count,
             (SELECT COUNT(*) FROM attendance_logs al WHERE al.session_id = s.id) AS total_logged
      FROM attendance_sessions s
      JOIN courses c ON c.id = s.course_id
      JOIN users u ON u.id = s.started_by
      LEFT JOIN institutions i ON i.id = u.institution_id
      ORDER BY s.started_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── System Audit Logs ─────────────────────────────────────────────────────────

// GET /superadmin/logs — privacy audit log across all institutions
router.get('/logs', guard, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, s.status AS session_status,
             c.name AS course_name,
             u.name AS professor_name,
             i.name AS institution_name
      FROM privacy_audit_log p
      LEFT JOIN attendance_sessions s ON s.id = p.session_id
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN users u ON u.id = s.started_by
      LEFT JOIN institutions i ON i.id = u.institution_id
      ORDER BY p.occurred_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
