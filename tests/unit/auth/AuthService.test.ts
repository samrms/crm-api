import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Kysely } from 'kysely'
import type { Database } from '../../../src/shared/database/types.ts'
import type {
  UserRepository,
  UserRow,
} from '../../../src/modules/users/infrastructure/PostgresUserRepository.ts'
import type {
  MembershipRepository,
  MembershipRow,
} from '../../../src/modules/users/infrastructure/PostgresMembershipRepository.ts'
import {
  hashPassword,
  verifyPassword,
} from '../../../src/shared/auth/password.ts'
import { sessions } from '../../../src/shared/auth/session.ts'
import { AuthService } from '../../../src/modules/users/application/auth.ts'

vi.mock('../../../src/shared/auth/password.ts', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../src/shared/auth/session.ts', () => ({
  sessions: {
    create: vi.fn().mockResolvedValue({
      sessionId: 'sess_1',
      token: 'token-1',
      userId: 'user_1',
      organizationId: 'org_1',
      expiresAt: new Date('2030-01-01'),
    }),
    revoke: vi.fn(),
    revokeAllExceptSession: vi.fn(),
    find: vi.fn(),
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
  },
}))

const user = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'user_1',
  email: 'a@b.test',
  name: 'A',
  password_hash: 'hashed-password',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
})

const membership = (overrides: Partial<MembershipRow> = {}): MembershipRow => ({
  id: 'mem_1',
  user_id: 'user_1',
  organization_id: 'org_1',
  role: 'OWNER',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

interface FakeDb {
  db: Kysely<Database>
  inserted: Record<string, Record<string, unknown>[]>
}

function fakeDb(
  organization: { id: string; name: string; slug: string } | null,
): FakeDb {
  const inserted: Record<string, Record<string, unknown>[]> = {}
  const trx = {
    insertInto: (table: string) => ({
      values: (values: Record<string, unknown>) => {
        inserted[table] = [...(inserted[table] ?? []), values]
        return {
          returningAll: () => ({
            executeTakeFirstOrThrow: async () => values,
          }),
        }
      },
    }),
  }
  const db = {
    transaction: () => ({
      execute: (callback: (t: typeof trx) => unknown) => callback(trx),
    }),
    selectFrom: (table: string) => {
      expect(table).toBe('organizations')
      return {
        select: () => ({
          where: () => ({ executeTakeFirst: async () => organization }),
        }),
      }
    },
  } as unknown as Kysely<Database>
  return { db, inserted }
}

function userRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(user()),
    findByEmail: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    updatePassword: vi.fn(),
    ...overrides,
  } as unknown as UserRepository
}

function membershipRepo(
  overrides: Partial<MembershipRepository> = {},
): MembershipRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([membership()]),
    findByUserAndOrg: vi.fn().mockResolvedValue(membership()),
    create: vi.fn(),
    ...overrides,
  } as unknown as MembershipRepository
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(hashPassword).mockResolvedValue('hashed-password')
  vi.mocked(verifyPassword).mockResolvedValue(true)
  vi.mocked(sessions.create).mockResolvedValue({
    sessionId: 'sess_1',
    token: 'token-1',
    userId: 'user_1',
    organizationId: 'org_1',
    expiresAt: new Date('2030-01-01'),
  })
})

