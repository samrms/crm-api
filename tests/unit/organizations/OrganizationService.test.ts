import { describe, it, expect, vi } from 'vitest'
import { OrganizationService } from '../../../src/modules/organizations/application/OrganizationService.js'
import type { OrganizationRepository } from '../../../src/modules/organizations/infrastructure/PostgresOrganizationRepository.js'

describe('Unit: OrganizationService', () => {
  it('get returns org', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'T', slug: 't' }),
      findBySlug: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'o1', name: 'New', slug: 't' }),
    } as OrganizationRepository
    const svc = new OrganizationService(repo)
    expect((await svc.get('o1')).name).toBe('T')
  })
  it('update applies', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'T', slug: 't' }),
      findBySlug: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'o1', name: 'New', slug: 't' }),
    } as OrganizationRepository
    const svc = new OrganizationService(repo)
    expect((await svc.update({ organizationId: 'o1', name: 'New' })).name).toBe(
      'New',
    )
  })
})
