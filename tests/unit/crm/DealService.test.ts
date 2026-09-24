import { describe, it, expect, vi } from 'vitest'
import { DealService } from '../../../src/modules/crm/deals/application/DealService.ts'
import {
  companyRepo,
  contactRepo,
  dealRepo,
  dealRow,
  leadRepo,
} from '../../fixtures/repos.ts'

function service(dealOverrides: Parameters<typeof dealRepo>[0] = {}) {
  const repository = dealRepo(dealOverrides)
  return {
    repository,
    dealService: new DealService(
      repository,
      companyRepo(),
      contactRepo(),
      leadRepo(),
    ),
  }
}

describe('DealService', () => {
  it('advances to the next stage and passes the version for optimistic locking', async () => {
    const { repository, dealService } = service()
    const advanced = await dealService.advance('dl_1', 'org_1', 'QUALIFIED')
    expect(advanced.stage).toBe('QUALIFIED')
    expect(repository.updateStage).toHaveBeenCalledWith(
      'dl_1',
      'org_1',
      'QUALIFIED',
      1,
    )
  })

  it('rejects skipping stages', async () => {
    const { dealService } = service()
    await expect(
      dealService.advance('dl_1', 'org_1', 'NEGOTIATION'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('rejects advancing to the current stage with a conflict', async () => {
    const { dealService } = service({
      findById: vi.fn().mockResolvedValue(dealRow({ stage: 'PROPOSAL' })),
    })
    await expect(
      dealService.advance('dl_1', 'org_1', 'PROPOSAL'),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('only wins from negotiation', async () => {
    const { dealService: notReady } = service()
    await expect(notReady.win('dl_1', 'org_1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })

    const { dealService: ready } = service({
      findById: vi.fn().mockResolvedValue(dealRow({ stage: 'NEGOTIATION' })),
      updateStage: vi.fn().mockResolvedValue(dealRow({ stage: 'WON' })),
    })
    expect((await ready.win('dl_1', 'org_1')).stage).toBe('WON')
  })

  it('surfaces optimistic lock failures as 409 conflicts', async () => {
    const { dealService: locking } = service({
      update: vi.fn().mockResolvedValue(undefined),
    })
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

    const { dealService: stageRace } = service({
      findById: vi.fn().mockResolvedValue(dealRow({ stage: 'NEGOTIATION' })),
      updateStage: vi.fn().mockResolvedValue(undefined),
    })
    await expect(stageRace.win('dl_1', 'org_1')).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
    })
  })

  it('throws NotFoundError for unknown deals', async () => {
    const { dealService } = service({
      findById: vi.fn().mockResolvedValue(undefined),
      softDelete: vi.fn().mockResolvedValue(false),
    })
    await expect(dealService.get('dl_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(dealService.remove('dl_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('rejects referenced ids that belong to another organization', async () => {
    for (const field of ['companyId', 'contactId', 'leadId'] as const) {
      const dealService = new DealService(
        dealRepo(),
        companyRepo({ findById: vi.fn().mockResolvedValue(undefined) }),
        contactRepo({ findById: vi.fn().mockResolvedValue(undefined) }),
        leadRepo({ findById: vi.fn().mockResolvedValue(undefined) }),
      )
      await expect(
        dealService.create({
          organizationId: 'org_1',
          title: 'Cross-tenant deal',
          [field]: 'id_from_another_tenant',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
  })

  it('accepts references that belong to the same organization', async () => {
    const { dealService } = service()
    const created = await dealService.create({
      organizationId: 'org_1',
      title: 'Legit deal',
      companyId: 'co_1',
      contactId: 'ct_1',
      leadId: 'ld_1',
    })
    expect(created.id).toMatch(/^dl_/)
  })
})
