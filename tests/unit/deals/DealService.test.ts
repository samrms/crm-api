import { describe, it, expect, vi } from 'vitest'
import { createDealService } from '../../../src/modules/deals/application/DealService.js'

describe('Unit: DealService', () => {
  it('advance stage', async () => {
    const svc = createDealService({
      findById: vi
        .fn()
        .mockResolvedValue({ id: 'd1', stage: 'NEW', version: 1 }),
      update: vi.fn().mockResolvedValue({ id: 'd1', stage: 'QUALIFIED' }),
    } as any)
    const res = await svc.advance('d1', 'org', 'QUALIFIED')
    expect(res.stage).toBe('QUALIFIED')
  })
})
