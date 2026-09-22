import { nanoid } from 'nanoid'
import type { OrganizationRepository } from '@/modules/organizations/infrastructure/PostgresOrganizationRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface UpdateOrganizationInput {
  organizationId: string
  name?: string
  slug?: string
}

export class OrganizationService {
  constructor(private readonly repo: OrganizationRepository) {}
  async get(id: string) {
    const org = await this.repo.findById(id)
    if (!org) throw new NotFoundError('Organization', id)
    return org
  }

  async update(input: UpdateOrganizationInput) {
    const org = await this.repo.findById(input.organizationId)
    if (!org) throw new NotFoundError('Organization', input.organizationId)

    let slug = input.slug ?? org.slug
    if (input.slug && input.slug !== org.slug) {
      const existing = await this.repo.findBySlug(input.slug)
      if (existing && existing.id !== input.organizationId) {
        slug = `${input.slug}-${nanoid(6)}`
      }
    }

    const result = await this.repo.update(input.organizationId, {
      name: input.name,
      slug,
    })
    if (!result) throw new NotFoundError('Organization', input.organizationId)
    return result
  }
}
