import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { AuthService } from '@/modules/users/application/auth.js'
import { setSessionCookie, clearSessionCookie } from '@/shared/auth/session.js'
import { authenticate } from '@/shared/auth/authenticate.js'
import { UnauthorizedError } from '@/shared/errors/AppError.js'

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

const passwordChangeSchema = z.object({
  currentPassword: z.string(),
  password: z.string().min(8).max(128),
})

export class AuthRoutes {
  constructor(private readonly service: AuthService) {}
  async register(app: FastifyInstance): Promise<void> {
    app.post(
      '/api/v1/auth/register',
      {
        schema: {
          tags: ['Auth'],
          summary: 'Register a new organization and owner',
          body: zodToJsonSchema(registerSchema, { target: 'openApi3' }),
        },
      },
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
      {
        schema: {
          tags: ['Auth'],
          summary: 'Login',
          body: zodToJsonSchema(loginSchema, { target: 'openApi3' }),
        },
      },
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
      '/api/v1/auth/password/change',
      {
        preHandler: [authenticate],
        schema: {
          tags: ['Auth'],
          summary: 'Change password (revokes other sessions)',
          body: zodToJsonSchema(passwordChangeSchema, { target: 'openApi3' }),
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = passwordChangeSchema.parse(request.body)
        const token = request.cookies?.session
        if (!token) throw new UnauthorizedError('Invalid credentials')
        await this.service.changePassword(
          request.auth!.userId,
          body.currentPassword,
          body.password,
          token,
        )
        return reply.status(200).send({
          data: { message: 'Password updated' },
          _links: {
            me: { href: '/api/v1/auth/me' },
          },
        })
      },
    )

    app.post(
      '/api/v1/auth/logout',
      {
        preHandler: [authenticate],
        schema: { tags: ['Auth'], summary: 'Logout (revoke session)' },
      },
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
      {
        preHandler: [authenticate],
        schema: { tags: ['Auth'], summary: 'Get current user' },
      },
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
