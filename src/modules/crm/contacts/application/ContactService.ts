import { newId } from '@/shared/utils/id.js'
import type { ContactRepository } from '@/modules/crm/contacts/infrastructure/PostgresContactRepository.js'
import type { CompanyRepository } from '@/modules/crm/companies/infrastructure/PostgresCompanyRepository.js'
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
  constructor(
    private readonly repo: ContactRepository,
    private readonly companyRepo: CompanyRepository,
  ) {}

  async create(input: CreateContactInput) {
    await this.assertCompanyInOrg(input.companyId, input.organizationId)
    const id = newId('ct')
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
    await this.assertCompanyInOrg(input.companyId, input.organizationId)
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

  /**
   * A company id from another organization must be indistinguishable from one
   * that does not exist, so this throws NotFoundError like every other miss.
   */
  private async assertCompanyInOrg(
    companyId: string | undefined,
    organizationId: string,
  ): Promise<void> {
    if (!companyId) return
    const company = await this.companyRepo.findById(companyId, organizationId)
    if (!company) throw new NotFoundError('Company', companyId)
  }
}
