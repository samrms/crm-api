import { nanoid } from 'nanoid'
import type { AuditRepository } from '@/modules/organizations/infrastructure/PostgresAuditRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface UpdateAuditInput {
  organizationId: string
  actorId: string
  action: string
  resourceType: string
  resourceId?: string
  requestId?: string
  metadata?: Record<string, unknown>
}

export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async getAuditEvent(id: string, organizationId: string) {
    const event = await this.repo.findById(id, organizationId)
    if (!event) throw new NotFoundError('Audit event', id)
    return event
  }

  async listAuditEvents(
    organizationId: string,
    opts: {
      limit: number
      after?: string
      resourceType?: string
      resourceId?: string
    },
  ) {
    return this.repo.list(organizationId, opts)
  }

  async createAuditEvent(data: UpdateAuditInput) {
    return this.repo.create({
      id: `aud_${nanoid(12)}`,
      ...data,
    })
  }
}
