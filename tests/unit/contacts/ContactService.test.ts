import { describe, it, expect, vi } from 'vitest'
import { createContactService } from '../../../src/modules/contacts/application/ContactService.js'

describe('Unit: ContactService', () => {
  it('create contact', async () => {
    const svc = createContactService({
      create: vi.fn().mockResolvedValue({ id: 'ct1', email: 'a@b' }),
    } as any)
    const r = await svc.create({
      id: 'ct1',
      organizationId: 'o1',
      email: 'a@b',
      firstName: 'A',
      lastName: 'B',
    })
    expect(r.email).toBe('a@b')
  })
})
