import { describe, it, expect, vi } from 'vitest'
import { MemberService } from '../../../src/modules/members/application/MemberService.js'
import type { MembershipRepository } from '../../../src/modules/users/infrastructure/PostgresMembershipRepository.js'
import type { UserRepository } from '../../../src/modules/users/infrastructure/PostgresUserRepository.js'
import type { Role } from '../../../src/shared/database/types.js'

describe('Unit: MemberService', () => {
  it('adds member', async () => {
    const membershipRepo = {
      findByUserAndOrg: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'm1', role: 'ADMIN' }),
    } as MembershipRepository
    const userRepo = {
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'a@b', name: 'A' }),
    } as UserRepository
    const svc = new MemberService(membershipRepo, userRepo)
    const r = await svc.inviteMember({
      organizationId: 'o1',
      userId: 'u1',
      role: 'ADMIN' as Role,
    })
    expect(r.role).toBe('ADMIN')
  })
})
