import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '../errors/AppError.js'
import { getDb } from '../database/connection.js'
import type { Role } from '../database/types.js'

export function requireRole(...allowedRoles: Role[]) {
  return async (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> => {
    if (!request.auth) {
      throw new ForbiddenError('Authentication required')
    }

    const row = await getDb()
      .selectFrom('memberships')
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
