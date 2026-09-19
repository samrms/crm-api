import { Redis } from 'ioredis'
import { config } from '../config.js'
import { logger } from '../logging/logger.js'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    })
    redis.on('error', (err: Error) => {
      logger.error({ err }, 'Redis connection error')
    })
  }
  return redis
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const r = getRedis()
    const result = await r.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}
