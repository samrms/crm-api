import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import { ForbiddenError } from '@/shared/errors/AppError.js'
import type { OrganizationService } from '@/modules/organizations/application/OrganizationService.js'

const updateOrganizationSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug')
      .max(255)
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: 'At least one field is required',
  })

export class OrganizationRoutes {
  constructor(private readonly service: OrganizationService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.get(
      '/api/v1/organizations/:id',
      {
        preHandler: [authenticate],
        schema: { tags: ['Organizations'], summary: 'Get organization' },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        const org = await this.service.get(id)
        return reply.send({
          data: {
            ...org,
            _links: { self: { href: `/api/v1/organizations/${org.id}` } },
          },
        })
      },
    )

    app.patch(
      '/api/v1/organizations/:id',
      {
        preHandler: [authenticate, requireRole('OWNER', 'ADMIN')],
        schema: {
          tags: ['Organizations'],
          summary: 'Update organization',
          body: zodToJsonSchema(updateOrganizationSchema, {
            target: 'openApi3',
          }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string }
        if (id !== request.auth!.organizationId) {
          throw new ForbiddenError(
            'You can only update your current organization',
          )
        }

        const body = updateOrganizationSchema.parse(request.body)
        const org = await this.service.update({
          organizationId: id,
          ...body,
        })
        return reply.send({
          data: {
            ...org,
            _links: { self: { href: `/api/v1/organizations/${org.id}` } },
          },
        })
      },
    )
  }
}
