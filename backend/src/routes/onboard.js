import 'dotenv/config';
import { Router } from 'express';
import multer from 'multer';
import pool from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const USE_AWS = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const FACE_WORKER_URL = process.env.FACE_WORKER_URL || 'http://localhost:8001';

// ── GET /onboard/status — returns face upload progress ───────────────────────
router.get('/status', requireRole('student'), async (req, res, next) => {
  try {
    const { rows: [u] } = await pool.query(
      'SELECT face_images_count, face_indexed_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const faceCount = u?.face_images_count ?? 0;
    res.json({
      faceCount,
      profileComplete: faceCount >= 2,
      faceIndexedAt: u?.face_indexed_at ?? null,
    });
  } catch (err) { next(err); }
});

// ── POST /onboard/upload — student uploads ONE reference photo (call up to 3×) ─
// Each call:  uploads photo → sends to face worker → increments face_images_count
// Photo is deleted from memory immediately; only embedding is persisted.
router.post('/upload', requireRole('student'), upload.single('photo'), async (req, res, next) => {
  if (!req.file) return next(new AppError('No photo uploaded.', 'NO_FILE', 400));

  const studentId = req.user.id;
  const imageBytes = req.file.buffer;

  try {
    // Guard: max 3 photos
    const { rows: [u] } = await pool.query(
      'SELECT face_images_count FROM users WHERE id = $1',
      [studentId]
    );
    const currentCount = u?.face_images_count ?? 0;
    if (currentCount >= 3) {
      return next(new AppError('You have already uploaded the maximum of 3 reference photos.', 'MAX_PHOTOS', 400));
    }

    if (USE_AWS) {
      const { RekognitionClient, IndexFacesCommand } = await import('@aws-sdk/client-rekognition');
      const client = new RekognitionClient({ region: process.env.AWS_REGION });

      const { rows: enrollments } = await pool.query(
        `SELECT c.rekognition_collection_id FROM course_enrollments ce
         JOIN courses c ON c.id = ce.course_id
         WHERE ce.student_id = $1 AND ce.status = 'approved' LIMIT 1`,
        [studentId]
      );
      const collectionId = enrollments[0]?.rekognition_collection_id;
      if (!collectionId) {
        return next(new AppError('You must be enrolled in at least one approved course first.', 'NOT_ENROLLED', 400));
      }

      const cmd = new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBytes },
        ExternalImageId: studentId,
        DetectionAttributes: [],
      });
      const result = await client.send(cmd);
      if (!result.FaceRecords?.[0]) {
        return next(new AppError('No face detected in this photo. Try again with better lighting.', 'FACE_NOT_DETECTED', 422));
      }

      const newCount = currentCount + 1;
      await pool.query(
        `UPDATE users SET face_images_count = $1, face_indexed_at = now(),
         rekognition_face_id = COALESCE(rekognition_face_id, $2) WHERE id = $3`,
        [newCount, result.FaceRecords[0].Face.FaceId, studentId]
      );
      // Photo bytes never persisted — already discarded from memory here
      return res.json({ status: 'indexed', faceCount: newCount, profileComplete: newCount >= 2 });
    }

    // ── Local mode: Python FastAPI face worker ────────────────────────────────
    const formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('photo', new Blob([imageBytes], { type: req.file.mimetype }), req.file.originalname);
    formData.append('photo_index', String(currentCount + 1)); // 1, 2, or 3

    const workerRes = await fetch(`${FACE_WORKER_URL}/index`, {
      method: 'POST',
      body: formData,
    });

    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({}));
      return next(new AppError(err.detail || 'Face indexing failed.', 'FACE_NOT_DETECTED', 422));
    }
    const { face_indexed } = await workerRes.json();
    if (!face_indexed) {
      return next(new AppError('No face detected in this photo. Try again.', 'FACE_NOT_DETECTED', 422));
    }

    // Increment count; photo bytes already gone from memory
    const newCount = currentCount + 1;
    await pool.query(
      'UPDATE users SET face_images_count = $1, face_indexed_at = now() WHERE id = $2',
      [newCount, studentId]
    );

    return res.json({ status: 'indexed', faceCount: newCount, profileComplete: newCount >= 2 });
  } catch (err) { next(err); }
});

export default router;
