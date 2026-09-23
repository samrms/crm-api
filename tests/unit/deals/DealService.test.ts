import { describe, it, expect, vi } from 'vitest'
import { DealService } from '../../../src/modules/crm/deals/application/DealService.js'
import type { DealRepository } from '../../../src/modules/crm/deals/infrastructure/PostgresDealRepository.js'

describe('Unit: DealService', () => {
  it('advance stage', async () => {
    const repo = {
      findById: vi
        .fn()
        .mockResolvedValue({ id: 'd1', stage: 'NEW', version: 1 }),
      updateStage: vi.fn().mockResolvedValue({ id: 'd1', stage: 'QUALIFIED' }),
      findById: vi
        .fn()
        .mockResolvedValue({ id: 'd1', stage: 'NEW', version: 1 }),
      update: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
    } as DealRepository
    const svc = new DealService(repo)
    const res = await svc.advance('d1', 'org', 'QUALIFIED')
    expect(res.stage).toBe('QUALIFIED')
  })
})
