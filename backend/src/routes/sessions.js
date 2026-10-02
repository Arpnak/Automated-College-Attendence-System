import 'dotenv/config';
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../db/pool.js';
import redis from '../redis/client.js';
import { publish } from '../kafka/producer.js';
import { generateUploadSignature, deleteFolder } from '../utils/cloudinary.js';
import { requireRole, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();
const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS || '10800', 10);

// ── Helper: purge session images and mark it closed ──────────────────────────
export async function purgeSession(sessionId, triggeredBy) {
  const { rows: [session] } = await pool.query(
    `SELECT * FROM attendance_sessions WHERE id = $1 AND status NOT IN ('finalized','expired')`,
    [sessionId]
  );
  if (!session) return; // already purged

  await pool.query(`UPDATE attendance_sessions SET status = 'finalizing' WHERE id = $1`, [sessionId]);

  // Delete Cloudinary folders (C7 purge)
  await deleteFolder(`raw/${sessionId}`);
  await deleteFolder(`crops/${sessionId}`);

  // Mark finalized
  await pool.query(
    `UPDATE attendance_sessions
     SET status = $1, images_deleted = true, finalized_at = now()
     WHERE id = $2`,
    [triggeredBy === 'professor' ? 'finalized' : 'expired', sessionId]
  );

  // Write absent rows for everyone who wasn't resolved
  await pool.query(
    `INSERT INTO attendance_logs (session_id, student_id, status, source)
     SELECT $1, ce.student_id, 'absent', 'rekognition'
     FROM course_enrollments ce
     WHERE ce.course_id = $2 AND ce.status = 'approved'
     ON CONFLICT (session_id, student_id) DO NOTHING`,
    [sessionId, session.course_id]
  );

  // Privacy audit log
  await pool.query(
    `INSERT INTO privacy_audit_log (session_id, action, triggered_by)
     VALUES ($1, 's3_purge', $2)`,
    [sessionId, triggeredBy]
  );

  // Clean Redis
  const keys = [
    `session:${sessionId}:meta`,
    `session:${sessionId}:total_faces`,
    `session:${sessionId}:matched_buffer`,
    `session:${sessionId}:unidentified`,
    `session:${sessionId}:pending_crops`,
  ];
  // Also delete all per-student SETNX keys
  const studentKeys = await redis.keys(`session:${sessionId}:student:*`);
  await redis.del(...keys, ...studentKeys.filter(Boolean));
  await redis.srem('attendx:active_sessions', sessionId);

  // Notify clients
  await redis.publish(
    `session:${sessionId}:events`,
    JSON.stringify({ type: 'SESSION_FINALIZED', payload: { sessionId, imagesDeleted: true } })
  );
}

// ── GET /sessions/active ──────────────────────────────────────────────────────
router.get('/active', requireRole('professor'), async (req, res, next) => {
  try {
    const { rows: [session] } = await pool.query(
      `SELECT s.id as "sessionId", s.course_id as "courseId", c.name as "courseName", s.status
       FROM attendance_sessions s
       JOIN courses c ON c.id = s.course_id
       WHERE s.started_by = $1 AND s.status IN ('live','indexing','finalizing')
       LIMIT 1`,
      [req.user.id]
    );
    res.json(session || null);
  } catch (err) { next(err); }
});

