import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import type { ImportService } from '@/modules/imports/application/ImportService.js'
import { config } from '@/shared/config.js'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { nanoid } from 'nanoid'

const importSchema = z.object({
  type: z.enum(['companies', 'contacts', 'leads']),
})

export class ImportRoutes {
  constructor(private readonly service: ImportService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate)

    app.post(
      '/api/v1/imports',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = importSchema.parse(request.body)
        const orgId = request.auth!.organizationId

        const filePath = join(config.storageDir, `import_${nanoid(12)}.csv`)
        mkdirSync(config.storageDir, { recursive: true })

        const imp = await this.service.createImport({
          organizationId: orgId,
          actorId: request.auth!.userId,
          type: body.type,
          filePath,
        })

        return reply.status(202).send({
          data: {
            id: imp.id,
            status: imp.status,
            type: imp.type,
          },
          _links: {
            self: { href: `/api/v1/imports/${imp.id}` },
            status: { href: `/api/v1/imports/${imp.id}` },
          },
        })
      },
    )

    app.get(
      '/api/v1/imports/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const imp = await this.service.getImport(
          id,
          request.auth!.organizationId,
        )
        return reply.send({
          data: imp,
          _links: {
            self: { href: `/api/v1/imports/${imp.id}` },
          },
        })
      },
    )
  }
}
