import { newId } from '@/shared/utils/id.js'
import { toSlug } from '@/shared/utils/slug.js'
import { hashPassword, verifyPassword } from '@/shared/auth/password.js'
import {
  createSession,
  revokeSession,
  revokeAllExceptSession,
} from '@/shared/auth/session.js'
import type { UserRepository } from '@/modules/users/infrastructure/PostgresUserRepository.js'
import type { MembershipRepository } from '@/modules/users/infrastructure/PostgresMembershipRepository.js'
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
    const org = {
      id: orgId,
      name: input.organizationName,
      slug: toSlug(input.organizationName),
    } as { id: string; name: string; slug: string }
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
    const org = { id: membership.organization_id, name: 'Unknown', slug: 'unknown' }
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

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentToken: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId)
    if (!user) throw new UnauthorizedError('Invalid credentials')
    const valid = await verifyPassword(currentPassword, user.password_hash)
    if (!valid) throw new UnauthorizedError('Invalid credentials')
    await this.userRepo.updatePassword(user.id, await hashPassword(newPassword))
    await revokeAllExceptSession(user.id, currentToken)
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
    const org = { id: organizationId, name: 'Unknown', slug: 'unknown' }
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
