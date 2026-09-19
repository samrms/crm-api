import { nanoid } from 'nanoid'
import { PostgresContactRepository } from '../infrastructure/PostgresContactRepository.js'
import { NotFoundError } from '../../../shared/errors/AppError.js'

const repo = new PostgresContactRepository()

export interface CreateContactInput {
  organizationId: string
  companyId?: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  title?: string
}

export async function createContact(input: CreateContactInput) {
  const id = `ct_${nanoid(12)}`
  return repo.create({
    id,
    organizationId: input.organizationId,
    companyId: input.companyId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    title: input.title,
  })
}

export async function getContact(id: string, organizationId: string) {
  const contact = await repo.findById(id, organizationId)
  if (!contact) {
    throw new NotFoundError('Contact', id)
  }
  return contact
}

export async function listContacts(
  organizationId: string,
  opts: { limit: number; after?: string },
) {
  return repo.list(organizationId, opts)
}
