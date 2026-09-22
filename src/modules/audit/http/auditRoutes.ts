import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import {
  encodeCursor,
  decodeCursor,
} from '@/shared/pagination/CursorEncoder.js'
import type { AuditService } from '@/modules/audit/application/AuditService.js'

export class AuditRoutes {
  constructor(private readonly service: AuditService) {}

  async register(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate)

    app.get(
      '/api/v1/audit-events',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const orgId = request.auth!.organizationId
        const {
          limit: rawLimit,
          after,
          resourceType,
          resourceId,
        } = request.query as {
          limit?: string
          after?: string
          resourceType?: string
          resourceId?: string
        }
        const limit = Math.min(Math.max(Number(rawLimit) || 25, 1), 100)
        const cursor = after ? decodeCursor(after) : null

        const events = await this.service.listAuditEvents(orgId, {
          limit,
          after: cursor
            ? Buffer.from(
                JSON.stringify({ createdAt: cursor.createdAt, id: cursor.id }),
              ).toString('base64url')
            : undefined,
          resourceType,
          resourceId,
        })

        const hasNextPage = events.length > limit
        const data = hasNextPage ? events.slice(0, limit) : events

        return reply.send({
          data,
          pagination: {
            limit,
            hasNextPage,
            nextCursor: hasNextPage
              ? encodeCursor({
                  createdAt: data[data.length - 1]!.created_at.toISOString(),
                  id: data[data.length - 1]!.id,
                })
              : null,
          },
        })
      },
    )

    app.get(
      '/api/v1/audit-events/:id',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const event = await this.service.getAuditEvent(
          id,
          request.auth!.organizationId,
        )
        return reply.send({ data: event })
      },
    )
  }
}
