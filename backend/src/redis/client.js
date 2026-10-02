import 'dotenv/config';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => console.error('Redis error:', err.message));
redis.on('connect', () => console.log('Redis connected'));

export default redis;
