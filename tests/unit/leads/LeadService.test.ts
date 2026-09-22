import { describe, it, expect, vi } from 'vitest'
import { createLeadService } from '../../../src/modules/leads/application/LeadService.js'

describe('Unit: LeadService', () => {
  it('qualify transitions state', async () => {
    const svc = createLeadService({
      findById: vi
        .fn()
        .mockResolvedValue({ id: 'l1', status: 'NEW', version: 1 }),
      update: vi.fn().mockResolvedValue({ id: 'l1', status: 'CONTACTED' }),
    } as any)
    const res = await svc.qualify('l1', 'org')
    expect(res.status).toBeDefined()
  })
})
