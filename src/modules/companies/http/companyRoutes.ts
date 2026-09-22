import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import {
  decodeCursor,
  encodeCursor,
} from '@/shared/pagination/CursorEncoder.js'
import type { CompanyService } from '@/modules/companies/application/CompanyService.js'
import type { CompanyRow } from '@/modules/companies/infrastructure/PostgresCompanyRepository.js'

const companyIdParamsSchema = z.object({
  id: z.string().uuid(),
})

const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(255),
  domain: z.string().trim().max(255).optional(),
  industry: z.string().trim().max(255).optional(),
  size: z.string().trim().max(50).optional(),
  website: z.string().url().max(255).optional(),
})

const updateCompanySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    domain: z.string().trim().max(255).optional(),
    industry: z.string().trim().max(255).optional(),
    size: z.string().trim().max(50).optional(),
    website: z.string().url().max(255).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

const listCompaniesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  after: z.string().optional(),
})

export class CompanyRoutes {
  constructor(private readonly service: CompanyService) {}

  async register(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate)

    app.get(
      '/api/v1/companies',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const query = listCompaniesQuerySchema.parse(request.query)

        const cursor = query.after ? decodeCursor(query.after) : null

        const companies = await this.service.list(
          request.auth!.organizationId,
          {
            limit: query.limit + 1,
            after: cursor
              ? Buffer.from(
                  JSON.stringify({
                    createdAt: cursor.createdAt,
                    id: cursor.id,
                  }),
                ).toString('base64url')
              : undefined,
          },
        )

        const hasNextPage = companies.length > query.limit
        const data = hasNextPage ? companies.slice(0, query.limit) : companies

        const lastCompany = data.at(-1)

        return reply.send({
          data: data.map((company) => this.toResponse(company)),
          pagination: {
            limit: query.limit,
            hasNextPage,
            nextCursor:
              hasNextPage && lastCompany
                ? encodeCursor({
                    createdAt: lastCompany.created_at.toISOString(),
                    id: lastCompany.id,
                  })
                : null,
          },
        })
      },
    )

    app.get(
      '/api/v1/companies/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = companyIdParamsSchema.parse(request.params)

        const company = await this.service.get(id, request.auth!.organizationId)

        return reply.send({
          data: this.toResponse(company, {
            contacts: `/api/v1/contacts?companyId=${company.id}`,
            deals: `/api/v1/deals?companyId=${company.id}`,
          }),
        })
      },
    )

    app.post(
      '/api/v1/companies',
      {
        preHandler: [requireRole('OWNER', 'ADMIN')],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = createCompanySchema.parse(request.body)

        const company = await this.service.create({
          organizationId: request.auth!.organizationId,
          ...body,
        })

        return reply.status(201).send({
          data: this.toResponse(company),
        })
      },
    )

    app.patch(
      '/api/v1/companies/:id',
      {
        preHandler: [requireRole('OWNER', 'ADMIN')],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = companyIdParamsSchema.parse(request.params)

        const body = updateCompanySchema.parse(request.body)

        const company = await this.service.update({
          companyId: id,
          organizationId: request.auth!.organizationId,
          ...body,
        })

        return reply.send({
          data: this.toResponse(company),
        })
      },
    )

    app.delete(
      '/api/v1/companies/:id',
      {
        preHandler: [requireRole('OWNER', 'ADMIN')],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = companyIdParamsSchema.parse(request.params)

        await this.service.remove(id, request.auth!.organizationId)

        return reply.status(204).send()
      },
    )
  }

  private toResponse(
    company: CompanyRow,
    links?: {
      contacts?: string
      deals?: string
    },
  ) {
    return {
      ...company,

      _links: {
        self: {
          href: `/api/v1/companies/${company.id}`,
        },

        ...(links?.contacts && {
          contacts: {
            href: links.contacts,
          },
        }),

        ...(links?.deals && {
          deals: {
            href: links.deals,
          },
        }),
      },
    }
  }
}
