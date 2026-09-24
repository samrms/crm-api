import { newId } from '@/shared/utils/id.js'
import type { ExportRepository } from '@/modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface CreateExportInput {
  organizationId: string
  actorId: string
  type: string
}

export class ExportService {
  constructor(private readonly repo: ExportRepository) {}

  async createExport(input: CreateExportInput) {
    return this.repo.create({
      id: newId('exp'),
      organizationId: input.organizationId,
      actorId: input.actorId,
      type: input.type,
    })
  }

  async getExport(id: string, organizationId: string) {
    const row = await this.repo.findById(id, organizationId)
    if (!row) throw new NotFoundError('Export', id)
    return row
  }
}
