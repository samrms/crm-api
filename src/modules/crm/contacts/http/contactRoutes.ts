import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { authGuard } from '@/shared/auth/authenticate.js'
import { authorizer } from '@/shared/auth/authorize.js'
import {
  encodeCursor,
  verifyCursor,
} from '@/shared/pagination/CursorEncoder.js'
import type { ContactService } from '@/modules/crm/contacts/application/ContactService.js'

const createContactSchema = z.object({
  companyId: z.string().optional(),
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  title: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
})

const updateContactSchema = z.object({
  companyId: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
})

export class ContactRoutes {
  constructor(private readonly service: ContactService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.get(
      '/api/v1/contacts',
      {
        preHandler: [authGuard.authenticate],
        schema: { tags: ['Contacts'], summary: 'List contacts' },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const orgId = request.auth!.organizationId
        const { limit: rawLimit, after } = request.query as {
          limit?: string
          after?: string
        }
        const limit = Math.min(Math.max(Number(rawLimit) || 25, 1), 100)
        const cursor = after ? verifyCursor(after) : null

        const contacts = await this.service.list(orgId, {
          limit,
          after: cursor
            ? Buffer.from(
                JSON.stringify({ createdAt: cursor.createdAt, id: cursor.id }),
              ).toString('base64url')
            : undefined,
        })

        const hasNextPage = contacts.length > limit
        const data = hasNextPage ? contacts.slice(0, limit) : contacts

        return reply.send({
          data: data.map((c) => ({
            ...c,
            _links: {
              self: { href: `/api/v1/contacts/${c.id}` },
              company: c.company_id
                ? { href: `/api/v1/companies/${c.company_id}` }
                : null,
            },
          })),
          pagination: {
            limit,
            hasNextPage,
            nextCursor: hasNextPage
              ? encodeCursor({
                  createdAt: new Date(
                    data[data.length - 1]!.created_at,
                  ).toISOString(),
                  id: data[data.length - 1]!.id,
                })
              : null,
          },
        })
      },
    )

    app.get(
      '/api/v1/contacts/:id',
      {
        preHandler: [authGuard.authenticate],
        schema: { tags: ['Contacts'], summary: 'Get contact' },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const contact = await this.service.get(id, request.auth!.organizationId)
        return reply.send({
          data: {
            ...contact,
            _links: {
              self: { href: `/api/v1/contacts/${contact.id}` },
              company: contact.company_id
                ? { href: `/api/v1/companies/${contact.company_id}` }
                : null,
            },
          },
        })
      },
    )

    app.post(
      '/api/v1/contacts',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: {
          tags: ['Contacts'],
          summary: 'Create contact',
          body: zodToJsonSchema(createContactSchema, { target: 'openApi3' }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = createContactSchema.parse(request.body)
        const contact = await this.service.create({
          organizationId: request.auth!.organizationId,
          ...body,
        })
        return reply.status(201).send({
          data: {
            ...contact,
            _links: {
              self: { href: `/api/v1/contacts/${contact.id}` },
              company: contact.company_id
                ? { href: `/api/v1/companies/${contact.company_id}` }
                : null,
            },
          },
        })
      },
    )

    app.patch(
      '/api/v1/contacts/:id',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: {
          tags: ['Contacts'],
          summary: 'Update contact',
          body: zodToJsonSchema(updateContactSchema, { target: 'openApi3' }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const body = updateContactSchema.parse(request.body)
        const contact = await this.service.update({
          contactId: id,
          organizationId: request.auth!.organizationId,
          ...body,
        })
        return reply.send({
          data: {
            ...contact,
            _links: {
              self: { href: `/api/v1/contacts/${contact.id}` },
              company: contact.company_id
                ? { href: `/api/v1/companies/${contact.company_id}` }
                : null,
            },
          },
        })
      },
    )

    app.delete(
      '/api/v1/contacts/:id',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: { tags: ['Contacts'], summary: 'Delete contact' },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        await this.service.remove(id, request.auth!.organizationId)
        return reply.status(204).send()
      },
    )
  }
}
