import { Redis } from 'ioredis'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'

let redis: Redis | null = null

export function getRedis(
  options: {
    maxRetriesPerRequest?: number | null
    lazyConnect?: boolean
  } = {},
): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
      lazyConnect: options.lazyConnect ?? true,
      enableReadyCheck: true,
    })
    redis.on('error', (err: Error) => {
      logger.error({ err }, 'Redis connection error')
    })
  }
  return redis
}

export async function acquireLock(redis: Redis, key: string, ttl: number): Promise<boolean> {
  const result = await redis.set(`lock:${key}`, '1', 'PX', ttl, 'NX')
  return result === 'OK'
}