describe('AuthService', () => {
  const input = {
    email: 'a@b.test',
    password: 'password123',
    name: 'A',
    organizationName: 'Acme Corp',
  }

  it('register persists user, organization, membership and session atomically', async () => {
    const { db, inserted } = fakeDb(null)
    const service = new AuthService(db, userRepo(), membershipRepo())

    const result = await service.register(input)

    expect(result.organization.name).toBe('Acme Corp')
    expect(result.organization.slug).toBe('acme-corp')
    expect(inserted.organizations).toHaveLength(1)
    expect(inserted.organizations![0]).toMatchObject({
      name: 'Acme Corp',
      slug: 'acme-corp',
    })
    expect(inserted.users).toHaveLength(1)
    expect(inserted.memberships![0]).toMatchObject({ role: 'OWNER' })
    expect(sessions.create).toHaveBeenCalledWith(
      inserted.users![0]!.id,
      inserted.organizations![0]!.id,
      expect.anything(),
    )
  })

  it('register rejects duplicate emails with 409', async () => {
    const { db } = fakeDb(null)
    const service = new AuthService(
      db,
      userRepo({ findByEmail: vi.fn().mockResolvedValue(user()) }),
      membershipRepo(),
    )
    await expect(service.register(input)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    })
  })

  it('login returns the persisted organization', async () => {
    const { db } = fakeDb({ id: 'org_1', name: 'Acme Corp', slug: 'acme-corp' })
    const service = new AuthService(
      db,
      userRepo({ findByEmail: vi.fn().mockResolvedValue(user()) }),
      membershipRepo(),
    )
    const result = await service.login({
      email: input.email,
      password: input.password,
    })
    expect(result.organization).toEqual({
      id: 'org_1',
      name: 'Acme Corp',
      slug: 'acme-corp',
    })
    expect(verifyPassword).toHaveBeenCalledWith(
      input.password,
      'hashed-password',
    )
  })

  it('login rejects wrong passwords and unknown users', async () => {
    const { db } = fakeDb({ id: 'org_1', name: 'Acme', slug: 'acme' })
    vi.mocked(verifyPassword).mockResolvedValue(false)
    const wrongPassword = new AuthService(
      db,
      userRepo({ findByEmail: vi.fn().mockResolvedValue(user()) }),
      membershipRepo(),
    )
    await expect(
      wrongPassword.login({ email: input.email, password: 'nope' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })

    const unknownUser = new AuthService(
      db,
      userRepo({ findByEmail: vi.fn().mockResolvedValue(undefined) }),
      membershipRepo(),
    )
    await expect(
      unknownUser.login({ email: input.email, password: input.password }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('login rejects users without a membership', async () => {
    const { db } = fakeDb({ id: 'org_1', name: 'Acme', slug: 'acme' })
    const service = new AuthService(
      db,
      userRepo({ findByEmail: vi.fn().mockResolvedValue(user()) }),
      membershipRepo({ findByUserId: vi.fn().mockResolvedValue([]) }),
    )
    await expect(
      service.login({ email: input.email, password: input.password }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('getMe returns the user, organization and role', async () => {
    const { db } = fakeDb({ id: 'org_1', name: 'Acme Corp', slug: 'acme-corp' })
    const service = new AuthService(
      db,
      userRepo(),
      membershipRepo({
        findByUserAndOrg: vi
          .fn()
          .mockResolvedValue(membership({ role: 'ADMIN' })),
      }),
    )
    const me = await service.getMe('user_1', 'org_1')
    expect(me.role).toBe('ADMIN')
    expect(me.organization).toEqual({
      id: 'org_1',
      name: 'Acme Corp',
      slug: 'acme-corp',
    })
  })

  it('changePassword verifies the current password and revokes other sessions', async () => {
    const { db } = fakeDb(null)
    const repositories = userRepo()
    const service = new AuthService(db, repositories, membershipRepo())

    await service.changePassword(
      'user_1',
      'password123',
      'new-password',
      'current-token',
    )
    expect(hashPassword).toHaveBeenCalledWith('new-password')
    expect(repositories.updatePassword).toHaveBeenCalledWith(
      'user_1',
      'hashed-password',
    )
    expect(sessions.revokeAllExceptSession).toHaveBeenCalledWith(
      'user_1',
      'current-token',
    )
  })

  it('changePassword rejects an incorrect current password', async () => {
    const { db } = fakeDb(null)
    const service = new AuthService(db, userRepo(), membershipRepo())
    vi.mocked(verifyPassword).mockResolvedValue(false)
    await expect(
      service.changePassword('user_1', 'wrong', 'new-password', 'token'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(sessions.revokeAllExceptSession).not.toHaveBeenCalled()
  })

  it('logout revokes the session token', async () => {
    const { db } = fakeDb(null)
    await new AuthService(db, userRepo(), membershipRepo()).logout('token-1')
    expect(sessions.revoke).toHaveBeenCalledWith('token-1')
  })
})
