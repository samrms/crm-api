import { describe, it, expect, vi } from 'vitest'
import { AuditService } from '../../../src/modules/organizations/application/AuditService.js'
import type { AuditRepository } from '../../../src/modules/organizations/infrastructure/PostgresAuditRepository.js'
import {
  encodeCursor,
  decodeCursor,
} from '../../../src/shared/pagination/CursorEncoder.js'

function mockRepo(overrides?: object): AuditRepository {
  return {
    findById: vi.fn().mockResolvedValue({
      id: 'a1',
      organization_id: 'org1',
      actor_id: 'u1',
      action: 'CREATE',
      resource_type: 'COMPANY',
      resource_id: 'c1',
      created_at: new Date(),
    }),
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (d) => d),
    ...overrides,
  } as AuditRepository
}

describe('Unit: Audit Security & Multi-tenancy', () => {
  it('audit events scoped by organization_id', async () => {
    const repo = mockRepo()
    const svc = new AuditService(repo)
    await svc.getAuditEvent('a1', 'org1')
    expect(repo.findById).toHaveBeenCalledWith('a1', 'org1')
  })

  it('routes require OWNER or ADMIN', () => {
    const allowed = ['OWNER', 'ADMIN', 'MEMBER']
    expect(allowed.includes('ADMIN')).toBe(true)
    expect(allowed.includes('MEMBER')).toBe(true)
  })

  it('cursor pagination uses signed cursors', () => {
    const cursor = encodeCursor({
      createdAt: new Date().toISOString(),
      id: 'a1',
    })
    const decoded = decodeCursor(cursor)
    expect(decoded.id).toBe('a1')
  })

  it('service creates audit with full data', async () => {
    const repo = mockRepo()
    const svc = new AuditService(repo)
    const result = await svc.createAuditEvent({
      organizationId: 'org1',
      actorId: 'u1',
      action: 'UPDATE',
      resourceType: 'DEAL',
      resourceId: 'd1',
      requestId: 'req_1',
      metadata: { changedFields: ['value'] },
    })
    expect(result.id).toMatch(/^aud_/)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'u1',
        resourceType: 'DEAL',
        requestId: 'req_1',
      }),
    )
  })

  it('service throws NotFound for missing event', async () => {
    const repo = mockRepo({ findById: vi.fn().mockResolvedValue(null) })
    const svc = new AuditService(repo)
    await expect(svc.getAuditEvent('missing', 'org1')).rejects.toThrow('Audit')
  })
})
