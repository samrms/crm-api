import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { nanoid } from 'nanoid'
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
    const id = `exp_${nanoid(12)}`
    await this.db.transaction().execute(async (trx) => {
      const repo = new PostgresExportRepository(trx)
      await repo.create({
        id,
        organizationId: input.organizationId,
        actorId: input.actorId,
        type: input.type,
      })
      await trx
        .insertInto('outbox_events')
        .values({
          id: `ob_${nanoid(12)}`,
          organization_id: input.organizationId,
          type: 'EXPORT_CREATED',
          payload: { exportId: id, type: input.type },
          created_at: new Date(),
        })
        .execute()
    })
    return {
      id,
      organizationId: input.organizationId,
      actorId: input.actorId,
      type: input.type,
      status: 'PENDING',
    }
  }

  async getExport(id: string, organizationId: string) {
    const row = await this.repo.findById(id, organizationId)
    if (!row) throw new NotFoundError('Export', id)
    return row
  }
}
