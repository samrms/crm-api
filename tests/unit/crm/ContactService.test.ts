import { describe, it, expect, vi } from 'vitest'
import { ContactService } from '../../../src/modules/crm/contacts/application/ContactService.ts'
import type {
  ContactRepository,
  ContactRow,
} from '../../../src/modules/crm/contacts/infrastructure/PostgresContactRepository.ts'

const contact = (overrides: Partial<ContactRow> = {}): ContactRow => ({
  id: 'ct_1',
  organization_id: 'org_1',
  company_id: null,
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: null,
  title: null,
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
})

function repo(overrides: Partial<ContactRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(contact()),
    list: vi.fn().mockResolvedValue([contact()]),
    create: vi.fn().mockImplementation((data) => contact(data as never)),
    update: vi.fn().mockResolvedValue(contact({ firstName: 'Jane' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } satisfies ContactRepository
}

describe('ContactService', () => {
  it('creates a contact with a generated id', async () => {
    const repository = repo()
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
      repo({
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
