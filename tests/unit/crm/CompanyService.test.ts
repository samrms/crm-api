import { describe, it, expect, vi } from 'vitest'
import { CompanyService } from '../../../src/modules/crm/companies/application/CompanyService.ts'
import type {
  CompanyRepository,
  CompanyRow,
} from '../../../src/modules/crm/companies/infrastructure/PostgresCompanyRepository.ts'

const company = (overrides: Partial<CompanyRow> = {}): CompanyRow => ({
  id: 'co_1',
  organization_id: 'org_1',
  name: 'Acme',
  domain: null,
  industry: null,
  size: null,
  website: null,
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
})

function repo(overrides: Partial<CompanyRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(company()),
    findByName: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([company()]),
    create: vi.fn().mockImplementation((data) => company(data as never)),
    update: vi.fn().mockResolvedValue(company({ name: 'Updated' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } satisfies CompanyRepository
}

describe('CompanyService', () => {
  it('generates a prefixed id on create', async () => {
    const repository = repo()
    const created = await new CompanyService(repository).create({
      organizationId: 'org_1',
      name: 'Acme',
    })
    expect(created.id).toMatch(/^co_/)
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_1', name: 'Acme' }),
    )
  })

  it('throws NotFoundError when reading a missing company', async () => {
    const service = new CompanyService(
      repo({ findById: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(service.get('co_missing', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('throws NotFoundError when updating a missing company', async () => {
    const service = new CompanyService(
      repo({ update: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(
      service.update({
        companyId: 'co_missing',
        organizationId: 'org_1',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws NotFoundError when removing a missing company', async () => {
    const service = new CompanyService(
      repo({ softDelete: vi.fn().mockResolvedValue(false) }),
    )
    await expect(service.remove('co_missing', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('passes pagination options through to the repository', async () => {
    const repository = repo()
    await new CompanyService(repository).list('org_1', {
      limit: 10,
      name: 'Ac',
    })
    expect(repository.list).toHaveBeenCalledWith('org_1', {
      limit: 10,
      name: 'Ac',
    })
  })
})
