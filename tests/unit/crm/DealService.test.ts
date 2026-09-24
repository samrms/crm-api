import { describe, it, expect, vi } from 'vitest'
import { DealService } from '../../../src/modules/crm/deals/application/DealService.ts'
import { dealRepo, dealRow } from '../../fixtures/repos.ts'

describe('DealService', () => {
  it('advances to the next stage and passes the version for optimistic locking', async () => {
    const repository = dealRepo()
    const advanced = await new DealService(repository).advance(
      'dl_1',
      'org_1',
      'QUALIFIED',
    )
    expect(advanced.stage).toBe('QUALIFIED')
    expect(repository.updateStage).toHaveBeenCalledWith(
      'dl_1',
      'org_1',
      'QUALIFIED',
      1,
    )
  })

  it('rejects skipping stages', async () => {
    const service = new DealService(dealRepo())
    await expect(
      service.advance('dl_1', 'org_1', 'NEGOTIATION'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('rejects advancing to the current stage with a conflict', async () => {
    const service = new DealService(
      dealRepo({
        findById: vi.fn().mockResolvedValue(dealRow({ stage: 'PROPOSAL' })),
      }),
    )
    await expect(
      service.advance('dl_1', 'org_1', 'PROPOSAL'),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('only wins from negotiation', async () => {
    const notReady = new DealService(dealRepo())
    await expect(notReady.win('dl_1', 'org_1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })

    const ready = new DealService(
      dealRepo({
        findById: vi.fn().mockResolvedValue(dealRow({ stage: 'NEGOTIATION' })),
        updateStage: vi.fn().mockResolvedValue(dealRow({ stage: 'WON' })),
      }),
    )
    expect((await ready.win('dl_1', 'org_1')).stage).toBe('WON')
  })

  it('surfaces optimistic lock failures as 409 conflicts', async () => {
    const locking = new DealService(
      dealRepo({ update: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(
      locking.update({
        dealId: 'dl_1',
        organizationId: 'org_1',
        title: 'Renamed',
      }),
    ).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
      statusCode: 409,
    })

    const stageRace = new DealService(
      dealRepo({
        findById: vi.fn().mockResolvedValue(dealRow({ stage: 'NEGOTIATION' })),
        updateStage: vi.fn().mockResolvedValue(undefined),
      }),
    )
    await expect(stageRace.win('dl_1', 'org_1')).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
    })
  })

  it('throws NotFoundError for unknown deals', async () => {
    const service = new DealService(
      dealRepo({
        findById: vi.fn().mockResolvedValue(undefined),
        softDelete: vi.fn().mockResolvedValue(false),
      }),
    )
    await expect(service.get('dl_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(service.remove('dl_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
