import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import {
  encodeCursor,
  decodeCursor,
} from '@/shared/pagination/CursorEncoder.js'
import { getValidDealTransitions } from '@/modules/deals/domain/DealState.js'
import type { DealService } from '@/modules/deals/application/DealService.js'

const createDealSchema = z.object({
  title: z.string().min(1).max(255),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(5000).optional(),
})

const updateDealSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(5000).optional(),
})

function dealLinks(d: {
  id: string
  stage: 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
}) {
  return {
    self: { href: `/api/v1/deals/${d.id}` },
    win: getValidDealTransitions(d.stage).includes('WON')
      ? { href: `/api/v1/deals/${d.id}/win`, method: 'POST' as const }
      : undefined,
    lose: getValidDealTransitions(d.stage).includes('LOST')
      ? { href: `/api/v1/deals/${d.id}/lose`, method: 'POST' as const }
      : undefined,
  }
}

export class DealRoutes {
  constructor(private readonly service: DealService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate)

    app.get(
      '/api/v1/deals',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const orgId = request.auth!.organizationId
        const {
          limit: rawLimit,
          after,
          stage,
        } = request.query as {
          limit?: string
          after?: string
          stage?: string
        }
        const limit = Math.min(Math.max(Number(rawLimit) || 25, 1), 100)
        const cursor = after ? decodeCursor(after) : null

        const deals = await this.service.list(orgId, {
          limit,
          after: cursor
            ? Buffer.from(
                JSON.stringify({ createdAt: cursor.createdAt, id: cursor.id }),
              ).toString('base64url')
            : undefined,
          stage,
        })

        const hasNextPage = deals.length > limit
        const data = hasNextPage ? deals.slice(0, limit) : deals

        return reply.send({
          data: data.map((d) => ({
            ...d,
            _links: dealLinks(d),
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
      '/api/v1/deals/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const deal = await this.service.get(id, request.auth!.organizationId)
        return reply.send({
          data: {
            ...deal,
            _links: dealLinks(deal),
          },
        })
      },
    )

    app.post(
      '/api/v1/deals',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = createDealSchema.parse(request.body)
        const deal = await this.service.create({
          organizationId: request.auth!.organizationId,
          ...body,
        })
        return reply.status(201).send({
          data: {
            ...deal,
            _links: dealLinks(deal),
          },
        })
      },
    )

    app.patch(
      '/api/v1/deals/:id',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const body = updateDealSchema.parse(request.body)
        const deal = await this.service.update({
          dealId: id,
          organizationId: request.auth!.organizationId,
          ...body,
        })
        return reply.send({
          data: {
            ...deal,
            _links: dealLinks(deal),
          },
        })
      },
    )

    app.delete(
      '/api/v1/deals/:id',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        await this.service.remove(id, request.auth!.organizationId)
        return reply.status(204).send()
      },
    )

    app.post(
      '/api/v1/deals/:id/advance',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
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
        const deal = await this.service.advance(
          id,
          request.auth!.organizationId,
          body.stage,
        )
        return reply.send({
          data: { ...deal, _links: dealLinks(deal) },
        })
      },
    )

    app.post(
      '/api/v1/deals/:id/win',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const deal = await this.service.win(id, request.auth!.organizationId)
        return reply.send({
          data: { ...deal, _links: dealLinks(deal) },
        })
      },
    )

    app.post(
      '/api/v1/deals/:id/lose',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const deal = await this.service.lose(id, request.auth!.organizationId)
        return reply.send({
          data: { ...deal, _links: dealLinks(deal) },
        })
      },
    )
  }
}
