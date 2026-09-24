import type { FastifyRequest, FastifyReply } from 'fastify'
import { sessions } from './session.js'
import { UnauthorizedError } from '@/shared/errors/AppError.js'

export interface AuthContext {
  userId: string
  organizationId: string
  sessionId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

export class AuthGuard {
  readonly authenticate = async (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> => {
    const cookieToken = request.cookies?.session
    const authHeader = request.headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined

    const token = cookieToken ?? bearerToken
    if (!token) {
      throw new UnauthorizedError('No session token provided')
    }

    const session = await sessions.find(token)
    if (!session) {
      throw new UnauthorizedError('Invalid or expired session')
    }

    request.auth = {
      userId: session.user_id,
      organizationId: session.organization_id,
      sessionId: session.id,
    }
  }
}

export const authGuard = new AuthGuard()
