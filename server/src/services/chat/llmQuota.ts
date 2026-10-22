import { redis, isRedisConnected } from '../../lib/redis.js';

/**
 * Per-user daily cap on LLM calls, protecting the shared Workers AI free
 * allocation. Rule-based replies never count against it.
 *
 * Uses Redis INCR (atomic, shared across server instances); falls back to an
 * in-process counter when Redis is down, mirroring the rate limiter's fallback.
 */

const memoryCounters = new Map<string, number>();

function quotaKey(userId: string, day: string): string {
  return `chat:llm:${userId}:${day}`;
}

/**
 * Atomically claims one LLM call for today. Returns false once the user has
 * used `limit` calls. The day comes from the server clock (UTC), never the
 * client: a client-supplied date could be changed on every request to reset the cap.
 */
export async function tryConsumeLlmQuota(userId: string, limit: number, now = new Date()): Promise<boolean> {
  const key = quotaKey(userId, now.toISOString().split('T')[0]);

  if (redis && isRedisConnected()) {
    try {
      const used = await redis.incr(key);
      // First call of the day sets the expiry; the key is useless after its day ends
      if (used === 1) await redis.expire(key, 24 * 60 * 60);
      return used <= limit;
    } catch (err) {
      console.warn('[ChatQuota] Redis INCR failed, using in-memory counter:', err);
    }
  }

  const used = (memoryCounters.get(key) ?? 0) + 1;
  memoryCounters.set(key, used);
  return used <= limit;
}

/** Test helper: clears the in-memory fallback counters. */
export function resetMemoryQuota(): void {
  memoryCounters.clear();
}
