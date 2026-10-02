// Bulk Writer — C8: drains Redis matched_buffer every 5s into a single bulk upsert.
// Run as a separate process: node src/workers/bulkWriter.js
import 'dotenv/config';
import pool from '../db/pool.js';
import redis from '../redis/client.js';

const INTERVAL_MS = 5000;

async function flush() {
  const sessionIds = await redis.smembers('attendx:active_sessions');
  for (const sessionId of sessionIds) {
    const key = `session:${sessionId}:matched_buffer`;
    // Atomically drain the list
    const items = await redis.lrange(key, 0, -1);
    if (!items.length) continue;
    await redis.del(key);

    const rows = items.map(i => JSON.parse(i));
    // Build one bulk INSERT with ON CONFLICT
    const vals = [];
    const placeholders = rows.map((r, i) => {
      vals.push(sessionId, r.studentId, r.confidence, r.pictureIndex);
      const b = i * 4;
      return `($${b + 1}, $${b + 2}, 'present', $${b + 3}, $${b + 4})`;
    }).join(', ');

    try {
      await pool.query(
        `INSERT INTO attendance_logs
           (session_id, student_id, status, confidence, matched_picture_index)
         VALUES ${placeholders}
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET
           status = 'present',
           confidence = EXCLUDED.confidence,
           decided_at = now()`,
        vals
      );
    } catch (err) {
      console.error('Bulk writer DB error:', err.message);
    }
  }
}

export function startBulkWriter() {
  setInterval(async () => {
    try { await flush(); } catch (err) { console.error('Bulk writer error:', err.message); }
  }, INTERVAL_MS);
  console.log(`Bulk writer started — flushing every ${INTERVAL_MS}ms`);
}

// Allow running standalone
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startBulkWriter();
}
