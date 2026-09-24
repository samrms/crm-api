import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from './jwt.js'
import { UnauthorizedError } from '@/shared/errors/AppError.js'

export interface AuthContext {
  userId: string
  organizationId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

export class AuthGuard {
  /**
   * Resolves the caller from a signed token. No database query: the claims
   * carry identity, organization, and role.
   */
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

    const claims = verifyToken(token)
    request.auth = {
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role,
    }
  }
}

export const authGuard = new AuthGuard()
