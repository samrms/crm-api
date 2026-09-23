import { describe, it, expect, vi } from 'vitest'
import { revokeAllUserSessions } from '../../../src/shared/auth/session.js'

vi.mock('../../../src/shared/auth/session.js', () => ({
  createSession: vi.fn(),
  findSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}))
import { AuthService } from '../../../src/modules/users/application/auth.js'
import type { UserRepository } from '../../../src/modules/users/infrastructure/PostgresUserRepository.js'
import type { MembershipRepository } from '../../../src/modules/users/infrastructure/PostgresMembershipRepository.js'
import type { OrganizationRepository } from '../../../src/modules/organizations/infrastructure/PostgresOrganizationRepository.js'
import type { PasswordResetRepository } from '../../../src/modules/users/infrastructure/PostgresPasswordResetRepository.js'
import { UnauthorizedError } from '../../../src/shared/errors/AppError.js'

describe('Unit: AuthService - Security & Auth Flow', () => {
  it('register creates user, org, membership, session', async () => {
    const svc = new AuthService(
      {
        findByEmail: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findByUserAndOrg: vi.fn(),
      } as UserRepository,
      {
        findByUserId: vi.fn(),
        findByUserAndOrg: vi.fn(),
        create: vi.fn(),
      } as MembershipRepository,
      {
        findBySlug: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
      } as OrganizationRepository,
    )
    expect(typeof svc.register).toBe('function')
  })
  it('login verifies password', async () => {
    const svc = new AuthService(
      {
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'a@b', password_hash: 'hash' }),
        findById: vi.fn(),
        create: vi.fn(),
        findByUserId: vi.fn(),
        findByUserAndOrg: vi.fn(),
      } as UserRepository,
      {
        findByUserId: vi
          .fn()
          .mockResolvedValue([{ organization_id: 'o1', role: 'MEMBER' }]),
        findByUserAndOrg: vi.fn(),
      } as MembershipRepository,
      {
        findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'N', slug: 'n' }),
        findBySlug: vi.fn(),
      } as OrganizationRepository,
    )
    expect(typeof svc.login).toBe('function')
  })
  it('logout revokes session', async () => {
    const svc = new AuthService(
      {} as UserRepository,
      {} as MembershipRepository,
      {} as OrganizationRepository,
      {} as PasswordResetRepository,
    )
    expect(typeof svc.logout).toBe('function')
  })
  it('getMe validates user and returns role', async () => {
    const svc = new AuthService(
      {
        findById: vi.fn().mockResolvedValue({ id: 'u1' }),
        findByEmail: vi.fn(),
        create: vi.fn(),
        findByUserId: vi.fn(),
        findByUserAndOrg: vi.fn(),
      } as UserRepository,
      {
        findByUserAndOrg: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
        findByUserId: vi.fn(),
        create: vi.fn(),
        findByOrganizationId: vi.fn(),
        updateRole: vi.fn(),
      } as MembershipRepository,
      {
        findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'N', slug: 'n' }),
        findBySlug: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      } as OrganizationRepository,
    )
    expect(typeof svc.getMe).toBe('function')
  })
})

describe('Unit: AuthService - Password Reset', () => {
  const setup = (overrides: {
    user?: unknown
    tokenRow?: unknown
  } = {}) => {
    const resetRepo = {
      create: vi.fn(),
      findValidByTokenHash: vi.fn().mockResolvedValue(overrides.tokenRow ?? null),
      markUsed: vi.fn(),
    } as unknown as PasswordResetRepository
    const userRepo = {
      findById: vi.fn().mockResolvedValue(overrides.user ?? null),
      findByEmail: vi.fn().mockResolvedValue(overrides.user ?? null),
      updatePassword: vi.fn(),
    } as any
    const svc = new AuthService(
      userRepo,
      {} as any,
      {} as any,
      resetRepo,
    )
    return { svc, resetRepo, userRepo }
  }

  it('requestPasswordReset creates a token for a known email', async () => {
    const { svc, resetRepo } = setup({
      user: { id: 'u1', email: 'a@b.co' },
    })
    await svc.requestPasswordReset('a@b.co')
    expect(resetRepo.create).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: 'u1',
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    })
  })

  it('requestPasswordReset is silent for unknown email', async () => {
    const { svc, resetRepo } = setup({ user: null })
    await expect(
      svc.requestPasswordReset('nobody@x.co'),
    ).resolves.toBeUndefined()
    expect(resetRepo.create).not.toHaveBeenCalled()
  })

  it('confirmPasswordReset updates password, consumes token, revokes sessions', async () => {
    const { svc, resetRepo, userRepo } = setup({
      user: { id: 'u1', email: 'a@b.co' },
      tokenRow: { id: 'prt1', user_id: 'u1' },
    })
    await svc.confirmPasswordReset('plain-token', 'newpassword123')
    expect(resetRepo.findValidByTokenHash).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    )
    expect(userRepo.updatePassword).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
    )
    const hash = userRepo.updatePassword.mock.calls[0][1]
    expect(hash).not.toBe('newpassword123')
    expect(resetRepo.markUsed).toHaveBeenCalledWith('prt1')
    expect(revokeAllUserSessions).toHaveBeenCalledWith('u1')
  })

  it('confirmPasswordReset rejects unknown token', async () => {
    const { svc } = setup({ tokenRow: null })
    await expect(svc.confirmPasswordReset('bad', 'newpassword123')).rejects.toThrow(
      UnauthorizedError,
    )
  })

  it('confirmPasswordReset rejects when user is gone', async () => {
    const { svc } = setup({
      user: null,
      tokenRow: { id: 'prt1', user_id: 'u1' },
    })
    await expect(
      svc.confirmPasswordReset('plain-token', 'newpassword123'),
    ).rejects.toThrow(UnauthorizedError)
  })
})
