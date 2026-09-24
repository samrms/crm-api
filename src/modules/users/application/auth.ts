import type { Kysely } from 'kysely'
import { newId } from '@/shared/utils/id.js'
import { toSlug } from '@/shared/utils/slug.js'
import { hashPassword, verifyPassword } from '@/shared/auth/password.js'
import { issueToken } from '@/shared/auth/jwt.js'
import { PostgresUserRepository } from '@/modules/users/infrastructure/PostgresUserRepository.js'
import { PostgresMembershipRepository } from '@/modules/users/infrastructure/PostgresMembershipRepository.js'
import type { UserRepository } from '@/modules/users/infrastructure/PostgresUserRepository.js'
import type { MembershipRepository } from '@/modules/users/infrastructure/PostgresMembershipRepository.js'
import type { Database, Role } from '@/shared/database/types.js'
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '@/shared/errors/AppError.js'

export interface RegisterInput {
  email: string
  password: string
  name: string
  organizationName: string
}
export interface LoginInput {
  email: string
  password: string
}
export interface OrganizationSummary {
  id: string
  name: string
  slug: string
}
export interface AuthResult {
  user: { id: string; email: string; name: string }
  organization: OrganizationSummary
  token: string
  expiresAt: Date
}

export class AuthService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly userRepo: UserRepository,
    private readonly membershipRepo: MembershipRepository,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email)
    if (existing) {
      throw new ConflictError('A user with this email already exists')
    }

    const passwordHash = await hashPassword(input.password)

    return this.db.transaction().execute(async (trx) => {
      const userRepo = new PostgresUserRepository(trx)
      const membershipRepo = new PostgresMembershipRepository(trx)

      const userId = newId('user')
      const orgId = newId('org')

      const user = await userRepo.create({
        id: userId,
        email: input.email,
        name: input.name,
        passwordHash,
      })

      const name = input.organizationName
      const org = await trx
        .insertInto('organizations')
        .values({
          id: orgId,
          name,
          slug: toSlug(name),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await membershipRepo.create({
        id: newId('mem'),
        userId,
        organizationId: orgId,
        role: 'OWNER',
      })

      const { token, expiresAt } = issueToken({
        userId,
        organizationId: orgId,
        role: 'OWNER',
      })

      return {
        user: { id: user.id, email: user.email, name: user.name },
        organization: { id: org.id, name: org.name, slug: org.slug },
        token,
        expiresAt,
      }
    })
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email)
    if (!user) throw new UnauthorizedError('Invalid email or password')
    const valid = await verifyPassword(input.password, user.password_hash)
    if (!valid) throw new UnauthorizedError('Invalid email or password')

    const memberships = await this.membershipRepo.findByUserId(user.id)
    if (memberships.length === 0) {
      throw new NotFoundError('Organization membership')
    }
    const membership = memberships[0]!
    const org = await this.findOrganization(membership.organization_id)
    const { token, expiresAt } = issueToken({
      userId: user.id,
      organizationId: membership.organization_id,
      role: membership.role,
    })

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: org ?? {
        id: membership.organization_id,
        name: 'Unknown',
        slug: 'unknown',
      },
      token,
      expiresAt,
    }
  }

  /**
   * Stateless tokens cannot be revoked server-side, so logout only clears the
   * client's cookie. The token itself stops being accepted when it expires.
   */
  async logout(_token: string): Promise<void> {}

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId)
    if (!user) throw new UnauthorizedError('Invalid credentials')
    const valid = await verifyPassword(currentPassword, user.password_hash)
    if (!valid) throw new UnauthorizedError('Invalid credentials')
    await this.userRepo.updatePassword(user.id, await hashPassword(newPassword))
  }

  async getMe(
    userId: string,
    organizationId: string,
  ): Promise<{
    user: { id: string; email: string; name: string }
    organization: OrganizationSummary | null
    role: Role | null
  }> {
    const user = await this.userRepo.findById(userId)
    if (!user) throw new NotFoundError('User')
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId,
    )
    const organization = await this.findOrganization(organizationId)
    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: organization ?? null,
      role: membership?.role ?? null,
    }
  }

  private async findOrganization(
    organizationId: string,
  ): Promise<OrganizationSummary | undefined> {
    const row = await this.db
      .selectFrom('organizations')
      .select(['id', 'name', 'slug'])
      .where('id', '=', organizationId)
      .executeTakeFirst()
    return row ? { id: row.id, name: row.name, slug: row.slug } : undefined
  }
}
