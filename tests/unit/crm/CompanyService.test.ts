import { describe, it, expect, vi } from 'vitest'
import { CompanyService } from '../../../src/modules/crm/companies/application/CompanyService.ts'
import { companyRepo, companyRow } from '../../fixtures/repos.ts'

describe('CompanyService', () => {
  it('generates a prefixed id on create', async () => {
    const repository = companyRepo()
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
      companyRepo({ findById: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(service.get('co_missing', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('throws NotFoundError when updating a missing company', async () => {
    const service = new CompanyService(
      companyRepo({ update: vi.fn().mockResolvedValue(undefined) }),
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
      companyRepo({ softDelete: vi.fn().mockResolvedValue(false) }),
    )
    await expect(service.remove('co_missing', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('passes pagination options through to the repository', async () => {
    const repository = companyRepo()
    await new CompanyService(repository).list('org_1', {
      limit: 10,
      name: 'Ac',
    })
    expect(repository.list).toHaveBeenCalledWith('org_1', {
      limit: 10,
      name: 'Ac',
    })
  })

  it('returns the stored row unchanged on get', async () => {
    const row = companyRow({ name: 'Stored Name' })
    const service = new CompanyService(
      companyRepo({ findById: vi.fn().mockResolvedValue(row) }),
    )
    expect(await service.get('co_1', 'org_1')).toBe(row)
  })
})
