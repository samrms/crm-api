import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '@/shared/errors/AppError.js'
import { database } from '@/shared/database/connection.js'
import type { Role } from '@/shared/database/types.js'

export class Authorizer {
  requireRole(...allowedRoles: Role[]) {
    return async (
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> => {
      if (!request.auth) {
        throw new ForbiddenError('Authentication required')
      }

      const row = await database.db
        .selectFrom('memberships')
        .selectAll()
        .where('user_id', '=', request.auth.userId)
        .where('organization_id', '=', request.auth.organizationId)
        .executeTakeFirst()

      if (!row) {
        throw new ForbiddenError('You are not a member of this organization')
      }

      const membership = row as { role: Role }
      if (!allowedRoles.includes(membership.role)) {
        throw new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        )
      }
    }
  }
}

export const authorizer = new Authorizer()
