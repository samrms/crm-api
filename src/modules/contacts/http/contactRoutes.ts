import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../../shared/auth/authenticate.js'
import {
  createContact,
  getContact,
  listContacts,
} from '../application/ContactService.js'

const createContactSchema = z.object({
  companyId: z.string().optional(),
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  title: z.string().max(255).optional(),
})

export async function contactRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get(
    '/api/v1/contacts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth!.organizationId
      const contacts = await listContacts(orgId, { limit: 25 })
      return reply.send({
        data: contacts.map((c) => ({
          ...c,
          _links: {
            self: { href: `/api/v1/contacts/${c.id}` },
            company: c.company_id
              ? { href: `/api/v1/companies/${c.company_id}` }
              : null,
          },
        })),
        pagination: {
          limit: 25,
          hasNextPage: contacts.length > 25,
          nextCursor: null,
        },
      })
    },
  )

  app.get(
    '/api/v1/contacts/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const contact = await getContact(id, request.auth!.organizationId)
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createContactSchema.parse(request.body)
      const contact = await createContact({
        ...body,
        organizationId: request.auth!.organizationId,
      })
      return reply.status(201).send({
        data: {
          ...contact,
          _links: { self: { href: `/api/v1/contacts/${contact.id}` } },
        },
      })
    },
  )
}
