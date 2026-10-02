import 'dotenv/config';
import { kafka } from '../kafka/producer.js';
import pool from '../db/pool.js';
import redis from '../redis/client.js';
import { v2 as cloudinary } from 'cloudinary';
import { purgeSession } from '../routes/sessions.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const TOPIC = 'attendx.face-crop.v1';
const GROUP = 'attendx-attendance-consumer';
const FACE_WORKER_URL = process.env.FACE_WORKER_URL || 'http://localhost:8001';

// CHANGED: previously gated on meta.all_images_processed === 'true', but nothing
// anywhere in the codebase ever set that flag to 'true' — so this check could
// never pass and PROCESSING_COMPLETE never fired on its own. There's no reliable
// "professor is done uploading" signal from the frontend (batchCount is just a
// display hint, not enforced), so completion is now derived purely from
// pending_crops hitting zero. This only fires the informational
// PROCESSING_COMPLETE banner — ending the session is still an explicit action.
async function checkSessionCompletion(sessionId) {
  const pendingCrops = await redis.get(`session:${sessionId}:pending_crops`);
  if (pendingCrops === null) return; // no crops were ever seeded for this session yet

  if (parseInt(pendingCrops, 10) <= 0) {
    const totalMatched = await redis.get(`session:${sessionId}:total_faces`);
    await redis.publish(
      `session:${sessionId}:events`,
      JSON.stringify({
        type: 'PROCESSING_COMPLETE',
        payload: { sessionId, totalMatched: parseInt(totalMatched || '0', 10), totalDetected: parseInt(totalMatched || '0', 10) },
      })
    );
  }
}

async function handleMessage(payload) {
  const { sessionId, courseId, cropCloudinaryId, pictureIndex } = payload;

  // 1. Idempotency Check
  const lockKey = `crop:processed:${cropCloudinaryId}`;
  const isNew = await redis.setnx(lockKey, '1');
  await redis.expire(lockKey, 86400); // 24hr TTL

  if (!isNew) {
    console.log(`[Consumer] Duplicate crop ${cropCloudinaryId}. Deleting and decrementing.`);
    try { await cloudinary.uploader.destroy(cropCloudinaryId); } catch (e) {}
    await redis.decr(`session:${sessionId}:pending_crops`);
    await checkSessionCompletion(sessionId);
    return;
  }

  console.log(`[Consumer] Processing crop ${cropCloudinaryId} for session ${sessionId}`);
  let matchedStudentId = null;
  let matchConfidence = 0;

  try {
    // 2. Hand off to Attendance Worker (Python FastAPI)
    const response = await fetch(`${FACE_WORKER_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cropCloudinaryId, courseId })
    });

    if (!response.ok) {
      throw new Error(`Matcher API returned ${response.status}`);
    }

    const result = await response.json();

    // ── LOG THE MATCH RESULT — this is the critical visibility we were missing ──
    console.log(`[Consumer] Match result for crop ${cropCloudinaryId}:`, JSON.stringify(result));

    if (result.match) {
      matchedStudentId = result.studentId;
      matchConfidence = result.confidence;
    }

    // 3. Handle Result
    if (matchedStudentId) {
      // Mark attendance
      await pool.query(
        `INSERT INTO attendance_logs (session_id, student_id, status, source, confidence, matched_picture_index)
         VALUES ($1, $2, 'present', 'deepface', $3, $4)
         ON CONFLICT (session_id, student_id) DO UPDATE 
         SET status = 'present', confidence = EXCLUDED.confidence`,
        [sessionId, matchedStudentId, matchConfidence, pictureIndex]
      );

      // CHANGED: track total_faces so PROCESSING_COMPLETE has a real matched count
      // to report (previously only faceResultConsumer.js — which is dead code and
      // never started — incremented this).
      await redis.incr(`session:${sessionId}:total_faces`);

      // Notify the student
      await redis.publish(
        `attendance:${matchedStudentId}:updated`,
        JSON.stringify({
          type: 'ATTENDANCE_UPDATED',
          payload: { courseId, sessionId, date: new Date().toISOString().slice(0, 10), status: 'present', confidence: matchConfidence }
        })
      );

      // Notify the professor
      await redis.publish(
        `session:${sessionId}:events`,
        JSON.stringify({
          type: 'FACE_RESULT',
          payload: { pictureIndex, matched: [{ studentId: matchedStudentId, confidence: matchConfidence }], unidentified: [] }
        })
      );

    } else {
      // Unidentified Face: Drop request as per user instructions
      console.log(`[Consumer] No match found for crop ${cropCloudinaryId}. Dropping request.`);
      await redis.publish(
        `session:${sessionId}:events`,
        JSON.stringify({
          type: 'FACE_RESULT',
          payload: { pictureIndex, matched: [], unidentified: [] }
        })
      );
    }

  } catch (err) {
    console.error(`[Consumer] Error matching crop ${cropCloudinaryId}:`, err.message);
  } finally {
    // 4. Guaranteed Cleanup
    try {
      // Per user instruction: delete crop from Cloudinary even if unidentified
      await cloudinary.uploader.destroy(cropCloudinaryId);
    } catch (e) {
      console.error(`[Consumer] Failed to delete crop ${cropCloudinaryId} from Cloudinary:`, e.message);
    }

    await redis.decr(`session:${sessionId}:pending_crops`);
    await checkSessionCompletion(sessionId);
  }
}

export function startAttendanceConsumer() {
  const consumer = kafka.consumer({ 
    groupId: GROUP,
    retry: { retries: 20 }
  });

  (async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          await handleMessage(payload);
        } catch (err) {
          console.error('[Consumer] Kafka message handling error:', err);
        }
      },
    });

    console.log(`[Consumer] Running — topic: ${TOPIC}`);
  })().catch(err => console.error('[Consumer] Startup failed:', err));
}

// Allow running standalone, same convention as the other workers
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startAttendanceConsumer();
}
