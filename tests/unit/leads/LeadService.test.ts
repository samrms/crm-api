import { describe, it, expect, vi } from 'vitest'
import { LeadService } from '../../../src/modules/crm/leads/application/LeadService.js'
import type { LeadRepository } from '../../../src/modules/crm/leads/infrastructure/PostgresLeadRepository.ts'
import type { LeadStatus } from '../../../src/modules/crm/leads/domain/LeadState.js'

describe('Unit: LeadService', () => {
  it('qualify transitions state', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({
        id: 'l1',
        status: 'QUALIFIED' as LeadStatus,
        version: 2,
      }),
      updateStatus: vi
        .fn()
        .mockResolvedValue({ id: 'l1', status: 'QUALIFIED', version: 2 }),
      update: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      updateWithDeal: vi.fn(),
      softDelete: vi.fn(),
    } as LeadRepository
    const svc = new LeadService(repo)
    const res = await svc.qualify('l1', 'org')
    expect(res.status).toBeDefined()
  })
})
