import { describe, it, expect, vi } from 'vitest'
import { createCompanyService } from '../../../src/modules/companies/application/CompanyService.js'

describe('Unit: CompanyService', () => {
  it('create and find', async () => {
    const svc = createCompanyService({
      create: vi.fn().mockResolvedValue({ id: 'c1', name: 'Co' }),
      findById: vi.fn().mockResolvedValue({ id: 'c1' }),
    } as any)
    expect(
      (await svc.create({ id: 'c1', organizationId: 'o1', name: 'Co' })).name,
    ).toBe('Co')
  })
})
