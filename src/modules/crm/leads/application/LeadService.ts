import { newId } from '@/shared/utils/id.js'
import type { LeadRepository } from '@/modules/crm/leads/infrastructure/PostgresLeadRepository.js'
import { findTransitionPath } from '@/modules/crm/leads/domain/LeadState.js'
import {
  NotFoundError,
  ValidationError,
  OptimisticLockError,
} from '@/shared/errors/AppError.js'

export interface CreateLeadInput {
  organizationId: string
  email: string
  firstName: string
  lastName: string
  company?: string
  source?: string
  notes?: string
}

export interface UpdateLeadInput {
  organizationId: string
  leadId: string
  email?: string
  firstName?: string
  lastName?: string
  company?: string
  source?: string
  notes?: string
}

export class LeadService {
  constructor(private readonly repo: LeadRepository) {}
  async create(input: CreateLeadInput) {
    return this.repo.create({
      id: newId('ld'),
      organizationId: input.organizationId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company,
      source: input.source,
      notes: input.notes,
    })
  }

  async update(input: UpdateLeadInput) {
    const lead = await this.repo.findById(input.leadId, input.organizationId)
    if (!lead) throw new NotFoundError('Lead', input.leadId)

    const result = await this.repo.update(
      input.leadId,
      input.organizationId,
      {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        company: input.company,
        source: input.source,
        notes: input.notes,
      },
      lead.version,
    )
    if (!result) {
      throw new OptimisticLockError('Lead')
    }
    return result
  }

  async get(id: string, organizationId: string) {
    const lead = await this.repo.findById(id, organizationId)
    if (!lead) throw new NotFoundError('Lead', id)
    return lead
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; status?: string },
  ) {
    return this.repo.list(organizationId, opts)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, organizationId)
    if (!deleted) throw new NotFoundError('Lead', id)
  }

  async qualify(id: string, organizationId: string) {
    const lead = await this.repo.findById(id, organizationId)
    if (!lead) throw new NotFoundError('Lead', id)

    const path = findTransitionPath(lead.status, 'QUALIFIED')

    if (!path) {
      throw new ValidationError(
        `Lead in status '${lead.status}' cannot be qualified`,
      )
    }

    if (path.length === 0) {
      return lead
    }

    let currentVersion = lead.version
    for (const targetStatus of path) {
      const row = await this.repo.updateStatus(
        id,
        organizationId,
        targetStatus,
        currentVersion,
      )
      if (!row) {
        throw new OptimisticLockError('Lead')
      }
      currentVersion = currentVersion + 1
    }

    const updatedLead = await this.repo.findById(id, organizationId)
    if (!updatedLead) throw new NotFoundError('Lead', id)
    return updatedLead
  }
}
