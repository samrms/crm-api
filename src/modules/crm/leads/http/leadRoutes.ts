import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { authGuard } from '@/shared/auth/authenticate.js'
import { authorizer } from '@/shared/auth/authorize.js'
import {
  encodeCursor,
  verifyCursor,
} from '@/shared/pagination/CursorEncoder.js'
import { getValidLeadTransitions } from '@/modules/crm/leads/domain/LeadState.js'
import { NotFoundError } from '@/shared/errors/AppError.js'
import type { LeadService } from '@/modules/crm/leads/application/LeadService.js'
import type { ConvertLeadFn } from '@/modules/crm/leads/application/ConvertLead.js'

const createLeadSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  source: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
})

const updateLeadSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  source: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
})

const convertLeadSchema = z.object({
  companyName: z.string().max(255).optional(),
  dealTitle: z.string().max(255).optional(),
  dealValue: z.number().positive().optional(),
})

function leadLinks(l: {
  id: string
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'DISQUALIFIED'
}) {
  const canAdvance = getValidLeadTransitions(l.status).length > 0
  return {
    self: { href: `/api/v1/leads/${l.id}` },
    qualify: canAdvance
      ? { href: `/api/v1/leads/${l.id}/qualify`, method: 'POST' as const }
      : undefined,
    convert: canAdvance
      ? { href: `/api/v1/leads/${l.id}/convert`, method: 'POST' as const }
      : undefined,
  }
}

export class LeadRoutes {
  constructor(
    private readonly service: LeadService,
    private readonly convertLead: ConvertLeadFn,
  ) {}
  async register(app: FastifyInstance): Promise<void> {
    app.get(
      '/api/v1/leads',

      {
        preHandler: [authGuard.authenticate],
        schema: { tags: ['Leads'], summary: 'List leads' },
      },

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
        const cursor = after ? verifyCursor(after) : null

        const leads = await this.service.list(orgId, {
          limit,
          after: cursor
            ? Buffer.from(
                JSON.stringify({ createdAt: cursor.createdAt, id: cursor.id }),
              ).toString('base64url')
            : undefined,
          status,
        })

        const hasNextPage = leads.length > limit
        const data = hasNextPage ? leads.slice(0, limit) : leads

        return reply.send({
          data: data.map((l) => ({
            ...l,
            _links: leadLinks(l),
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
      '/api/v1/leads/:id',

      {
        preHandler: [authGuard.authenticate],
        schema: { tags: ['Leads'], summary: 'Get lead' },
      },

      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const lead = await this.service.get(id, request.auth!.organizationId)
        return reply.send({
          data: {
            ...lead,
            _links: leadLinks(lead),
          },
        })
      },
    )

    app.post(
      '/api/v1/leads',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: {
          tags: ['Leads'],
          summary: 'Create lead',
          body: zodToJsonSchema(createLeadSchema, { target: 'openApi3' }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = createLeadSchema.parse(request.body)
        const lead = await this.service.create({
          organizationId: request.auth!.organizationId,
          ...body,
        })
        return reply.status(201).send({
          data: {
            ...lead,
            _links: leadLinks(lead),
          },
        })
      },
    )

    app.patch(
      '/api/v1/leads/:id',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: {
          tags: ['Leads'],
          summary: 'Update lead',
          body: zodToJsonSchema(updateLeadSchema, { target: 'openApi3' }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const body = updateLeadSchema.parse(request.body)
        const lead = await this.service.update({
          leadId: id,
          organizationId: request.auth!.organizationId,
          ...body,
        })
        return reply.send({
          data: {
            ...lead,
            _links: leadLinks(lead),
          },
        })
      },
    )

    app.delete(
      '/api/v1/leads/:id',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: { tags: ['Leads'], summary: 'Delete lead' },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        await this.service.remove(id, request.auth!.organizationId)
        return reply.status(204).send()
      },
    )

    app.post(
      '/api/v1/leads/:id/qualify',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: { tags: ['Leads'], summary: 'Qualify lead' },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const lead = await this.service.qualify(
          id,
          request.auth!.organizationId,
        )
        if (!lead) throw new NotFoundError('Lead', id)
        return reply.send({
          data: {
            ...lead,
            _links: leadLinks(lead),
          },
        })
      },
    )

    app.post(
      '/api/v1/leads/:id/convert',
      {
        preHandler: [
          authGuard.authenticate,
          authorizer.requireRole('OWNER', 'ADMIN'),
        ],
        schema: {
          tags: ['Leads'],
          summary: 'Convert lead into company, contact and deal',
          body: zodToJsonSchema(convertLeadSchema, { target: 'openApi3' }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const orgId = request.auth!.organizationId
        const body = convertLeadSchema.parse(request.body)

        const result = await this.convertLead({
          leadId: id,
          organizationId: orgId,
          companyName: body.companyName,
          dealTitle: body.dealTitle,
          dealValue: body.dealValue,
        })

        return reply.status(201).send({
          data: result,
          _links: {
            lead: { href: `/api/v1/leads/${result.lead.id}` },
            deal: { href: `/api/v1/deals/${result.deal.id}` },
            company: { href: `/api/v1/companies/${result.company.id}` },
            contact: { href: `/api/v1/contacts/${result.contact.id}` },
          },
        })
      },
    )
  }
}
