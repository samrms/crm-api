import { newId } from '@/shared/utils/id.js'
import type { ImportRepository } from '@/modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface CreateImportInput {
  organizationId: string
  actorId: string
  type: string
  filePath: string
}

export class ImportService {
  constructor(private readonly repo: ImportRepository) {}

  async createImport(input: CreateImportInput) {
    return this.repo.create({ ...input, id: newId('imp') })
  }

  async getImport(id: string, organizationId: string) {
    const imp = await this.repo.findById(id, organizationId)
    if (!imp) {
      throw new NotFoundError('Import', id)
    }
    return imp
  }
}
