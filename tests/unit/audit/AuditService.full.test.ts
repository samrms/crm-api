import { describe, it, expect, vi } from 'vitest'
import { AuditService } from '../../../src/modules/audit/application/AuditService.js'

describe('Unit: AuditService (all aspects)', () => {
  const mockRepo = (overrides?: object) =>
    ({
      findById: vi.fn().mockResolvedValue({
        id: 'a1',
        action: 'CREATE',
        resourceType: 'COMPANY',
        organization_id: 'o1',
      }),
      list: vi.fn().mockResolvedValue([{ id: 'a1', action: 'CREATE' }]),
      create: vi.fn().mockImplementation(async (d) => d),
      ...overrides,
    }) as any

  it('getAuditEvent returns event', async () => {
    const svc = new AuditService(mockRepo())
    const r = await svc.getAuditEvent('a1', 'o1')
    expect(r.id).toBe('a1')
  })

  it('getAuditEvent throws NotFound', async () => {
    const svc = new AuditService(
      mockRepo({ findById: vi.fn().mockResolvedValue(null) }),
    )
    await expect(svc.getAuditEvent('bad', 'o1')).rejects.toThrow('Audit event')
  })

  it('listAuditEvents paginates', async () => {
    const svc = new AuditService(mockRepo())
    const r = await svc.listAuditEvents('o1', { limit: 10 })
    expect(Array.isArray(r)).toBe(true)
  })

  it('createAuditEvent generates id and saves', async () => {
    const repo = mockRepo()
    const svc = new AuditService(repo)
    const r = await svc.createAuditEvent({
      organizationId: 'o1',
      actorId: 'u1',
      action: 'UPDATE',
      resourceType: 'DEAL',
    })
    expect(r.id).toMatch(/^aud_/)
    expect(repo.create).toHaveBeenCalled()
  })

  it('createAuditEvent includes optional metadata and requestId', async () => {
    const repo = mockRepo()
    const svc = new AuditService(repo)
    await svc.createAuditEvent({
      organizationId: 'o1',
      actorId: 'u1',
      action: 'CREATE',
      resourceType: 'COMPANY',
      resourceId: 'c1',
      requestId: 'req_1',
      metadata: { key: 'val' },
    })
    const call = repo.create.mock.calls[0][0]
    expect(call.metadata).toEqual({ key: 'val' })
    expect(call.requestId).toBe('req_1')
  })
})
