import { Redis } from 'ioredis'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'

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
