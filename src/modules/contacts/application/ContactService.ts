import { nanoid } from 'nanoid'
import type { ContactRepository } from '@/modules/contacts/infrastructure/PostgresContactRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface CreateContactInput {
  organizationId: string
  companyId?: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  title?: string
  notes?: string
}

export interface UpdateContactInput {
  organizationId: string
  contactId: string
  companyId?: string
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  title?: string
  notes?: string
}

export class ContactService {
  constructor(private readonly repo: ContactRepository) {}
  async create(input: CreateContactInput) {
    const id = `ct_${nanoid(12)}`
    return this.repo.create({
      id,
      organizationId: input.organizationId,
      companyId: input.companyId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      title: input.title,
      notes: input.notes,
    })
  }

  async update(input: UpdateContactInput) {
    const result = await this.repo.update(
      input.contactId,
      input.organizationId,
      {
        companyId: input.companyId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        title: input.title,
        notes: input.notes,
      },
    )
    if (!result) {
      throw new NotFoundError('Contact', input.contactId)
    }
    return result
  }

  async get(id: string, organizationId: string) {
    const contact = await this.repo.findById(id, organizationId)
    if (!contact) {
      throw new NotFoundError('Contact', id)
    }
    return contact
  }

  async list(organizationId: string, opts: { limit: number; after?: string }) {
    return this.repo.list(organizationId, opts)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, organizationId)
    if (!deleted) {
      throw new NotFoundError('Contact', id)
    }
  }
}
