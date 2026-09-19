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
  canTransitionDeal,
  getValidDealTransitions,
} from '../domain/DealState.js'
import type { DealRow } from '../infrastructure/PostgresDealRepository.js'

const createDealSchema = z.object({
  title: z.string().min(1).max(255),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(5000).optional(),
})

async function findDeal(id: string, organizationId: string): Promise<DealRow> {
  const row = await getDb()
    .selectFrom('deals')
    .where('id', '=', id)
    .where('organization_id', '=', organizationId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!row) throw new NotFoundError('Deal', id)
  return row as DealRow
}

export async function dealRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get(
    '/api/v1/deals',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.auth!.organizationId
      const rows = await getDb()
        .selectFrom('deals')
        .where('organization_id', '=', orgId)
        .where('deleted_at', 'is', null)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(26)
        .execute()

      const deals = rows as DealRow[]
      const hasNextPage = deals.length > 25
      const data = hasNextPage ? deals.slice(0, 25) : deals

      return reply.send({
        data: data.map((d) => ({
          ...d,
          _links: {
            self: { href: `/api/v1/deals/${d.id}` },
            win: canTransitionDeal(d.stage, 'WON')
              ? { href: `/api/v1/deals/${d.id}/win`, method: 'POST' }
              : undefined,
            lose: canTransitionDeal(d.stage, 'LOST')
              ? { href: `/api/v1/deals/${d.id}/lose`, method: 'POST' }
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
    '/api/v1/deals/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const deal = await findDeal(id, request.auth!.organizationId)
      const validTransitions = getValidDealTransitions(deal.stage)

      return reply.send({
        data: {
          ...deal,
          _links: {
            self: { href: `/api/v1/deals/${deal.id}` },
            win: validTransitions.includes('WON')
              ? { href: `/api/v1/deals/${deal.id}/win`, method: 'POST' }
              : undefined,
            lose: validTransitions.includes('LOST')
              ? { href: `/api/v1/deals/${deal.id}/lose`, method: 'POST' }
              : undefined,
          },
        },
      })
    },
  )

  app.post(
    '/api/v1/deals',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createDealSchema.parse(request.body)
      const orgId = request.auth!.organizationId

      const row = await getDb()
        .insertInto('deals')
        .values({
          id: `dl_${nanoid(12)}`,
          organization_id: orgId,
          title: body.title,
          companyId: body.companyId ?? null,
          contactId: body.contactId ?? null,
          leadId: body.leadId ?? null,
          value: body.value ?? null,
          currency: body.currency ?? 'USD',
          stage: 'NEW',
          notes: body.notes ?? null,
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const deal = row as DealRow
      return reply.status(201).send({
        data: {
          ...deal,
          _links: {
            self: { href: `/api/v1/deals/${deal.id}` },
            win: { href: `/api/v1/deals/${deal.id}/win`, method: 'POST' },
            lose: { href: `/api/v1/deals/${deal.id}/lose`, method: 'POST' },
          },
        },
      })
    },
  )

  // Deal stage transitions
  app.post(
    '/api/v1/deals/:id/advance',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = z
        .object({
          stage: z.enum([
            'QUALIFIED',
            'PROPOSAL',
            'NEGOTIATION',
            'WON',
            'LOST',
          ]),
        })
        .parse(request.body)
      const orgId = request.auth!.organizationId
      const deal = await findDeal(id, orgId)

      if (!canTransitionDeal(deal.stage, body.stage)) {
        throw new ValidationError(
          `Deal in stage '${deal.stage}' cannot transition to '${body.stage}'`,
        )
      }

      const row = await getDb()
        .updateTable('deals')
        .set({
          stage: body.stage,
          version: deal.version + 1,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('organization_id', '=', orgId)
        .where('version', '=', deal.version)
        .returningAll()
        .executeTakeFirst()

      if (!row) {
        throw new ValidationError(
          'Conflict: deal was modified by another request',
        )
      }

      return reply.send({ data: row })
    },
  )

  app.post(
    '/api/v1/deals/:id/win',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const orgId = request.auth!.organizationId
      const deal = await findDeal(id, orgId)

      if (!canTransitionDeal(deal.stage, 'WON')) {
        throw new ValidationError(`Deal in stage '${deal.stage}' cannot be won`)
      }

      const row = await getDb()
        .updateTable('deals')
        .set({
          stage: 'WON',
          version: deal.version + 1,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('organization_id', '=', orgId)
        .where('version', '=', deal.version)
        .returningAll()
        .executeTakeFirst()

      if (!row) {
        throw new ValidationError(
          'Conflict: deal was modified by another request',
        )
      }

      return reply.send({
        data: row,
        _links: { self: { href: `/api/v1/deals/${id}` } },
      })
    },
  )

  app.post(
    '/api/v1/deals/:id/lose',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const orgId = request.auth!.organizationId
      const deal = await findDeal(id, orgId)

      if (!canTransitionDeal(deal.stage, 'LOST')) {
        throw new ValidationError(
          `Deal in stage '${deal.stage}' cannot be lost`,
        )
      }

      const row = await getDb()
        .updateTable('deals')
        .set({
          stage: 'LOST',
          version: deal.version + 1,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('organization_id', '=', orgId)
        .where('version', '=', deal.version)
        .returningAll()
        .executeTakeFirst()

      if (!row) {
        throw new ValidationError(
          'Conflict: deal was modified by another request',
        )
      }

      return reply.send({
        data: row,
        _links: { self: { href: `/api/v1/deals/${id}` } },
      })
    },
  )
}
