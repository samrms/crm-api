import { nanoid } from 'nanoid'
import { PostgresCompanyRepository } from '../infrastructure/PostgresCompanyRepository.js'
import { NotFoundError } from '../../../shared/errors/AppError.js'

const repo = new PostgresCompanyRepository()

export interface CreateCompanyInput {
  organizationId: string
  name: string
  domain?: string
  industry?: string
  website?: string
}

export interface UpdateCompanyInput {
  organizationId: string
  companyId: string
  name?: string
  domain?: string
  industry?: string
  website?: string
}

export async function createCompany(input: CreateCompanyInput) {
  const id = `co_${nanoid(12)}`
  return repo.create({
    id,
    organizationId: input.organizationId,
    name: input.name,
    domain: input.domain,
    industry: input.industry,
    website: input.website,
  })
}

export async function updateCompany(input: UpdateCompanyInput) {
  const result = await repo.update(input.companyId, input.organizationId, {
    name: input.name,
    domain: input.domain,
    industry: input.industry,
    website: input.website,
  })
  if (!result) {
    throw new NotFoundError('Company', input.companyId)
  }
  return result
}

export async function getCompany(id: string, organizationId: string) {
  const company = await repo.findById(id, organizationId)
  if (!company) {
    throw new NotFoundError('Company', id)
  }
  return company
}

export async function listCompanies(
  organizationId: string,
  opts: { limit: number; after?: string },
) {
  return repo.list(organizationId, opts)
}
