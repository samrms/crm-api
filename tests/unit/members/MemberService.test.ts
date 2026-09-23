import { describe, it, expect, vi } from 'vitest'
import { MemberService } from '../../../src/modules/organizations/application/MemberService.js'
import type { MemberRepository } from '../../../src/modules/organizations/infrastructure/PostgresMemberRepository.js'
import type { UserRepository } from '../../../src/modules/users/infrastructure/PostgresUserRepository.js'
import type { Role } from '../../../src/shared/database/types.js'

describe('Unit: MemberService', () => {
  it('inviteMember creates a membership for an existing user', async () => {
    const membershipRepo = {
      findByUserAndOrg: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'm1', role: 'ADMIN' }),
      listWithUsers: vi.fn(),
    } as unknown as MemberRepository
    const userRepo = {
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A' }),
    } as unknown as UserRepository

    const svc = new MemberService(membershipRepo, userRepo)
    const r = await svc.inviteMember({
      organizationId: 'o1',
      email: 'a@b.co',
      role: 'ADMIN' as Role,
    })

    expect(r.role).toBe('ADMIN')
    expect(membershipRepo.create).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: 'u1',
      organizationId: 'o1',
      role: 'ADMIN',
    })
  })

  it('listMembers returns memberships enriched with user details', async () => {
    const enriched = [
      {
        id: 'm1',
        user_id: 'u1',
        organization_id: 'o1',
        role: 'ADMIN',
        user_email: 'a@b.co',
        user_name: 'A',
      },
    ]
    const membershipRepo = {
      listWithUsers: vi.fn().mockResolvedValue(enriched),
    } as unknown as MemberRepository
    const userRepo = {} as unknown as UserRepository

    const svc = new MemberService(membershipRepo, userRepo)
    const members = await svc.listMembers('o1')

    expect(members).toEqual(enriched)
    expect(membershipRepo.listWithUsers).toHaveBeenCalledWith('o1')
  })
})
