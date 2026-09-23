import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export async function aiPlugin(app: FastifyInstance): Promise<void> {
  app.get('/analytics/ai', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      score: 0.85,
      model: 'essential-ai',
      timestamp: new Date().toISOString(),
    })
  })
}
