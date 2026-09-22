import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { config } from '@/shared/config.js'
import { nanoid } from 'nanoid'

export class SessionService {
  constructor(private db: Kysely<Database>) {}

  async create(userId: string, organizationId: string) {
    const id = `sess_${nanoid(12)}`
    const token = nanoid(32)
    const expiresAt = new Date(
      Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    )
    await this.db
      .insertInto('sessions')
      .values({
        id,
        token,
        user_id: userId,
        organization_id: organizationId,
        expires_at: expiresAt,
        created_at: new Date(),
      })
      .execute()
    return { sessionId: id, token, userId, organizationId, expiresAt }
  }

  async findByToken(token: string) {
    return await this.db
      .selectFrom('sessions')
      .where('token', '=', token)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst()
  }

  async revoke(token: string) {
    await this.db
      .updateTable('sessions')
      .set({ revoked_at: new Date() })
      .where('token', '=', token)
      .execute()
  }

  async revokeAllForUser(userId: string) {
    await this.db
      .updateTable('sessions')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute()
  }
}
