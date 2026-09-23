import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export async function analyticsPlugin(app: FastifyInstance): Promise<void> {
  app.get('/analytics', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      overview: {
        totalLeads: 120,
        totalDeals: 45,
        conversionRate: 0.375,
      },
      pipeline: [
        { stage: 'prospecting', count: 30 },
        { stage: 'qualification', count: 15 },
        { stage: 'proposal', count: 8 },
        { stage: 'negotiation', count: 5 },
        { stage: 'closed-won', count: 2 },
      ],
      timestamp: new Date().toISOString(),
    })
  })
}