// ── POST /sessions ────────────────────────────────────────────────────────────
router.post('/', requireRole('professor'), async (req, res, next) => {
  const { courseId } = req.body;
  const professorId = req.user.id;
  try {
    // Guard: no duplicate active sessions for this professor
    const { rows: active } = await pool.query(
      `SELECT id FROM attendance_sessions
       WHERE started_by = $1 AND status IN ('live','indexing','finalizing')`,
      [professorId]
    );
    if (active.length > 0) {
      return next(new AppError('You already have an active session.', 'SESSION_ALREADY_ACTIVE', 409));
    }

    // Fetch course
    const { rows: [course] } = await pool.query(
      'SELECT * FROM courses WHERE id = $1 AND professor_id = $2',
      [courseId, professorId]
    );
    if (!course) return next(new AppError('Course not found.', 'NOT_FOUND', 404));

    // Enrolled + approved students
    const { rows: enrollments } = await pool.query(
      `SELECT u.id, u.name, u.student_number, u.face_indexed_at
       FROM course_enrollments ce JOIN users u ON u.id = ce.student_id
       WHERE ce.course_id = $1 AND ce.status = 'approved'`,
      [courseId]
    );

    // C10: check all enrolled students are indexed
    const unindexed = enrollments.filter(s => !s.face_indexed_at);
    const sessionStatus = unindexed.length === 0 ? 'live' : 'indexing';
    const indexingProgress = enrollments.length > 0
      ? Math.round(((enrollments.length - unindexed.length) / enrollments.length) * 100)
      : 100;

    // Create session row
    const { rows: [session] } = await pool.query(
      `INSERT INTO attendance_sessions (course_id, started_by, status)
       VALUES ($1, $2, $3) RETURNING *`,
      [courseId, professorId, sessionStatus]
    );

    // Auto-mark today as a working day for this course
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO course_working_days (course_id, date) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [courseId, today]
    );

    // Redis setup: TTL-guarded meta (C7) + face counter init (C1)
    await redis.hset(`session:${session.id}:meta`, {
      status: sessionStatus,
      courseId,
      startedAt: session.started_at.toISOString(),
    });
    await redis.expire(`session:${session.id}:meta`, SESSION_TTL);
    await redis.set(`session:${session.id}:total_faces`, '0', 'EX', SESSION_TTL);
    // CHANGED: initialize pending_crops to 0 up front. cropConsumer.js increments this
    // BEFORE publishing crop messages, and attendanceConsumer.js decrements it as each
    // crop finishes. Without this key existing, the very first redis.get() in
    // checkSessionCompletion returns null and completion can never be evaluated.
    await redis.set(`session:${session.id}:pending_crops`, '0', 'EX', SESSION_TTL);
    await redis.sadd('attendx:active_sessions', session.id);

    const roster = enrollments.map(s => ({
      id: s.id,
      name: s.name,
      studentNumber: s.student_number,
      status: 'pending',
      faceIndexed: Boolean(s.face_indexed_at),
    }));

    res.status(201).json({
      sessionId: session.id,
      courseId,
      courseName: course.name,
      startedAt: session.started_at,
      status: sessionStatus,
      roster,
      indexingProgress: sessionStatus === 'indexing' ? indexingProgress : undefined,
    });
  } catch (err) { next(err); }
});

// ── GET /sessions/:id/roster — C6 reconnect-resync endpoint ─────────────────
router.get('/:id/roster', requireRole('professor'), async (req, res, next) => {
  const { id: sessionId } = req.params;
  try {
    const { rows: [session] } = await pool.query(
      'SELECT * FROM attendance_sessions WHERE id = $1',
      [sessionId]
    );
    if (!session) return next(new AppError('Session not found.', 'NOT_FOUND', 404));

    const { rows: enrollments } = await pool.query(
      `SELECT u.id, u.name, u.student_number FROM course_enrollments ce
       JOIN users u ON u.id = ce.student_id
       WHERE ce.course_id = $1 AND ce.status = 'approved'`,
      [session.course_id]
    );

    const { rows: logs } = await pool.query(
      'SELECT student_id, status, confidence FROM attendance_logs WHERE session_id = $1',
      [sessionId]
    );

    const logMap = Object.fromEntries(logs.map(l => [l.student_id, l]));
    const roster = enrollments.map(s => ({
      id: s.id,
      name: s.name,
      studentNumber: s.student_number,
      status: logMap[s.id]?.status || 'pending',
      confidence: logMap[s.id]?.confidence,
    }));

    res.json({ roster });
  } catch (err) { next(err); }
});

