import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '@/shared/auth/authenticate.js'
import { requireRole } from '@/shared/auth/authorize.js'
import { NotFoundError } from '@/shared/errors/AppError.js'
import type { MemberService } from '@/modules/members/application/MemberService.js'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
})

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
})

export class MemberRoutes {
  constructor(private readonly service: MemberService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticate)

    app.get(
      '/api/v1/members',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const members = await this.service.listMembers(
          request.auth!.organizationId,
        )
        return reply.send({
          data: members.map((m) => ({
            ...m,
            _links: {
              self: { href: `/api/v1/members/${m.user_id}` },
            },
          })),
        })
      },
    )

    app.post(
      '/api/v1/members',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = inviteSchema.parse(request.body)
        const member = await this.service.inviteMember({
          organizationId: request.auth!.organizationId,
          ...body,
        })
        return reply.status(201).send({
          data: {
            ...member,
            _links: {
              self: { href: `/api/v1/members/${member.user_id}` },
            },
          },
        })
      },
    )

    app.patch(
      '/api/v1/members/:userId/role',
      { preHandler: [requireRole('OWNER')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = request.params as { userId: string }
        const body = updateRoleSchema.parse(request.body)
        const member = await this.service.updateMemberRole(
          userId,
          request.auth!.organizationId,
          body.role,
        )
        if (!member) {
          throw new NotFoundError('Member', userId)
        }
        return reply.send({
          data: {
            ...member,
            _links: {
              self: { href: `/api/v1/members/${member.user_id}` },
            },
          },
        })
      },
    )

    app.delete(
      '/api/v1/members/:userId',
      { preHandler: [requireRole('OWNER', 'ADMIN')] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = request.params as { userId: string }
        await this.service.removeMember(userId, request.auth!.organizationId)
        return reply.status(204).send()
      },
    )
  }
}
