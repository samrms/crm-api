import type { Kysely } from 'kysely'
import { database } from '@/shared/database/connection.js'
import { config } from '@/shared/config.js'
import { nanoid } from 'nanoid'
import { newId } from '@/shared/utils/id.js'
import type { Database, SessionsTable } from '@/shared/database/types.js'

export interface SessionData {
  sessionId: string
  token: string
  userId: string
  organizationId: string
  expiresAt: Date
}

export interface CookieTarget {
  setCookie: (
    name: string,
    value: string,
    options: Record<string, unknown>,
  ) => void
}

export class SessionManager {
  async create(
    userId: string,
    organizationId: string,
    db: Kysely<Database> = database.db,
  ): Promise<SessionData> {
    const id = newId('sess')
    const token = nanoid(32)
    const expiresAt = new Date(
      Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    )

    await db
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

  async find(token: string): Promise<SessionsTable | undefined> {
    const row = await database.db
      .selectFrom('sessions')
      .selectAll()
      .where('token', '=', token)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst()
    return row as SessionsTable | undefined
  }

  async revoke(token: string): Promise<void> {
    await database.db
      .updateTable('sessions')
      .set({ revoked_at: new Date() })
      .where('token', '=', token)
      .execute()
  }

  async revokeAllExceptSession(userId: string, token: string): Promise<void> {
    await database.db
      .updateTable('sessions')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('token', '!=', token)
      .execute()
  }

  setCookie(reply: CookieTarget, token: string): void {
    reply.setCookie('session', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: config.sessionMaxAgeDays * 24 * 60 * 60,
    })
  }

  clearCookie(reply: CookieTarget): void {
    reply.setCookie('session', '', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  }
}

export const sessions = new SessionManager()
