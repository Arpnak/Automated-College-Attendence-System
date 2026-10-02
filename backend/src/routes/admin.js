import 'dotenv/config';
import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();

// ── Helper: get admin's institution_id, auto-creating one if missing ──────────
async function ensureInstitution(adminId) {
  const { rows: [u] } = await pool.query(
    'SELECT institution_id, name FROM users WHERE id = $1', [adminId]
  );
  if (u?.institution_id) return u.institution_id;

  // Auto-create a default institution for this admin on first use
  const adminName = u?.name || 'My Institution';
  const instName = `${adminName}'s Institution`;
  const { rows: [inst] } = await pool.query(
    'INSERT INTO institutions (name) VALUES ($1) RETURNING id',
    [instName]
  );
  await pool.query('UPDATE users SET institution_id = $1 WHERE id = $2', [inst.id, adminId]);
  console.log(`[Admin] Auto-created institution "${instName}" for admin ${adminId}`);
  return inst.id;
} 

// ── GET /admin/metrics ────────────────────────────────────────────────────────
router.get('/metrics', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows: [m] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE institution_id = $1 AND role = 'student')              AS "totalStudents",
        (SELECT COUNT(*) FROM users WHERE institution_id = $1 AND role = 'professor')            AS "totalProfessors",
        (SELECT COUNT(*) FROM courses c JOIN users u ON u.id = c.professor_id WHERE u.institution_id = $1) AS "totalCourses",
        (SELECT COUNT(*) FROM course_enrollments ce
           JOIN courses c ON c.id = ce.course_id
           JOIN users u ON u.id = c.professor_id
           WHERE u.institution_id = $1 AND ce.status = 'pending')                               AS "pendingRegistrations"
    `, [institutionId]);
    res.json(m);
  } catch (err) { next(err); }
});

// ── GET /admin/professors ─────────────────────────────────────────────────────
router.get('/professors', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows } = await pool.query(
      `SELECT id, name, email, created_at FROM users
       WHERE role = 'professor' AND institution_id = $1 ORDER BY name`,
      [institutionId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /admin/students ───────────────────────────────────────────────────────
router.get('/students', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows } = await pool.query(
      `SELECT id, name, email, student_number, created_at FROM users
       WHERE role = 'student' AND institution_id = $1 ORDER BY name`,
      [institutionId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /admin/institution ────────────────────────────────────────────────────
router.get('/institution', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows: [inst] } = await pool.query(`SELECT * FROM institutions WHERE id = $1`, [institutionId]);
    res.json(inst || null);
  } catch (err) { next(err); }
});

// ── GET /admin/users/search?email= ───────────────────────────────────────────
router.get('/users/search', requireRole('admin'), async (req, res, next) => {
  const { email } = req.query;
  if (!email?.trim()) return next(new AppError('email query param required.', 'VALIDATION', 400));
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows } = await pool.query(
      `SELECT id, name, email, role, institution_id FROM users WHERE LOWER(email) = $1`,
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) return res.json(null);
    const user = rows[0];
    if (user.role === 'super_admin') return res.json(null);
    const alreadyAdded = Boolean(institutionId) && user.institution_id === institutionId;
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, alreadyAdded });
  } catch (err) { next(err); }
});

// ── POST /admin/professors — create a new professor directly ──────────────────
// Accepts: { name, email }  — creates user + links to this institution in one step
router.post('/professors', requireRole('admin'), async (req, res, next) => {
  const { name, email, userId } = req.body;

  try {
    const institutionId = await ensureInstitution(req.user.id);

    // Link mode: userId provided (link existing user)
    if (userId) {
      const { rows: [user] } = await pool.query(
        `SELECT id, institution_id FROM users WHERE id = $1 AND role = 'professor'`, [userId]
      );
      if (!user) return next(new AppError('Professor not found.', 'NOT_FOUND', 404));
      if (user.institution_id === institutionId) return res.json({ alreadyAdded: true });
      await pool.query(`UPDATE users SET institution_id = $1 WHERE id = $2`, [institutionId, userId]);
      const { rows: [updated] } = await pool.query(
        `SELECT id, name, email, created_at FROM users WHERE id = $1`, [userId]
      );
      return res.status(201).json(updated);
    }

    // Create mode: name + email provided (creates a new professor account)
    if (!name?.trim() || !email?.trim())
      return next(new AppError('name and email are required.', 'VALIDATION', 400));

    const { rows: [existing] } = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1`, [email.trim().toLowerCase()]
    );
    if (existing) return next(new AppError('Email already registered.', 'EMAIL_TAKEN', 409));

    // Random temp password — professor must reset on first login (or admin shares it)
    const tmpPass = Math.random().toString(36).slice(2, 10) + 'Aa1!';
    const bcrypt = (await import('bcryptjs')).default;
    const hash = await bcrypt.hash(tmpPass, 10);

    const { rows: [professor] } = await pool.query(
      `INSERT INTO users (role, name, email, password_hash, institution_id)
       VALUES ('professor', $1, $2, $3, $4)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash, institutionId]
    );
    return res.status(201).json({ ...professor, temporaryPassword: tmpPass });
  } catch (err) { next(err); }
});

// ── POST /admin/students — create a new student or link existing ──────────────
router.post('/students', requireRole('admin'), async (req, res, next) => {
  const { name, email, studentNumber, userId } = req.body;

  try {
    const institutionId = await ensureInstitution(req.user.id);

    // Link mode
    if (userId) {
      const { rows: [user] } = await pool.query(
        `SELECT id, institution_id FROM users WHERE id = $1 AND role = 'student'`, [userId]
      );
      if (!user) return next(new AppError('Student not found.', 'NOT_FOUND', 404));
      if (user.institution_id === institutionId) return res.json({ alreadyAdded: true });
      await pool.query(`UPDATE users SET institution_id = $1 WHERE id = $2`, [institutionId, userId]);
      const { rows: [updated] } = await pool.query(
        `SELECT id, name, email, student_number, created_at FROM users WHERE id = $1`, [userId]
      );
      return res.status(201).json(updated);
    }

    // Create mode
    if (!name?.trim() || !email?.trim())
      return next(new AppError('name and email are required.', 'VALIDATION', 400));

    const { rows: [existing] } = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1`, [email.trim().toLowerCase()]
    );
    if (existing) return next(new AppError('Email already registered.', 'EMAIL_TAKEN', 409));

    const tmpPass = Math.random().toString(36).slice(2, 10) + 'Aa1!';
    const bcrypt = (await import('bcryptjs')).default;
    const hash = await bcrypt.hash(tmpPass, 10);

    const { rows: [student] } = await pool.query(
      `INSERT INTO users (role, name, email, password_hash, student_number, institution_id)
       VALUES ('student', $1, $2, $3, $4, $5)
       RETURNING id, name, email, student_number, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash, studentNumber?.trim() || null, institutionId]
    );
    return res.status(201).json({ ...student, temporaryPassword: tmpPass });
  } catch (err) { next(err); }
});

// ── DELETE /admin/professors/:id ──────────────────────────────────────────────
router.delete('/professors/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows: [user] } = await pool.query(
      `SELECT id, institution_id FROM users WHERE id = $1 AND role = 'professor'`, [req.params.id]
    );
    if (!user) return next(new AppError('Professor not found.', 'NOT_FOUND', 404));
    if (user.institution_id !== institutionId)
      return next(new AppError('Professor is not in your institution.', 'FORBIDDEN', 403));
    await pool.query(`UPDATE users SET institution_id = NULL WHERE id = $1`, [req.params.id]);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ── DELETE /admin/students/:id ────────────────────────────────────────────────
router.delete('/students/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows: [user] } = await pool.query(
      `SELECT id, institution_id FROM users WHERE id = $1 AND role = 'student'`, [req.params.id]
    );
    if (!user) return next(new AppError('Student not found.', 'NOT_FOUND', 404));
    if (user.institution_id !== institutionId)
      return next(new AppError('Student is not in your institution.', 'FORBIDDEN', 403));
    await pool.query(`UPDATE users SET institution_id = NULL WHERE id = $1`, [req.params.id]);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ── GET /admin/pending-registrations ─────────────────────────────────────────
router.get('/registrations/pending', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows } = await pool.query(
      `SELECT ce.id, ce.status, ce.requested_at,
              u.id AS student_id, u.name AS student_name, u.email AS student_email,
              c.id AS course_id, c.name AS course_name, c.code AS course_code
       FROM course_enrollments ce
       JOIN users u ON u.id = ce.student_id
       JOIN courses c ON c.id = ce.course_id
       JOIN users p ON p.id = c.professor_id
       WHERE p.institution_id = $1 AND ce.status = 'pending'
       ORDER BY ce.requested_at DESC`,
      [institutionId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /admin/keys — list registration keys ──────────────────────────────────
router.get('/keys', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const { rows } = await pool.query(
      `SELECT * FROM registration_keys WHERE institution_id = $1 ORDER BY created_at DESC`,
      [institutionId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /admin/keys — create a registration key ──────────────────────────────
router.post('/keys', requireRole('admin'), async (req, res, next) => {
  try {
    const institutionId = await ensureInstitution(req.user.id);
    const key = `KEY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const { rows: [k] } = await pool.query(
      `INSERT INTO registration_keys (key, institution_id, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [key, institutionId, req.user.id]
    );
    res.status(201).json(k);
  } catch (err) { next(err); }
});

// ── DELETE /admin/keys/:id — revoke a registration key ───────────────────────
router.delete('/keys/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM registration_keys WHERE id = $1`, [req.params.id]);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

export default router;
