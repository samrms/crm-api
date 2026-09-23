import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import { ConflictError, NotFoundError } from '@/shared/errors/AppError.js'
import { config } from '@/shared/config.js'
import type { ExportService } from '@/modules/bulk/exports/application/ExportService.js'

const exportSchema = z.object({
  type: z.enum(['companies', 'contacts', 'leads', 'deals']),
})

export class ExportRoutes {
  constructor(
    private readonly service: ExportService,
    private readonly storageDir: string = config.storageDir,
  ) {}

  async register(app: FastifyInstance): Promise<void> {
    app.post(
      '/api/v1/exports',
      {
        preHandler: [authenticate, requireRole('OWNER', 'ADMIN')],
        schema: {
          tags: ['Exports'],
          summary: 'Start an export',
          body: zodToJsonSchema(exportSchema, { target: 'openApi3' }),
        },
      },
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
      {
        preHandler: [authenticate],
        schema: { tags: ['Exports'], summary: 'Get export status' },
      },
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
            ...(exp.status === 'COMPLETED' && {
              download: { href: `/api/v1/exports/${exp.id}/download` },
            }),
          },
        })
      },
    )

    app.get(
      '/api/v1/exports/:id/download',
      {
        preHandler: [authenticate],
        schema: {
          tags: ['Exports'],
          summary: 'Download a completed export as CSV',
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const exp = await this.service.getExport(
          id,
          request.auth!.organizationId,
        )

        if (exp.status !== 'COMPLETED' || !exp.file_path) {
          throw new ConflictError('Export is not ready for download')
        }

        let csv: string
        try {
          csv = await readFile(
            join(this.storageDir, 'exports', basename(exp.file_path)),
            'utf8',
          )
        } catch {
          throw new NotFoundError('Export file')
        }

        const filename = `${exp.type}-${exp.id}.csv`
        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', `attachment; filename="${filename}"`)
          .send(csv)
      },
    )
  }
}
