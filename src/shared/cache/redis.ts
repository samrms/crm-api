import { Redis } from 'ioredis'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'

export interface RedisOptions {
  maxRetriesPerRequest?: number | null
  lazyConnect?: boolean
}

export class RedisClient {
  private client: Redis | null = null

  instance(options: RedisOptions = {}): Redis {
    if (!this.client) {
      this.client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
        lazyConnect: options.lazyConnect ?? true,
        enableReadyCheck: true,
      })
      this.client.on('error', (err: Error) => {
        logger.error({ err }, 'Redis connection error')
      })
    }
    return this.client
  }

  async ping(): Promise<string> {
    return this.instance().ping()
  }

  async acquireLock(key: string, ttl: number): Promise<boolean> {
    const result = await this.instance().set(
      `lock:${key}`,
      '1',
      'PX',
      ttl,
      'NX',
    )
    return result === 'OK'
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
  }
}

export const redisClient = new RedisClient()
