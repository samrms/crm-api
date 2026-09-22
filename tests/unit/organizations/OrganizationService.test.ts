/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { createOrganizationService } from '../../../src/modules/organizations/application/OrganizationService.js'

describe('Unit: OrganizationService', () => {
  it('exports factory', () => {
    expect(typeof createOrganizationService).toBe('function')
  })

  it('get returns org', async () => {
    const svc = createOrganizationService({
      findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'T', slug: 't' }),
      findBySlug: vi.fn(),
      update: vi.fn(),
    } as any)
    const r = await svc.get('o1')
    expect(r.name).toBe('T')
  })

  it('update applies', async () => {
    const svc = createOrganizationService({
      findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'T', slug: 't' }),
      findBySlug: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'o1', name: 'New', slug: 't' }),
    } as any)
    const r = await svc.update({ organizationId: 'o1', name: 'New' })
    expect(r.name).toBe('New')
  })

  it('update changes slug with uniqueness guard', async () => {
    const svc = createOrganizationService({
      findById: vi.fn().mockResolvedValue({ id: 'o1', name: 'T', slug: 't' }),
      findBySlug: vi.fn().mockResolvedValue({ id: 'o2', slug: 'taken' }),
      update: vi
        .fn()
        .mockImplementation(async (_id, data) => ({ id: 'o1', ...data })),
    } as any)
    const r = await svc.update({ organizationId: 'o1', slug: 'taken' })
    expect(r.slug).toMatch(/^taken-/)
  })
})
