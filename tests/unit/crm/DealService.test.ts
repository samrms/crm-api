import { describe, it, expect, vi } from 'vitest'
import { DealService } from '../../../src/modules/crm/deals/application/DealService.ts'
import type {
  DealRepository,
  DealRow,
} from '../../../src/modules/crm/deals/infrastructure/PostgresDealRepository.ts'

const deal = (overrides: Partial<DealRow> = {}): DealRow => ({
  id: 'dl_1',
  organization_id: 'org_1',
  companyId: null,
  contactId: null,
  leadId: null,
  title: 'Big Deal',
  value: 1_000,
  currency: 'USD',
  stage: 'NEW',
  expectedCloseDate: null,
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  version: 1,
  ...overrides,
})

function repo(overrides: Partial<DealRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(deal()),
    list: vi.fn().mockResolvedValue([deal()]),
    create: vi.fn().mockImplementation((data) => deal(data as never)),
    update: vi.fn().mockResolvedValue(deal({ title: 'Renamed' })),
    updateStage: vi.fn().mockResolvedValue(deal({ stage: 'QUALIFIED' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } satisfies DealRepository
}

describe('DealService', () => {
  it('advances to the next stage and passes the version for optimistic locking', async () => {
    const repository = repo()
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
    const service = new DealService(
      repo({ findById: vi.fn().mockResolvedValue(deal()) }),
    )
    await expect(
      service.advance('dl_1', 'org_1', 'NEGOTIATION'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('rejects advancing to the current stage with a conflict', async () => {
    const service = new DealService(
      repo({
        findById: vi.fn().mockResolvedValue(deal({ stage: 'PROPOSAL' })),
      }),
    )
    await expect(
      service.advance('dl_1', 'org_1', 'PROPOSAL'),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('only wins from negotiation', async () => {
    const notReady = new DealService(repo())
    await expect(notReady.win('dl_1', 'org_1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })

    const ready = new DealService(
      repo({
        findById: vi.fn().mockResolvedValue(deal({ stage: 'NEGOTIATION' })),
        updateStage: vi.fn().mockResolvedValue(deal({ stage: 'WON' })),
      }),
    )
    const won = await ready.win('dl_1', 'org_1')
    expect(won.stage).toBe('WON')
  })

  it('surfaces optimistic lock failures as 409 conflicts', async () => {
    const locking = new DealService(
      repo({ update: vi.fn().mockResolvedValue(undefined) }),
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
      repo({
        findById: vi.fn().mockResolvedValue(deal({ stage: 'NEGOTIATION' })),
        updateStage: vi.fn().mockResolvedValue(undefined),
      }),
    )
    await expect(stageRace.win('dl_1', 'org_1')).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
    })
  })

  it('throws NotFoundError for unknown deals', async () => {
    const service = new DealService(
      repo({
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
