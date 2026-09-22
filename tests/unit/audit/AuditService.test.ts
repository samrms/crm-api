import { describe, it, expect, vi } from 'vitest'
import { createAuditService } from '../../../src/modules/audit/application/AuditService.js'

describe('Unit: AuditService', () => {
  it('records audit', async () => {
    const svc = createAuditService({
      create: vi.fn().mockResolvedValue({ id: 'a1' }),
    } as any)
    const r = await svc.record({
      organizationId: 'o1',
      actorId: 'u1',
      action: 'CREATE',
      resourceType: 'COMPANY',
      resourceId: 'c1',
    })
    expect(r.id).toBe('a1')
  })
})
