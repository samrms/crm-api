import { nanoid } from 'nanoid'
import type { CompanyRepository } from '@/modules/crm/companies/infrastructure/PostgresCompanyRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface CreateCompanyInput {
  organizationId: string
  name: string
  domain?: string
  industry?: string
  size?: string
  website?: string
}

export interface UpdateCompanyInput {
  organizationId: string
  companyId: string
  name?: string
  domain?: string
  industry?: string
  size?: string
  website?: string
}

export class CompanyService {
  constructor(private readonly repo: CompanyRepository) {}

  async create(input: CreateCompanyInput) {
    const id = `co_${nanoid(12)}`
    return this.repo.create({
      id,
      organizationId: input.organizationId,
      name: input.name,
      domain: input.domain,
      industry: input.industry,
      size: input.size,
      website: input.website,
    })
  }

  async update(input: UpdateCompanyInput) {
    const result = await this.repo.update(
      input.companyId,
      input.organizationId,
      {
        name: input.name,
        domain: input.domain,
        industry: input.industry,
        size: input.size,
        website: input.website,
      },
    )
    if (!result) {
      throw new NotFoundError('Company', input.companyId)
    }
    return result
  }

  async get(id: string, organizationId: string) {
    const company = await this.repo.findById(id, organizationId)
    if (!company) {
      throw new NotFoundError('Company', id)
    }
    return company
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; name?: string },
  ) {
    return this.repo.list(organizationId, opts)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, organizationId)
    if (!deleted) {
      throw new NotFoundError('Company', id)
    }
  }
}
