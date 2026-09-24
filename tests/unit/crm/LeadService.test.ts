import { describe, it, expect, vi } from 'vitest'
import { LeadService } from '../../../src/modules/crm/leads/application/LeadService.ts'
import type {
  LeadRepository,
  LeadRow,
} from '../../../src/modules/crm/leads/infrastructure/PostgresLeadRepository.ts'

const lead = (overrides: Partial<LeadRow> = {}): LeadRow => ({
  id: 'ld_1',
  organization_id: 'org_1',
  companyId: null,
  contactId: null,
  email: 'lead@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  company: null,
  source: null,
  status: 'NEW',
  convertedDealId: null,
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  version: 1,
  ...overrides,
})

function repo(overrides: Partial<LeadRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(lead()),
    list: vi.fn().mockResolvedValue([lead()]),
    create: vi.fn().mockImplementation((data) => lead(data as never)),
    update: vi.fn().mockResolvedValue(lead({ firstName: 'Janet' })),
    updateStatus: vi.fn().mockResolvedValue(lead({ status: 'CONTACTED' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } satisfies LeadRepository
}

describe('LeadService', () => {
  it('walks a new lead through contacted to qualified', async () => {
    const repository = repo({
      updateStatus: vi
        .fn()
        .mockResolvedValueOnce(lead({ status: 'CONTACTED', version: 2 }))
        .mockResolvedValueOnce(lead({ status: 'QUALIFIED', version: 3 })),
      findById: vi
        .fn()
        .mockResolvedValueOnce(lead({ status: 'NEW', version: 1 }))
        .mockResolvedValueOnce(lead({ status: 'QUALIFIED', version: 3 })),
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
    const repository = repo({
      findById: vi.fn().mockResolvedValue(lead({ status: 'QUALIFIED' })),
    })
    const result = await new LeadService(repository).qualify('ld_1', 'org_1')
    expect(result.status).toBe('QUALIFIED')
    expect(repository.updateStatus).not.toHaveBeenCalled()
  })

  it('rejects qualifying terminal leads', async () => {
    const service = new LeadService(
      repo({
        findById: vi.fn().mockResolvedValue(lead({ status: 'DISQUALIFIED' })),
      }),
    )
    await expect(service.qualify('ld_1', 'org_1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('propagates optimistic lock failures', async () => {
    const service = new LeadService(
      repo({
        findById: vi.fn().mockResolvedValue(lead({ status: 'NEW' })),
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
      repo({ findById: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(service.get('ld_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
