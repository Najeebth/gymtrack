import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis, isRedisConnected } from '../lib/redis.js';

/**
 * Distributed Rate Limiting using Redis Store.
 *
 * Why this is crucial in production:
 * 1. Multi-instance consistency: If the API scales to 3 Docker/Render containers,
 *    they all share the exact same Redis rate limit counter.
 * 2. Attack mitigation: Brute-force attacks against /api/auth/login are immediately
 *    stopped at the edge before consuming PostgreSQL connection pool threads.
 * 3. Graceful fallback: If Redis is offline, express-rate-limit automatically
 *    falls back to its in-memory store so traffic is never blocked.
 */

// Helper to instantiate a Redis store if Redis is connected
function createRedisStore(prefix: string) {
  if (!redis) return undefined;

  return new RedisStore({
    // ioredis sendCommand bridge
    sendCommand: async (...args: string[]) => {
      if (!isRedisConnected()) {
        throw new Error('Redis not connected');
      }
      return (redis as any).call(...args);
    },
    prefix,
  });
}

// 1. Strict Limiter for Login/Signup: 5 attempts per 15 minutes per IP
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  store: createRedisStore('rl:auth:'),
  // Skip rate limiting if Redis threw an error, falling back gracefully
  passOnStoreError: true,
});

// 2. General API Limiter: 200 requests per 15 minutes per IP
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  store: createRedisStore('rl:api:'),
  passOnStoreError: true,
});
