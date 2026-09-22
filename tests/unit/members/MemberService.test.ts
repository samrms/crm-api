import { describe, it, expect, vi } from 'vitest'
import { createMemberService } from '../../../src/modules/members/application/MemberService.js'

describe('Unit: MemberService', () => {
  it('adds member', async () => {
    const svc = createMemberService({
      create: vi.fn().mockResolvedValue({ id: 'm1', role: 'ADMIN' }),
    } as any)
    const r = await svc.addMember({
      organizationId: 'o1',
      userId: 'u1',
      role: 'ADMIN',
    })
    expect(r.role).toBe('ADMIN')
  })
})
