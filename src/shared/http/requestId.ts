import type { FastifyInstance } from 'fastify'

export class RequestIdPlugin {
  async register(app: FastifyInstance): Promise<void> {
    app.addHook('onRequest', async (request) => {
      const existing = request.headers['x-request-id']
      if (typeof existing === 'string') request.id = existing
    })

    app.addHook('onSend', async (request, reply) => {
      reply.header('X-Request-Id', request.id)
    })
  }
}
