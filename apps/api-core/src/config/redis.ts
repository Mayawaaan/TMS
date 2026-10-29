import { Redis } from 'ioredis';
import { env } from './env.js';

/** Shared command connection (blacklist, cache, flags). */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 2) return null;
    return Math.min(times * 200, 500);
  },
});
redis.on('error', () => {
  // Handled gracefully by callers when Redis is offline
});
redis.on('ready', () => console.log('[redis] ready'));

/** BullMQ requires maxRetriesPerRequest = null on its connections. */
export function bullConnection(): Redis {
  const c = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 1000);
    },
  });
  c.on('error', () => {
    // suppress duplicate connection errors on worker connections
  });
  return c;
}

/** Cache-aside helper for expensive analytics aggregations. */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // Redis offline fallback
  }
  const value = await loader();
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis offline fallback
  }
  return value;
}

export async function invalidateCache(pattern = 'cache:*'): Promise<number> {
  try {
    let cursor = '0';
    let removed = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length) removed += await redis.del(...keys);
    } while (cursor !== '0');
    return removed;
  } catch {
    return 0;
  }
}
