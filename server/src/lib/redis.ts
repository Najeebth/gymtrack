import { Redis } from 'ioredis';
import { REDIS_URL } from '../config/env.js';

/**
 * Resilient Redis client with connection monitoring and graceful fallback.
 * If Redis is unavailable (e.g. during local offline dev without Docker),
 * the app continues to function seamlessly by querying PostgreSQL directly.
 */

let redisClient: Redis | null = null;
let isRedisReady = false;

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // Reconnection backoff capped at 2 seconds
      if (times > 3) {
        return null; // Stop retrying after 3 failed attempts to avoid log spam
      }
      return Math.min(times * 500, 2000);
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    isRedisReady = true;
    console.log('⚡ [Redis] Successfully connected to Redis instance');
  });

  redisClient.on('ready', () => {
    isRedisReady = true;
  });

  redisClient.on('error', (err) => {
    isRedisReady = false;
    // Suppress noisy ECONNREFUSED logs during local development
    if ((err as any).code === 'ECONNREFUSED') {
      console.warn('⚠️  [Redis] No local Redis running. Falling back to direct DB queries.');
    } else {
      console.error('❌ [Redis Error]:', err.message);
    }
  });

  redisClient.on('close', () => {
    isRedisReady = false;
  });

  // Attempt initial non-blocking connection
  redisClient.connect().catch(() => {
    isRedisReady = false;
  });
} catch (err) {
  isRedisReady = false;
  console.warn('⚠️  [Redis] Could not initialize Redis client, operating in fallback mode.');
}

export const redis = redisClient;
export const isRedisConnected = () => isRedisReady;

/**
 * Cache-Aside Helper:
 * 1. Checks Redis for the given key.
 * 2. If HIT -> returns parsed JSON.
 * 3. If MISS -> calls fetcher(), stores result in Redis with TTL (seconds), and returns.
 */
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (redis && isRedisConnected()) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      console.warn(`[Redis] Cache read failed for key ${key}:`, err);
    }
  }

  // Cache MISS or Redis unavailable -> fetch from PostgreSQL
  const data = await fetcher();

  // Asynchronously populate cache without blocking response
  if (redis && isRedisConnected() && data !== null && data !== undefined) {
    redis.setex(key, ttlSeconds, JSON.stringify(data)).catch((err) => {
      console.warn(`[Redis] Cache write failed for key ${key}:`, err);
    });
  }

  return data;
}

/**
 * Cache Invalidator:
 * Removes single or pattern-matched keys from Redis (e.g. "exercises:*")
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!redis || !isRedisConnected()) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🧹 [Redis] Invalidated ${keys.length} cached key(s) matching "${pattern}"`);
    }
  } catch (err) {
    console.warn(`[Redis] Invalidation failed for pattern ${pattern}:`, err);
  }
}

