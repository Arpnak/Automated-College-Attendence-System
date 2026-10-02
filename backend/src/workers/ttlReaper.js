// TTL Reaper — C7 trigger 2: listens for Redis keyspace expiry events on session:*:meta
// and runs the same purge routine as an explicit Finalize.
// Run as: node src/workers/ttlReaper.js
import 'dotenv/config';
import redis from '../redis/client.js';
import { purgeSession } from '../routes/sessions.js';

export function startTTLReaper() {
  const subscriber = redis.duplicate();

  // Redis must be started with: --notify-keyspace-events Ex
  // (already set in docker-compose.yml via command flag)
  subscriber.subscribe('__keyevent@0__:expired', (err) => {
    if (err) console.error('TTL Reaper subscribe error:', err.message);
  });

  subscriber.on('message', async (_channel, key) => {
    const match = key.match(/^session:([^:]+):meta$/);
    if (!match) return;
    const sessionId = match[1];
    console.log(`TTL expired for session ${sessionId} — triggering purge`);
    try {
      await purgeSession(sessionId, 'redis_ttl_event');
    } catch (err) {
      console.error('TTL Reaper purge error:', err.message);
    }
  });

  console.log('TTL Reaper started — listening for expired session keys');
}

// Allow running standalone
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startTTLReaper();
}
