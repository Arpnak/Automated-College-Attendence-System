/**
 * Crop Consumer — THE PIECE THAT WAS MISSING.
 *
 * Consumes `attendx.raw-image.v1` (published by routes/sessions.js on
 * batch-complete) and is the only thing standing between "professor uploaded
 * a classroom photo" and "students actually get marked present."
 *
 * Before this file existed, raw-image.v1 had zero consumers anywhere in the
 * codebase — the photo landed in Cloudinary, the Kafka publish succeeded,
 * and then nothing ever looked at it again. attendanceConsumer.js was
 * correctly wired to `attendx.face-crop.v1`, but nothing produced that topic.
 *
 * Pipeline:
 *  1. Call the Python worker's /detect endpoint with the raw photo.
 *     It finds every face, crops + uploads each one to Cloudinary, and
 *     returns crop refs (it does NOT do the identity match — that's /match,
 *     called downstream by attendanceConsumer.js per-crop).
 *  2. Seed `session:{id}:pending_crops` with the face count *before*
 *     publishing any crop messages, so attendanceConsumer.js's decrements
 *     never race ahead of the count they're decrementing from.
 *  3. Publish one `attendx.face-crop.v1` message per detected face.
 *  4. If zero faces were found in this photo, still broadcast a FACE_RESULT
 *     event so the professor's UI doesn't sit at "processing…" forever.
 *
 * Run as a separate process: node src/workers/cropConsumer.js
 */



import 'dotenv/config';
import { kafka, publish } from '../kafka/producer.js';
import redis from '../redis/client.js';

const TOPIC = 'attendx.raw-image.v1';
const GROUP = 'attendx-crop-consumer';
const FACE_WORKER_URL = process.env.FACE_WORKER_URL || 'http://localhost:8001';

async function handleMessage(payload) {
  const { sessionId, courseId, cloudinaryPublicId, pictureIndex } = payload;

  // ── Raw-image idempotency guard ─────────────────────────────────────────────
  // Without this, Kafka rebalances replay the same raw-image message and /detect
  // is called multiple times, generating brand-new crop UUIDs each time.
  // The downstream crop idempotency check in attendanceConsumer is useless here
  // because each /detect call produces a fresh UUID that was never seen before.
  const rawLockKey = `raw:processed:${sessionId}:${pictureIndex}`;
  const isNewRaw = await redis.setnx(rawLockKey, '1');
  await redis.expire(rawLockKey, 86400); // 24hr TTL
  if (!isNewRaw) {
    console.log(`[CropConsumer] Duplicate raw image picture=${pictureIndex} session=${sessionId}. Skipping /detect.`);
    return;
  }

  console.log(`[CropConsumer] Detecting faces for session ${sessionId}, picture ${pictureIndex}`);

  let totalDetected = 0;
  let faces = [];

  try {
    const response = await fetch(`${FACE_WORKER_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, courseId, cloudinaryPublicId, pictureIndex }),
    });

    if (!response.ok) {
      throw new Error(`Detect API returned ${response.status}`);
    }

    const result = await response.json();
    totalDetected = result.totalDetected || 0;
    faces = result.faces || [];
  } catch (err) {
    console.error(`[CropConsumer] Detection failed for ${cloudinaryPublicId}:`, err.message);
    // Detection failed entirely — don't leave the professor's UI hanging,
    // and don't touch pending_crops since we never seeded it for this photo.
    await redis.publish(
      `session:${sessionId}:events`,
      JSON.stringify({
        type: 'FACE_RESULT',
        payload: { pictureIndex, totalDetected: 0, matched: [], unidentified: [] },
      })
    );
    return;
  }

  if (totalDetected === 0) {
    console.log(`[CropConsumer] No faces found in ${cloudinaryPublicId}`);
    await redis.publish(
      `session:${sessionId}:events`,
      JSON.stringify({
        type: 'FACE_RESULT',
        payload: { pictureIndex, totalDetected: 0, matched: [], unidentified: [] },
      })
    );
    return;
  }

  // Seed the counter BEFORE publishing crop messages — attendanceConsumer.js
  // decrements this per crop, and it must never see a value lower than what's
  // actually still in flight.
  await redis.incrby(`session:${sessionId}:pending_crops`, totalDetected);

  for (const face of faces) {
    await publish('attendx.face-crop.v1', {
      sessionId,
      courseId,
      cropCloudinaryId: face.cropCloudinaryId,
      pictureIndex,
    });
  }

  console.log(`[CropConsumer] Published ${faces.length} crop(s) for session ${sessionId}`);
}

export function startCropConsumer() {
  const consumer = kafka.consumer({ 
    groupId: GROUP,
    retry: { retries: 20 },
    // Unique clientId prevents coordinator conflicts when running in-process
    // alongside other consumers that share the kafka instance's base clientId
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
          console.error('[CropConsumer] Kafka message handling error:', err);
        }
      },
    });

    console.log(`[CropConsumer] Running — topic: ${TOPIC}`);
  })().catch((err) => console.error('[CropConsumer] Startup failed:', err));
}

// Allow running standalone, same convention as the other workers
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startCropConsumer();
}
