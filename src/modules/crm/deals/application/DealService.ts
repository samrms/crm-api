import { newId } from '@/shared/utils/id.js'
import type { DealRepository } from '@/modules/crm/deals/infrastructure/PostgresDealRepository.js'
import { canTransitionDeal } from '@/modules/crm/deals/domain/DealState.js'
import {
  NotFoundError,
  ValidationError,
  OptimisticLockError,
  ConflictError,
} from '@/shared/errors/AppError.js'

export interface CreateDealInput {
  organizationId: string
  title: string
  companyId?: string
  contactId?: string
  leadId?: string
  value?: number
  currency?: string
  notes?: string
}

export interface UpdateDealInput {
  organizationId: string
  dealId: string
  title?: string
  companyId?: string
  contactId?: string
  value?: number
  currency?: string
  notes?: string
}

export class DealService {
  constructor(private readonly repo: DealRepository) {}
  async create(input: CreateDealInput) {
    return this.repo.create({
      id: newId('dl'),
      organizationId: input.organizationId,
      title: input.title,
      companyId: input.companyId,
      contactId: input.contactId,
      leadId: input.leadId,
      value: input.value,
      currency: input.currency,
      notes: input.notes,
    })
  }

  async update(input: UpdateDealInput) {
    const deal = await this.repo.findById(input.dealId, input.organizationId)
    if (!deal) throw new NotFoundError('Deal', input.dealId)

    const result = await this.repo.update(
      input.dealId,
      input.organizationId,
      {
        title: input.title,
        companyId: input.companyId,
        contactId: input.contactId,
        value: input.value,
        currency: input.currency,
        notes: input.notes,
      },
      deal.version,
    )
    if (!result) {
      throw new OptimisticLockError('Deal')
    }
    return result
  }

  async get(id: string, organizationId: string) {
    const deal = await this.repo.findById(id, organizationId)
    if (!deal) throw new NotFoundError('Deal', id)
    return deal
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; stage?: string },
  ) {
    return this.repo.list(organizationId, opts)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, organizationId)
    if (!deleted) throw new NotFoundError('Deal', id)
  }

  async advance(id: string, organizationId: string, targetStage: string) {
    const deal = await this.repo.findById(id, organizationId)
    if (!deal) throw new NotFoundError('Deal', id)

    if (deal.stage === targetStage) {
      throw new ConflictError(`Deal is already in stage '${targetStage}'`)
    }

    if (!canTransitionDeal(deal.stage, targetStage as never)) {
      throw new ValidationError(
        `Deal in stage '${deal.stage}' cannot transition to '${targetStage}'`,
      )
    }

    const row = await this.repo.updateStage(
      id,
      organizationId,
      targetStage as never,
      deal.version,
    )
    if (!row) {
      throw new OptimisticLockError('Deal')
    }
    return row
  }

  async win(id: string, organizationId: string) {
    const deal = await this.repo.findById(id, organizationId)
    if (!deal) throw new NotFoundError('Deal', id)

    if (!canTransitionDeal(deal.stage, 'WON')) {
      throw new ValidationError(`Deal in stage '${deal.stage}' cannot be won`)
    }

    const row = await this.repo.updateStage(
      id,
      organizationId,
      'WON',
      deal.version,
    )
    if (!row) {
      throw new OptimisticLockError('Deal')
    }
    return row
  }

  async lose(id: string, organizationId: string) {
    const deal = await this.repo.findById(id, organizationId)
    if (!deal) throw new NotFoundError('Deal', id)

    if (!canTransitionDeal(deal.stage, 'LOST')) {
      throw new ValidationError(`Deal in stage '${deal.stage}' cannot be lost`)
    }

    const row = await this.repo.updateStage(
      id,
      organizationId,
      'LOST',
      deal.version,
    )
    if (!row) {
      throw new OptimisticLockError('Deal')
    }
    return row
  }
}
