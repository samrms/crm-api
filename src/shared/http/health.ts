import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export async function healthPlugin(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(200)
      .send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(200)
      .send({ status: 'ok', name: 'CRM API', docs: '/docs', health: '/health' })
  })

  app.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, string> = {}

    try {
      const { getPool } = await import('@/shared/database/connection.js')
      await getPool().query('SELECT 1')
      checks.postgres = 'ok'
    } catch {
      checks.postgres = 'unavailable'
    }

    try {
      const { getRedis } = await import('@/shared/cache/redis.js')
      const redis = getRedis()
      await redis.ping()
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
}

  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    })
  })
