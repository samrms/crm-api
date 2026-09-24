import { describe, it, expect, vi } from 'vitest'
import { LeadService } from '../../../src/modules/crm/leads/application/LeadService.ts'
import { leadRepo, leadRow } from '../../fixtures/repos.ts'

describe('LeadService', () => {
  it('walks a new lead through contacted to qualified', async () => {
    const repository = leadRepo({
      updateStatus: vi
        .fn()
        .mockResolvedValueOnce(leadRow({ status: 'CONTACTED', version: 2 }))
        .mockResolvedValueOnce(leadRow({ status: 'QUALIFIED', version: 3 })),
      findById: vi
        .fn()
        .mockResolvedValueOnce(leadRow({ status: 'NEW', version: 1 }))
        .mockResolvedValueOnce(leadRow({ status: 'QUALIFIED', version: 3 })),
    })
    const qualified = await new LeadService(repository).qualify('ld_1', 'org_1')
    expect(qualified.status).toBe('QUALIFIED')
    expect(repository.updateStatus).toHaveBeenNthCalledWith(
      1,
      'ld_1',
      'org_1',
      'CONTACTED',
      1,
    )
    expect(repository.updateStatus).toHaveBeenNthCalledWith(
      2,
      'ld_1',
      'org_1',
      'QUALIFIED',
      2,
    )
  })

  it('is a no-op for an already qualified lead', async () => {
    const repository = leadRepo({
      findById: vi.fn().mockResolvedValue(leadRow({ status: 'QUALIFIED' })),
    })
    const result = await new LeadService(repository).qualify('ld_1', 'org_1')
    expect(result.status).toBe('QUALIFIED')
    expect(repository.updateStatus).not.toHaveBeenCalled()
  })

  it('rejects qualifying terminal leads', async () => {
    const service = new LeadService(
      leadRepo({
        findById: vi.fn().mockResolvedValue(leadRow({ status: 'DISQUALIFIED' })),
      }),
    )
    await expect(service.qualify('ld_1', 'org_1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('propagates optimistic lock failures', async () => {
    const service = new LeadService(
      leadRepo({
        findById: vi.fn().mockResolvedValue(leadRow({ status: 'NEW' })),
        updateStatus: vi.fn().mockResolvedValue(undefined),
      }),
    )
    await expect(service.qualify('ld_1', 'org_1')).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
      statusCode: 409,
    })
  })

  it('throws NotFoundError for unknown leads', async () => {
    const service = new LeadService(
      leadRepo({ findById: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(service.get('ld_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
