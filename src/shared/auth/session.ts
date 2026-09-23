import { getDb } from '@/shared/database/connection.js'
import { config } from '@/shared/config.js'
import { nanoid } from 'nanoid'
import { newId } from '@/shared/utils/id.js'
import type { SessionsTable } from '@/shared/database/types.js'

export interface SessionData {
  sessionId: string
  token: string
  userId: string
  organizationId: string
  expiresAt: Date
}

export async function createSession(
  userId: string,
  organizationId: string,
): Promise<SessionData> {
  const id = newId('sess')
  const token = nanoid(32)
  const expiresAt = new Date(
    Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  )

  await getDb()
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

export async function findSession(
  token: string,
): Promise<SessionsTable | undefined> {
  const row = await getDb()
    .selectFrom('sessions')
    .selectAll()
    .where('token', '=', token)
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', new Date())
    .executeTakeFirst()
  return row as SessionsTable | undefined
}

export async function revokeSession(token: string): Promise<void> {
  await getDb()
    .updateTable('sessions')
    .set({ revoked_at: new Date() })
    .where('token', '=', token)
    .execute()
}

export async function revokeAllExceptSession(
  userId: string,
  token: string,
): Promise<void> {
  await getDb()
    .updateTable('sessions')
    .set({ revoked_at: new Date() })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .where('token', '!=', token)
    .execute()
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await getDb()
    .updateTable('sessions')
    .set({ revoked_at: new Date() })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute()
}

export function setSessionCookie(
  reply: {
    setCookie: (
      name: string,
      value: string,
      options: Record<string, unknown>,
    ) => void
  },
  token: string,
): void {
  reply.setCookie('session', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionMaxAgeDays * 24 * 60 * 60,
  })
}

export function clearSessionCookie(reply: {
  setCookie: (
    name: string,
    value: string,
    options: Record<string, unknown>,
  ) => void
}): void {
  reply.setCookie('session', '', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
