import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import {
  encodeCursor,
  decodeCursor,
} from '@/shared/pagination/CursorEncoder.js'
import type { TaskService } from '@/modules/tasks/application/TaskService.js'

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
  dealId: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  assignedToId: z.string().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  status: z
    .enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .optional(),
  dueDate: z.string().datetime().optional(),
  dealId: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  assignedToId: z.string().optional(),
})

function taskLinks(t: {
  id: string
  dealId: string | null
  leadId: string | null
  contactId: string | null
}) {
  return {
    self: { href: `/api/v1/tasks/${t.id}` },
    ...(t.dealId ? { deal: { href: `/api/v1/deals/${t.dealId}` } } : {}),
    ...(t.leadId ? { lead: { href: `/api/v1/leads/${t.leadId}` } } : {}),
    ...(t.contactId
      ? { contact: { href: `/api/v1/contacts/${t.contactId}` } }
      : {}),
  }
}

export class TaskRoutes {
  constructor(private readonly service: TaskService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate)

    app.get(
      '/api/v1/tasks',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const orgId = request.auth!.organizationId
        const {
          limit: rawLimit,
          after,
          status,
        } = request.query as {
          limit?: string
          after?: string
          status?: string
        }
        const limit = Math.min(Math.max(Number(rawLimit) || 25, 1), 100)
        const cursor = after ? decodeCursor(after) : null

        const tasks = await this.service.list(orgId, {
          limit,
          after: cursor
            ? Buffer.from(
                JSON.stringify({ createdAt: cursor.createdAt, id: cursor.id }),
              ).toString('base64url')
            : undefined,
          status,
        })

        const hasNextPage = tasks.length > limit
        const data = hasNextPage ? tasks.slice(0, limit) : tasks

        return reply.send({
          data: data.map((t) => ({
            ...t,
            _links: taskLinks(t),
          })),
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
      '/api/v1/tasks/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const task = await this.service.get(id, request.auth!.organizationId)
        return reply.send({
          data: {
            ...task,
            _links: taskLinks(task),
          },
        })
      },
    )

    app.post(
      '/api/v1/tasks',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = createTaskSchema.parse(request.body)
        const task = await this.service.create({
          organizationId: request.auth!.organizationId,
          title: body.title,
          description: body.description,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          dealId: body.dealId,
          leadId: body.leadId,
          contactId: body.contactId,
          assignedToId: body.assignedToId,
        })
        return reply.status(201).send({
          data: {
            ...task,
            _links: taskLinks(task),
          },
        })
      },
    )

    app.patch(
      '/api/v1/tasks/:id',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const body = updateTaskSchema.parse(request.body)
        const task = await this.service.update({
          taskId: id,
          organizationId: request.auth!.organizationId,
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        })
        return reply.send({
          data: {
            ...task,
            _links: taskLinks(task),
          },
        })
      },
    )

    app.post(
      '/api/v1/tasks/:id/complete',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const task = await this.service.update({
          taskId: id,
          organizationId: request.auth!.organizationId,
          status: 'COMPLETED',
        })
        return reply.send({
          data: {
            ...task,
            _links: taskLinks(task),
          },
        })
      },
    )

    app.delete(
      '/api/v1/tasks/:id',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        await this.service.remove(id, request.auth!.organizationId)
        return reply.status(204).send()
      },
    )
  }
}
