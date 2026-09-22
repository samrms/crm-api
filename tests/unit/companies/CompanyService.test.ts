import { describe, it, expect, vi } from 'vitest'
import { CompanyService } from '../../../src/modules/companies/application/CompanyService.js'
import type { CompanyRepository } from '../../../src/modules/companies/infrastructure/PostgresCompanyRepository.js'

describe('Unit: CompanyService', () => {
  it('create and find', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({ id: 'c1', name: 'Co' }),
      findById: vi.fn().mockResolvedValue({ id: 'c1' }),
    } as CompanyRepository
    const svc = new CompanyService(repo)
    expect((await svc.create({ organizationId: 'o1', name: 'Co' })).name).toBe(
      'Co',
    )
  })
})
