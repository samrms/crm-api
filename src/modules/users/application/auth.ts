import { nanoid } from 'nanoid'
import { hashPassword, verifyPassword } from '../../../shared/auth/password.js'
import { createSession, revokeSession } from '../../../shared/auth/session.js'
import { PostgresUserRepository } from '../infrastructure/PostgresUserRepository.js'
import { PostgresMembershipRepository } from '../infrastructure/PostgresMembershipRepository.js'
import { PostgresOrganizationRepository } from '../../organizations/infrastructure/PostgresOrganizationRepository.js'
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../../../shared/errors/AppError.js'

const userRepo = new PostgresUserRepository()
const membershipRepo = new PostgresMembershipRepository()
const orgRepo = new PostgresOrganizationRepository()

export interface RegisterInput {
  email: string
  password: string
  name: string
  organizationName: string
}

export interface AuthResult {
  user: { id: string; email: string; name: string }
  organization: { id: string; name: string; slug: string }
  session: { token: string; expiresAt: Date }
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await userRepo.findByEmail(input.email)
  if (existing) {
    throw new ConflictError('A user with this email already exists')
  }

  const userId = `user_${nanoid(12)}`
  const orgId = `org_${nanoid(12)}`
  const membershipId = `mem_${nanoid(12)}`

  const passwordHash = await hashPassword(input.password)

  const user = await userRepo.create({
    id: userId,
    email: input.email,
    name: input.name,
    passwordHash,
  })

  const slug = input.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const org = await orgRepo.create({
    id: orgId,
    name: input.organizationName,
    slug,
  })

  await membershipRepo.create({
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

export interface LoginInput {
  email: string
  password: string
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userRepo.findByEmail(input.email)
  if (!user) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const valid = await verifyPassword(input.password, user.password_hash)
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const memberships = await membershipRepo.findByUserId(user.id)
  if (memberships.length === 0) {
    throw new NotFoundError('Organization membership')
  }

  const membership = memberships[0]!
  const session = await createSession(user.id, membership.organization_id)

  const org = await orgRepo.findById(membership.organization_id)

  return {
    user: { id: user.id, email: user.email, name: user.name },
    organization: org
      ? { id: org.id, name: org.name, slug: org.slug }
      : { id: membership.organization_id, name: 'Unknown', slug: 'unknown' },
    session: { token: session.token, expiresAt: session.expiresAt },
  }
}

export async function logout(token: string): Promise<void> {
  await revokeSession(token)
}

export async function getMe(userId: string, organizationId: string) {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new NotFoundError('User')
  }

  const org = await orgRepo.findById(organizationId)
  const membership = await membershipRepo.findByUserAndOrg(
    userId,
    organizationId,
  )

  return {
    user: { id: user.id, email: user.email, name: user.name },
    organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
    role: membership?.role ?? null,
  }
}
