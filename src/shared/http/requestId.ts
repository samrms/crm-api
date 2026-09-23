import type { FastifyInstance } from 'fastify'

export async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    const existing = request.headers['x-request-id']
    if (typeof existing === 'string') request.id = existing
  })

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Request-Id', _request.id)
  })
}
