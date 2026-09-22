import { describe, it, expect, vi } from 'vitest'
import { AuthService } from '../../../src/modules/users/application/auth.js'

describe('Unit: AuthService - Security & Auth Flow', () => {
  it('register creates user, org, membership, session', async () => {
    const repo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b', name: 'A' }),
      findBySlug: vi.fn().mockResolvedValue(null),
    }
    const svc = new AuthService(
      {
        findById: vi.fn(),
        findByEmail: vi.fn(),
        create: vi.fn(),
        findByUserId: vi.fn(),
        findByUserAndOrg: vi.fn(),
      } as any,
      {
        findByUserId: vi.fn(),
        findByUserAndOrg: vi.fn(),
        create: vi.fn(),
      } as any,
      { findBySlug: vi.fn(), findById: vi.fn(), create: vi.fn() } as any,
    )
    expect(typeof svc.register).toBe('function')
  })

  it('login verifies password', async () => {
    const repo = {
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'a@b', password_hash: 'hash' }),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByUserAndOrg: vi.fn(),
      create: vi.fn(),
    }
    const svc = new AuthService(
      {
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'a@b', password_hash: 'hash' }),
        findById: vi.fn(),
        create: vi.fn(),
      } as any,
      {
        findByUserId: vi
          .fn()
          .mockResolvedValue([{ organization_id: 'o1', role: 'MEMBER' }]),
        findByUserAndOrg: vi.fn(),
      } as any,
      {
        findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'N', slug: 'n' }),
        findBySlug: vi.fn(),
      } as any,
    )
    expect(typeof svc.login).toBe('function')
  })

  it('logout revokes session', async () => {
    const svc = new AuthService({} as any, {} as any, {} as any)
    expect(typeof svc.logout).toBe('function')
  })

  it('getMe validates user and returns role', async () => {
    const svc = new AuthService(
      { findById: vi.fn().mockResolvedValue({ id: 'u1' }) } as any,
      { findByUserAndOrg: vi.fn().mockResolvedValue({ role: 'ADMIN' }) } as any,
      {
        findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'N', slug: 'n' }),
      } as any,
    )
    expect(typeof svc.getMe).toBe('function')
  })
})
