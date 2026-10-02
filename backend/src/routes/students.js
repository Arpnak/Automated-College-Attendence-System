import 'dotenv/config';
import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();

// ── GET /students/institution — primary institution (backward compat) ──────────
router.get('/institution', requireRole('student'), async (req, res, next) => {
  try {
    const { rows: [user] } = await pool.query('SELECT institution_id FROM users WHERE id = $1', [req.user.id]);
    if (!user?.institution_id) return res.json(null);
    const { rows: [inst] } = await pool.query('SELECT id, name, domain FROM institutions WHERE id = $1', [user.institution_id]);
    res.json(inst || null);
  } catch (err) { next(err); }
});

// ── GET /students/institutions — all institutions this student belongs to ───────
// Returns: [{ institution: {id,name,domain}, rollNumber, courseCount }]
router.get('/institutions', requireRole('student'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         sim.roll_number,
         sim.joined_at,
         i.id   AS inst_id,
         i.name AS inst_name,
         i.domain AS inst_domain,
         (SELECT COUNT(*) FROM courses c WHERE c.institution_id = i.id) AS course_count
       FROM student_institution_map sim
       JOIN institutions i ON i.id = sim.institution_id
       WHERE sim.student_id = $1
       ORDER BY sim.joined_at`,
      [req.user.id]
    );
    const result = rows.map((r) => ({
      institution: { id: r.inst_id, name: r.inst_name, domain: r.inst_domain },
      rollNumber: r.roll_number,
      joinedAt: r.joined_at,
      courseCount: parseInt(r.course_count, 10),
    }));
    res.json(result);
  } catch (err) { next(err); }
});

// ── PATCH /students/institution/:institutionId/roll — update roll number ────────
router.patch('/institution/:institutionId/roll', requireRole('student'), async (req, res, next) => {
  const { institutionId } = req.params;
  const { rollNumber } = req.body;
  if (!rollNumber?.trim()) {
    return next(new AppError('rollNumber is required.', 'VALIDATION', 400));
  }
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE student_institution_map
       SET roll_number = $1
       WHERE student_id = $2 AND institution_id = $3
       RETURNING roll_number`,
      [rollNumber.trim(), req.user.id, institutionId]
    );
    if (!row) return next(new AppError('You are not in this institution.', 'NOT_FOUND', 404));
    res.json({ ok: true, rollNumber: row.roll_number });
  } catch (err) { next(err); }
});

// ── GET /students/profile — returns face count + profile completeness ──────────
router.get('/profile', requireRole('student'), async (req, res, next) => {
  try {
    const { rows: [u] } = await pool.query(
      'SELECT face_images_count, face_indexed_at, name, email, student_number FROM users WHERE id = $1',
      [req.user.id]
    );
    const faceCount = u?.face_images_count ?? 0;
    res.json({
      name: u?.name,
      email: u?.email,
      studentNumber: u?.student_number,
      faceCount,
      profileComplete: faceCount >= 2,
      faceIndexedAt: u?.face_indexed_at,
    });
  } catch (err) { next(err); }
});

export default router;