// ── POST /sessions/:id/upload-url — Cloudinary signed upload params ──────────
router.post('/:id/upload-url', requireRole('professor'), async (req, res, next) => {
  const { id: sessionId } = req.params;
  const { pictureIndex } = req.body;

  try {
    const { rows: [session] } = await pool.query(
      `SELECT * FROM attendance_sessions WHERE id = $1`,
      [sessionId]
    );
    if (!session) return next(new AppError('Session not found.', 'NOT_FOUND', 404));
    if (session.status !== 'live') {
      return next(new AppError('Session is not live.', 'SESSION_NOT_READY', 409));
    }

    const publicId = `${sessionId}/${pictureIndex}_${uuid()}`;
    const folder = `raw/${sessionId}`;
    const params = generateUploadSignature(publicId, folder);

    // Record intent in session_images
    await pool.query(
      `INSERT INTO session_images (session_id, picture_index, cloudinary_public_id)
       VALUES ($1, $2, $3)`,
      [sessionId, pictureIndex, `${folder}/${publicId}`]
    );

    res.json({ pictureIndex, ...params });
  } catch (err) { next(err); }
});

// ── POST /sessions/:id/batch-complete — triggers Kafka publish (C2, C3) ──────
router.post('/:id/batch-complete', requireRole('professor'), async (req, res, next) => {
  const { id: sessionId } = req.params;
  const { pictureIndex, cloudinaryPublicId } = req.body;

  try {
    const { rows: [session] } = await pool.query(
      'SELECT course_id FROM attendance_sessions WHERE id = $1',
      [sessionId]
    );
    if (!session) return next(new AppError('Session not found.', 'NOT_FOUND', 404));

    // C2: Gateway never touches image bytes — publishes only the reference string
    // C3: payload is well under 1KB
    // CHANGED: this message previously had no consumer anywhere in the codebase.
    // cropConsumer.js (new) now subscribes to this exact topic.
    await publish('attendx.raw-image.v1', {
      sessionId,
      courseId: session.course_id,
      cloudinaryPublicId,
      pictureIndex,
    });

    res.status(202).json({ queued: true });
  } catch (err) { next(err); }
});

// ── PUT /sessions/:id/attendance/:studentId — manual override ────────────────
router.put('/:id/attendance/:studentId', requireRole('professor'), async (req, res, next) => {
  const { id: sessionId, studentId } = req.params;
  const { status } = req.body;
  try {
    await pool.query(
      `INSERT INTO attendance_logs (session_id, student_id, status, source, decided_at)
       VALUES ($1, $2, $3, 'manual_override', now())
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET status = EXCLUDED.status, source = 'manual_override', decided_at = now()`,
      [sessionId, studentId, status]
    );
    res.json({ studentId, status });
  } catch (err) { next(err); }
});

// ── POST /sessions/:id/unidentified/:faceId/assign ───────────────────────────
router.post('/:id/unidentified/:faceId/assign', requireRole('professor'), async (req, res, next) => {
  const { id: sessionId, faceId } = req.params;
  const { studentId } = req.body;
  try {
    await pool.query(
      `UPDATE unidentified_faces SET resolved = true, resolved_student_id = $1 WHERE id = $2`,
      [studentId, faceId]
    );
    await pool.query(
      `INSERT INTO attendance_logs (session_id, student_id, status, source)
       VALUES ($1, $2, 'present', 'manual_override')
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET status = 'present', source = 'manual_override'`,
      [sessionId, studentId]
    );
    res.json({ studentId, status: 'present' });
  } catch (err) { next(err); }
});

// ── POST /sessions/:id/finalize — explicit C7 trigger 1 ─────────────────────
router.post('/:id/finalize', requireRole('professor'), async (req, res, next) => {
  const { id: sessionId } = req.params;
  const force = req.query.force === 'true';

  try {
    const pendingCrops = await redis.get(`session:${sessionId}:pending_crops`);
    // If the server was abruptly killed during a match, this counter can rarely
    // get orphaned. The ?force=true flag allows the UI to bypass it on a second try.
    if (!force && pendingCrops !== null && parseInt(pendingCrops, 10) > 0) {
      return next(new AppError(
        `Still processing ${pendingCrops} face(s) from the uploaded photo(s) — wait a moment and try again.`,
        'CROPS_PENDING',
        409
      ));
    }

    await purgeSession(sessionId, 'professor');
    const { rows: [session] } = await pool.query(
      'SELECT finalized_at FROM attendance_sessions WHERE id = $1',
      [sessionId]
    );
    res.json({ sessionId, endedAt: session?.finalized_at, imagesDeleted: true });
  } catch (err) { next(err); }
});

export default router;
