import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../../shared/auth/authenticate.js'
import {
  createCompany,
  updateCompany,
  getCompany,
  listCompanies,
} from '../application/CompanyService.js'

const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  website: z.string().url().max(255).optional(),
})

const updateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  website: z.string().url().max(255).optional(),
})

export async function companyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get(
    '/api/v1/companies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth!.organizationId
      const companies = await listCompanies(orgId, { limit: 25 })
      return reply.send({
        data: companies.map((c) => ({
          ...c,
          _links: {
            self: { href: `/api/v1/companies/${c.id}` },
          },
        })),
        pagination: {
          limit: 25,
          hasNextPage: companies.length > 25,
          nextCursor: null,
        },
      })
    },
  )

  app.get(
    '/api/v1/companies/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const company = await getCompany(id, request.auth!.organizationId)
      return reply.send({
        data: {
          ...company,
          _links: {
            self: { href: `/api/v1/companies/${company.id}` },
            contacts: { href: `/api/v1/companies/${company.id}/contacts` },
          },
        },
      })
    },
  )

  app.post(
    '/api/v1/companies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createCompanySchema.parse(request.body)
      const company = await createCompany({
        ...body,
        organizationId: request.auth!.organizationId,
      })
      return reply.status(201).send({
        data: {
          ...company,
          _links: { self: { href: `/api/v1/companies/${company.id}` } },
        },
      })
    },
  )

  app.patch(
    '/api/v1/companies/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = updateCompanySchema.parse(request.body)
      const company = await updateCompany({
        companyId: id,
        organizationId: request.auth!.organizationId,
        ...body,
      })
      return reply.send({
        data: {
          ...company,
          _links: { self: { href: `/api/v1/companies/${company.id}` } },
        },
      })
    },
  )
}
