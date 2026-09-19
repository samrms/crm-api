import type { FastifyInstance } from 'fastify'

export async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    const existing = request.headers['x-request-id']
    request.id =
      typeof existing === 'string'
        ? existing
        : `req_${Math.random().toString(36).slice(2, 14)}`
  })

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Request-Id', _request.id)
  })
}
