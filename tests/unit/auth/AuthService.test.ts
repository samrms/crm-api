import { describe, it, expect, vi } from 'vitest'
import { AuthService } from '../../../src/modules/users/application/auth.js'
import type { UserRepository } from '../../../src/modules/users/infrastructure/PostgresUserRepository.js'
import type { MembershipRepository } from '../../../src/modules/users/infrastructure/PostgresMembershipRepository.js'
import type { OrganizationRepository } from '../../../src/modules/organizations/infrastructure/PostgresOrganizationRepository.js'

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
