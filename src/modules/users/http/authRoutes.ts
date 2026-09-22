import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import type { AuthService } from '@users/application/auth.js'
import { setSessionCookie, clearSessionCookie } from '@/shared/auth/session.js'
import { authenticate } from '@/shared/auth/authenticate.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
  organizationName: z.string().min(1).max(255),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export class AuthRoutes {
  constructor(private readonly service: AuthService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.post(
      '/api/v1/auth/register',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = registerSchema.parse(request.body)
        const result = await this.service.register(body)
        setSessionCookie(reply, result.session.token)
        return reply.status(201).send({
          data: {
            user: result.user,
            organization: result.organization,
          },
          _links: {
            me: { href: '/api/v1/auth/me' },
            login: { href: '/api/v1/auth/login', method: 'POST' },
          },
        })
      },
    )

    app.post(
      '/api/v1/auth/login',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = loginSchema.parse(request.body)
        const result = await this.service.login(body)
        setSessionCookie(reply, result.session.token)
        return reply.status(200).send({
          data: {
            user: result.user,
            organization: result.organization,
          },
          _links: {
            me: { href: '/api/v1/auth/me' },
            logout: { href: '/api/v1/auth/logout', method: 'POST' },
          },
        })
      },
    )

    app.post(
      '/api/v1/auth/logout',
      { preHandler: [authenticate] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const token = request.cookies?.session
        if (token) {
          await this.service.logout(token)
        }
        clearSessionCookie(reply)
        return reply.status(204).send()
      },
    )

    app.get(
      '/api/v1/auth/me',
      { preHandler: [authenticate] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await this.service.getMe(
          request.auth!.userId,
          request.auth!.organizationId,
        )
        return reply.status(200).send({
          data: result,
          _links: {
            self: { href: '/api/v1/auth/me' },
            logout: { href: '/api/v1/auth/logout', method: 'POST' },
          },
        })
      },
    )
  }
}
