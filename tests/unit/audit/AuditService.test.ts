import { describe, it, expect, vi } from 'vitest'
import { AuditService } from '../../../src/modules/organizations/application/AuditService.js'
import type { AuditRepository } from '../../../src/modules/organizations/infrastructure/PostgresAuditRepository.js'

describe('Unit: AuditService', () => {
  it('records audit', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({ id: 'a1' }),
    } as AuditRepository
    const svc = new AuditService(repo)
    const r = await svc.createAuditEvent({
      organizationId: 'o1',
      actorId: 'u1',
      action: 'CREATE',
      resourceType: 'COMPANY',
      resourceId: 'c1',
    })
    expect(r.id).toBe('a1')
  })
})
