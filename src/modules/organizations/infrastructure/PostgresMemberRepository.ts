import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import {
  PostgresMembershipRepository,
  type MembershipRow,
} from '@/modules/users/infrastructure/PostgresMembershipRepository.js'

export type MemberWithUser = MembershipRow & {
  user_email: string
  user_name: string
}

export interface MemberRepository {
  findByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<MembershipRow | undefined>
  findByUserId(userId: string): Promise<MembershipRow[]>
  findByOrganizationId(organizationId: string): Promise<MembershipRow[]>
  create(data: {
    id: string
    userId: string
    organizationId: string
    role: MembershipRow['role']
  }): Promise<MembershipRow>
  updateRole(
    userId: string,
    organizationId: string,
    role: MembershipRow['role'],
  ): Promise<MembershipRow | undefined>
  delete(userId: string, organizationId: string): Promise<boolean>
  listWithUsers(organizationId: string): Promise<MemberWithUser[]>
}

export class PostgresMemberRepository
  extends PostgresMembershipRepository
  implements MemberRepository
{
  constructor(db: Kysely<Database>) {
    super(db)
  }

  async listWithUsers(organizationId: string): Promise<MemberWithUser[]> {
    const rows = await this.db
      .selectFrom('memberships')
      .innerJoin('users', 'users.id', 'memberships.user_id')
      .selectAll('memberships')
      .select(['users.email as user_email', 'users.name as user_name'])
      .where('memberships.organization_id', '=', organizationId)
      .execute()
    return rows as MemberWithUser[]
  }
}
