import { describe, it, expect, vi } from 'vitest'
import { ContactService } from '../../../src/modules/crm/contacts/application/ContactService.js'
import type { ContactRepository } from '../../../src/modules/crm/contacts/infrastructure/PostgresContactRepository.js'

describe('Unit: ContactService', () => {
  it('create contact', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({ id: 'ct1', email: 'a@b' }),
    } as ContactRepository
    const svc = new ContactService(repo)
    const r = await svc.create({
      organizationId: 'o1',
      email: 'a@b',
      firstName: 'A',
      lastName: 'B',
    })
    expect(r.email).toBe('a@b')
  })
})
