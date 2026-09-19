import { getDb } from '../../../shared/database/connection.js'
import type { MembershipsTable, Role } from '../../../shared/database/types.js'

export type MembershipRow = MembershipsTable

export interface MembershipRepository {
  findByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<MembershipRow | undefined>
  create(data: {
    id: string
    userId: string
    organizationId: string
    role: Role
  }): Promise<MembershipRow>
  findByUserId(userId: string): Promise<MembershipRow[]>
}

export class PostgresMembershipRepository implements MembershipRepository {
  async findByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<MembershipRow | undefined> {
    const row = await getDb()
      .selectFrom('memberships')
      .where('user_id', '=', userId)
      .where('organization_id', '=', organizationId)
      .executeTakeFirst()
    return row as MembershipRow | undefined
  }

  async create(data: {
    id: string
    userId: string
    organizationId: string
    role: Role
  }): Promise<MembershipRow> {
    const now = new Date()
    const row = await getDb()
      .insertInto('memberships')
      .values({
        id: data.id,
        user_id: data.userId,
        organization_id: data.organizationId,
        role: data.role,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as MembershipRow
  }

  async findByUserId(userId: string): Promise<MembershipRow[]> {
    const rows = await getDb()
      .selectFrom('memberships')
      .where('user_id', '=', userId)
      .execute()
    return rows as MembershipRow[]
  }
}
