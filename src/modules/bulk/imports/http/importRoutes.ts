import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import type { ImportService } from '@/modules/bulk/imports/application/ImportService.js'
import { config } from '@/shared/config.js'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { newId } from '@/shared/utils/id.js'

const importSchema = z.object({
  type: z.enum(['companies', 'contacts', 'leads']),
})

export class ImportRoutes {
  constructor(private readonly service: ImportService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.post(
      '/api/v1/imports',
      {
        preHandler: [authenticate, requireRole('OWNER', 'ADMIN')],
        schema: {
          tags: ['Imports'],
          summary: 'Start an import',
          body: zodToJsonSchema(importSchema, { target: 'openApi3' }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = importSchema.parse(request.body)
        const orgId = request.auth!.organizationId

        const filePath = join(config.storageDir, `${newId('import')}.csv`)
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
      {
        preHandler: [authenticate],
        schema: { tags: ['Imports'], summary: 'Get import status' },
      },
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
