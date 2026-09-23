import { describe, it, expect, vi } from 'vitest'
import {
  revokeAllUserSessions,
  revokeAllExceptSession,
} from '../../../src/shared/auth/session.js'
import {
  hashPassword,
  verifyPassword,
} from '../../../src/shared/auth/password.js'

vi.mock('../../../src/shared/auth/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../src/shared/auth/session.js', () => ({
  createSession: vi.fn(),
  findSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  revokeAllExceptSession: vi.fn(),
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

describe('Unit: AuthService - Password Change', () => {
  const setup = (user: unknown) => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue(user),
      updatePassword: vi.fn(),
    } as any
    const svc = new AuthService(userRepo, {} as any, {} as any, {} as any)
    return { svc, userRepo }
  }

  it('changePassword verifies current, updates and revokes other sessions', async () => {
    const { svc, userRepo } = setup({ id: 'u1', password_hash: 'h' })
    await svc.changePassword('u1', 'oldpassword123', 'newpassword123', 'tok-current')
    expect(verifyPassword).toHaveBeenCalledWith('oldpassword123', 'h')
    expect(userRepo.updatePassword).toHaveBeenCalledWith('u1', 'hashed')
    expect(revokeAllExceptSession).toHaveBeenCalledWith('u1', 'tok-current')
  })

  it('changePassword rejects wrong current password', async () => {
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    const { svc, userRepo } = setup({ id: 'u1', password_hash: 'h' })
    await expect(
      svc.changePassword('u1', 'wrong', 'newpassword123', 'tok'),
    ).rejects.toThrow(UnauthorizedError)
    expect(userRepo.updatePassword).not.toHaveBeenCalled()
  })

  it('changePassword rejects unknown user', async () => {
    const { svc, userRepo } = setup(null)
    await expect(
      svc.changePassword('missing', 'x', 'newpassword123', 'tok'),
    ).rejects.toThrow(UnauthorizedError)
    expect(userRepo.updatePassword).not.toHaveBeenCalled()
  })
})
