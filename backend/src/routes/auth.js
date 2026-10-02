import 'dotenv/config';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { AppError } from '../utils/errors.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, institution_id: user.institution_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /auth/login
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !user.password_hash) {
      return next(new AppError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401));
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return next(new AppError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401));
    }
    const token = signToken(user);
    res.json({ user: sanitize(user), token });
  } catch (err) { next(err); }
});

// POST /auth/register — open registration; any user can create an account
// Body: { name, email, password, role: 'admin'|'professor'|'student' }
router.post('/register', async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const ALLOWED_ROLES = ['admin', 'professor', 'student'];
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return next(new AppError('Name, email, and password are required.', 'VALIDATION', 400));
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return next(new AppError('Role must be admin, professor, or student.', 'VALIDATION', 400));
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    let studentNumber = null;
    if (role === 'student') {
      studentNumber = `S${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    }

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (role, name, email, password_hash, student_number)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [role, name.trim(), email.trim().toLowerCase(), hash, studentNumber]
    );

    const token = signToken(user);
    res.status(201).json({ user: sanitize(user), token });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('Email already registered.', 'EMAIL_TAKEN', 409));
    next(err);
  }
});

// POST /auth/logout — stateless JWT; client drops the token
router.post('/logout', (_req, res) => res.sendStatus(204));

function sanitize({ id, role, name, email, student_number, face_indexed_at, institution_id }) {
  return { id, role, name, email, studentNumber: student_number, faceIndexed: Boolean(face_indexed_at), institutionId: institution_id };
}

export default router;
