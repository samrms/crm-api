import { describe, it, expect, vi } from 'vitest'
import { ContactService } from '../../../src/modules/crm/contacts/application/ContactService.ts'
import { contactRepo } from '../../fixtures/repos.ts'

describe('ContactService', () => {
  it('creates a contact with a generated id', async () => {
    const repository = contactRepo()
    const created = await new ContactService(repository).create({
      organizationId: 'org_1',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
    })
    expect(created.id).toMatch(/^ct_/)
  })

  it('throws NotFoundError for missing rows on get/update/remove', async () => {
    const service = new ContactService(
      contactRepo({
        findById: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        softDelete: vi.fn().mockResolvedValue(false),
      }),
    )
    await expect(service.get('ct_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      service.update({
        contactId: 'ct_x',
        organizationId: 'org_1',
        email: 'a@b.c',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.remove('ct_x', 'org_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
