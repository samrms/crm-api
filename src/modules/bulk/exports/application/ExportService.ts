import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'
import { publishOutboxEvent } from '@/shared/database/outbox.js'
import {
  PostgresExportRepository,
  type ExportRepository,
} from '@/modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface CreateExportInput {
  organizationId: string
  actorId: string
  type: string
}

export class ExportService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repo: ExportRepository,
  ) {}

  async createExport(input: CreateExportInput) {
    const id = newId('exp')

    const result = await this.db.transaction().execute(async (trx) => {
      const repo = new PostgresExportRepository(trx)
      const exp = await repo.create({
        id,
        organizationId: input.organizationId,
        actorId: input.actorId,
        type: input.type,
      })

      await publishOutboxEvent(trx, {
        organizationId: input.organizationId,
        type: 'EXPORT_CREATED',
        payload: { exportId: id, type: input.type },
      })

      return exp
    })

    return result
  }

  async getExport(id: string, organizationId: string) {
    const row = await this.repo.findById(id, organizationId)
    if (!row) throw new NotFoundError('Export', id)
    return row
  }
}
