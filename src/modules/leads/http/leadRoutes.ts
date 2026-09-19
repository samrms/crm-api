import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { authenticate } from '../../../shared/auth/authenticate.js'
import { getDb } from '../../../shared/database/connection.js'
import {
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/AppError.js'
import {
  canTransitionLead,
  getValidLeadTransitions,
} from '../domain/LeadState.js'
import { convertLead } from '../application/ConvertLead.js'
import type { LeadRow } from '../infrastructure/PostgresLeadRepository.js'

const createLeadSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  source: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
})

const convertLeadSchema = z.object({
  companyName: z.string().max(255).optional(),
  dealTitle: z.string().max(255).optional(),
  dealValue: z.number().positive().optional(),
})

async function findLead(id: string, organizationId: string): Promise<LeadRow> {
  const row = await getDb()
    .selectFrom('leads')
    .where('id', '=', id)
    .where('organization_id', '=', organizationId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!row) throw new NotFoundError('Lead', id)
  return row as LeadRow
}

export async function leadRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get(
    '/api/v1/leads',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth!.organizationId
      const rows = await getDb()
        .selectFrom('leads')
        .where('organization_id', '=', orgId)
        .where('deleted_at', 'is', null)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(26)
        .execute()

      const leads = rows as LeadRow[]
      const hasNextPage = leads.length > 25
      const data = hasNextPage ? leads.slice(0, 25) : leads

      return reply.send({
        data: data.map((l) => ({
          ...l,
          _links: {
            self: { href: `/api/v1/leads/${l.id}` },
            qualify:
              l.status === 'CONTACTED'
                ? { href: `/api/v1/leads/${l.id}/qualify`, method: 'POST' }
                : undefined,
            convert:
              l.status === 'QUALIFIED'
                ? { href: `/api/v1/leads/${l.id}/convert`, method: 'POST' }
                : undefined,
          },
        })),
        pagination: {
          limit: 25,
          hasNextPage,
          nextCursor: hasNextPage
            ? Buffer.from(
                JSON.stringify({
                  createdAt: data[data.length - 1]!.created_at,
                  id: data[data.length - 1]!.id,
                }),
              ).toString('base64url')
            : null,
        },
      })
    },
  )

  app.get(
    '/api/v1/leads/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const lead = await findLead(id, request.auth!.organizationId)

      const validTransitions = getValidLeadTransitions(lead.status)
      return reply.send({
        data: {
          ...lead,
          _links: {
            self: { href: `/api/v1/leads/${lead.id}` },
            qualify: validTransitions.includes('QUALIFIED')
              ? { href: `/api/v1/leads/${lead.id}/qualify`, method: 'POST' }
              : undefined,
            convert: validTransitions.includes('CONVERTED')
              ? { href: `/api/v1/leads/${lead.id}/convert`, method: 'POST' }
              : undefined,
          },
        },
      })
    },
  )

  app.post(
    '/api/v1/leads',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createLeadSchema.parse(request.body)
      const orgId = request.auth!.organizationId

      const row = await getDb()
        .insertInto('leads')
        .values({
          id: `ld_${nanoid(12)}`,
          organization_id: orgId,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          company: body.company ?? null,
          source: body.source ?? null,
          notes: body.notes ?? null,
          status: 'NEW',
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const lead = row as LeadRow
      return reply.status(201).send({
        data: {
          ...lead,
          _links: {
            self: { href: `/api/v1/leads/${lead.id}` },
            qualify: {
              href: `/api/v1/leads/${lead.id}/qualify`,
              method: 'POST',
            },
          },
        },
      })
    },
  )

  app.post(
    '/api/v1/leads/:id/qualify',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const orgId = request.auth!.organizationId
      const lead = await findLead(id, orgId)

      if (!canTransitionLead(lead.status, 'QUALIFIED')) {
        throw new ValidationError(
          `Lead in status '${lead.status}' cannot be qualified`,
        )
      }

      const row = await getDb()
        .updateTable('leads')
        .set({
          status: 'QUALIFIED',
          version: lead.version + 1,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('organization_id', '=', orgId)
        .where('version', '=', lead.version)
        .returningAll()
        .executeTakeFirst()

      if (!row) {
        throw new ValidationError(
          'Conflict: lead was modified by another request',
        )
      }

      return reply.send({
        data: {
          ...row,
          _links: {
            self: { href: `/api/v1/leads/${id}` },
            convert: { href: `/api/v1/leads/${id}/convert`, method: 'POST' },
          },
        },
      })
    },
  )

  app.post(
    '/api/v1/leads/:id/convert',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const orgId = request.auth!.organizationId
      const body = convertLeadSchema.parse(request.body)

      const result = await convertLead({
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
