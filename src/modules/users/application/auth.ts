import { newId } from '@/shared/utils/id.js'
import { toSlug } from '@/shared/utils/slug.js'
import { hashPassword, verifyPassword } from '@/shared/auth/password.js'
import {
  createSession,
  revokeSession,
  revokeAllUserSessions,
} from '@/shared/auth/session.js'
import type { UserRepository } from '@/modules/users/infrastructure/PostgresUserRepository.js'
import type { MembershipRepository } from '@/modules/users/infrastructure/PostgresMembershipRepository.js'
import type { OrganizationRepository } from '@/modules/organizations/infrastructure/PostgresOrganizationRepository.js'
import type { PasswordResetRepository } from '@/modules/users/infrastructure/PostgresPasswordResetRepository.js'
import { nanoid } from 'nanoid'
import { createHash } from 'node:crypto'
import { logger } from '@/shared/logging/logger.js'
import { config } from '@/shared/config.js'
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
export interface AuthResult {
  user: { id: string; email: string; name: string }
  organization: { id: string; name: string; slug: string }
  session: { token: string; expiresAt: Date }
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly membershipRepo: MembershipRepository,
    private readonly orgRepo: OrganizationRepository,
    private readonly resetRepo: PasswordResetRepository,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email)
    if (existing)
      throw new ConflictError('A user with this email already exists')
    const userId = newId('user')
    const orgId = newId('org')
    const membershipId = newId('mem')
    const passwordHash = await hashPassword(input.password)
    const user = await this.userRepo.create({
      id: userId,
      email: input.email,
      name: input.name,
      passwordHash,
    })
    const slug = toSlug(input.organizationName)
    const org = await this.orgRepo.create({
      id: orgId,
      name: input.organizationName,
      slug,
    })
    await this.membershipRepo.create({
      id: membershipId,
      userId,
      organizationId: orgId,
      role: 'OWNER',
    })
    const session = await createSession(userId, orgId)
    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: org.id, name: org.name, slug: org.slug },
      session: { token: session.token, expiresAt: session.expiresAt },
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email)
    if (!user) throw new UnauthorizedError('Invalid email or password')
    const valid = await verifyPassword(input.password, user.password_hash)
    if (!valid) throw new UnauthorizedError('Invalid email or password')
    const memberships = await this.membershipRepo.findByUserId(user.id)
    if (memberships.length === 0)
      throw new NotFoundError('Organization membership')
    const membership = memberships[0]!
    const session = await createSession(user.id, membership.organization_id)
    const org = await this.orgRepo.findById(membership.organization_id)
    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: org
        ? { id: org.id, name: org.name, slug: org.slug }
        : { id: membership.organization_id, name: 'Unknown', slug: 'unknown' },
      session: { token: session.token, expiresAt: session.expiresAt },
    }
  }

  async logout(token: string): Promise<void> {
    await revokeSession(token)
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email)
    if (!user) {
      logger.info({ email }, 'Password reset requested for unknown email')
      return
    }
    const token = nanoid(32)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await this.resetRepo.create({
      id: newId('prt'),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    if (!config.isProduction) {
      logger.info(
        { userId: user.id, resetToken: token },
        'Password reset token (development only)',
      )
    }
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const record = await this.resetRepo.findValidByTokenHash(tokenHash)
    if (!record) throw new UnauthorizedError('Invalid or expired reset token')
    const user = await this.userRepo.findById(record.user_id)
    if (!user) throw new UnauthorizedError('Invalid or expired reset token')
    await this.userRepo.updatePassword(user.id, await hashPassword(newPassword))
    await this.resetRepo.markUsed(record.id)
    await revokeAllUserSessions(user.id)
  }

  async getMe(
    userId: string,
    organizationId: string,
  ): Promise<{
    user: { id: string; email: string; name: string }
    organization: { id: string; name: string; slug: string } | null
    role: string | null
  }> {
    const user = await this.userRepo.findById(userId)
    if (!user) throw new NotFoundError('User')
    const org = await this.orgRepo.findById(organizationId)
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId,
    )
    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      role: membership?.role ?? null,
    }
  }
}
