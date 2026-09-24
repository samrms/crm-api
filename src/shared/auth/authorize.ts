import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '@/shared/errors/AppError.js'
import type { Role } from '@/shared/database/types.js'

export class Authorizer {
  /**
   * Checks the role carried by the verified token, so authorization costs no
   * database query. A role change therefore takes effect when the caller's
   * token expires (JWT_TTL_MINUTES) rather than immediately.
   */
  requireRole(...allowedRoles: Role[]) {
    return async (
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> => {
      if (!request.auth) {
        throw new ForbiddenError('Authentication required')
      }
      if (!allowedRoles.includes(request.auth.role)) {
        throw new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        )
      }
    }
  }
}

export const authorizer = new Authorizer()
