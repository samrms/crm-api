import type { Kysely } from 'kysely'
import type {
  MembershipsTable,
  Role,
  Database,
} from '@/shared/database/types.js'

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
  findByOrganizationId(organizationId: string): Promise<MembershipRow[]>
  updateRole(
    userId: string,
    organizationId: string,
    role: Role,
  ): Promise<MembershipRow | undefined>
  delete(userId: string, organizationId: string): Promise<boolean>
}

export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<MembershipRow | undefined> {
    const row = await this.db
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
    const row = await this.db
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
    const rows = await this.db
      .selectFrom('memberships')
      .where('user_id', '=', userId)
      .execute()
    return rows as MembershipRow[]
  }

  async findByOrganizationId(organizationId: string): Promise<MembershipRow[]> {
    const rows = await this.db
      .selectFrom('memberships')
      .where('organization_id', '=', organizationId)
      .execute()
    return rows as MembershipRow[]
  }

  async updateRole(
    userId: string,
    organizationId: string,
    role: Role,
  ): Promise<MembershipRow | undefined> {
    const row = await this.db
      .updateTable('memberships')
      .set({ role, updated_at: new Date() })
      .where('user_id', '=', userId)
      .where('organization_id', '=', organizationId)
      .returningAll()
      .executeTakeFirst()
    return row as MembershipRow | undefined
  }

  async delete(userId: string, organizationId: string): Promise<boolean> {
    const row = await this.db
      .deleteFrom('memberships')
      .where('user_id', '=', userId)
      .where('organization_id', '=', organizationId)
      .returningAll()
      .executeTakeFirst()
    return !!row
  }
}
