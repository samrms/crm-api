import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { authenticate } from '../../../shared/auth/authenticate.js'
import { getDb } from '../../../shared/database/connection.js'
import { NotFoundError } from '../../../shared/errors/AppError.js'

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
  dealId: z.string().optional(),
  leadId: z.string().optional(),
  assignedToId: z.string().optional(),
})

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get(
    '/api/v1/tasks',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth!.organizationId
      const rows = await getDb()
        .selectFrom('tasks')
        .where('organization_id', '=', orgId)
        .where('deleted_at', 'is', null)
        .orderBy('created_at', 'desc')
        .limit(25)
        .execute()

      return reply.send({ data: rows })
    },
  )

  app.post(
    '/api/v1/tasks',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createTaskSchema.parse(request.body)
      const orgId = request.auth!.organizationId
      const now = new Date()

      const row = await getDb()
        .insertInto('tasks')
        .values({
          id: `task_${nanoid(12)}`,
          organization_id: orgId,
          title: body.title,
          description: body.description ?? null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          dealId: body.dealId ?? null,
          leadId: body.leadId ?? null,
          assignedToId: body.assignedToId ?? null,
          status: 'PENDING',
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      return reply.status(201).send({ data: row })
    },
  )

  app.post(
    '/api/v1/tasks/:id/complete',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const orgId = request.auth!.organizationId

      const row = await getDb()
        .updateTable('tasks')
        .set({ status: 'COMPLETED', updated_at: new Date() })
        .where('id', '=', id)
        .where('organization_id', '=', orgId)
        .where('deleted_at', 'is', null)
        .returningAll()
        .executeTakeFirst()

      if (!row) throw new NotFoundError('Task', id)
      return reply.send({ data: row })
    },
  )
}
