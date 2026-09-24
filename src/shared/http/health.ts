import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sql } from 'kysely'
import { database } from '@/shared/database/connection.js'
import { redisClient } from '@/shared/cache/redis.js'

export class HealthPlugin {
  async register(app: FastifyInstance): Promise<void> {
    app.get(
      '/health',
      async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply
          .status(200)
          .send({ status: 'ok', timestamp: new Date().toISOString() })
      },
    )

    app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({
        status: 'ok',
        name: 'CRM API',
        docs: '/docs',
        health: '/health',
      })
    })

    app.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
      const checks: Record<string, string> = {}

      try {
        await sql`select 1`.execute(database.db)
        checks.database = 'ok'
      } catch {
        checks.database = 'unavailable'
      }

      try {
        await redisClient.ping()
        checks.redis = 'ok'
      } catch {
        checks.redis = 'unavailable'
      }

      const allOk = Object.values(checks).every((s) => s === 'ok')

      return reply.status(allOk ? 200 : 503).send({
        status: allOk ? 'ready' : 'degraded',
        checks,
        timestamp: new Date().toISOString(),
      })
    })

    app.get(
      '/metrics',
      async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        })
      },
    )
  }
}
