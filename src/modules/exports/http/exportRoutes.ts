import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import type { ExportService } from '@/modules/exports/application/ExportService.js'

const exportSchema = z.object({
  type: z.enum(['companies', 'contacts', 'leads', 'deals']),
})

export class ExportRoutes {
  constructor(private readonly service: ExportService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate)

    app.post(
      '/api/v1/exports',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = exportSchema.parse(request.body)
        const orgId = request.auth!.organizationId

        const result = await this.service.createExport({
          organizationId: orgId,
          actorId: request.auth!.userId,
          type: body.type,
        })

        return reply.status(202).send({
          data: result,
          _links: {
            self: { href: `/api/v1/exports/${result.id}` },
            status: { href: `/api/v1/exports/${result.id}` },
          },
        })
      },
    )

    app.get(
      '/api/v1/exports/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const exp = await this.service.getExport(
          id,
          request.auth!.organizationId,
        )
        return reply.send({
          data: exp,
          _links: {
            self: { href: `/api/v1/exports/${exp.id}` },
          },
        })
      },
    )
  }
}
