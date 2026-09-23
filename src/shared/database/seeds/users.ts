import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { hashPassword } from '@/shared/auth/password.js'
import { newId } from '@/shared/utils/id.js'

export const OWNER_EMAIL = 'owner@acme.test'
export const OWNER_PASSWORD = 'secret1234'

export async function seedUsers(
  db: Kysely<Database>,
  orgId: string,
  password: string = OWNER_PASSWORD,
): Promise<{ ownerId: string; memberIds: string[] }> {
  const now = new Date()
  const passwordHash = await hashPassword(password)
  const ownerId = newId('user')
  await db
    .insertInto('users')
    .values({
      id: ownerId,
      email: OWNER_EMAIL,
      name: 'Owner',
      password_hash: passwordHash,
      created_at: now,
      updated_at: now,
    })
    .execute()
  await db
    .insertInto('memberships')
    .values({
      id: newId('mem'),
      user_id: ownerId,
      organization_id: orgId,
      role: 'OWNER',
      created_at: now,
      updated_at: now,
    })
    .execute()

  const memberIds: string[] = []
  for (const [email, name, role] of [
    ['admin@acme.test', 'Admin', 'ADMIN'],
    ['member@acme.test', 'Member', 'MEMBER'],
  ] as const) {
    const userId = newId('user')
    await db
      .insertInto('users')
      .values({
        id: userId,
        email,
        name,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      })
      .execute()
    await db
      .insertInto('memberships')
      .values({
        id: newId('mem'),
        user_id: userId,
        organization_id: orgId,
        role,
        created_at: now,
        updated_at: now,
      })
      .execute()
    memberIds.push(userId)
  }
  return { ownerId, memberIds }
}
