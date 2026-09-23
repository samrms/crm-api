import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { nanoid } from 'nanoid'
import {
  PostgresImportRepository,
  type ImportRepository,
} from '@/modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface CreateImportInput {
  organizationId: string
  actorId: string
  type: string
  filePath: string
}

export class ImportService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repo: ImportRepository,
  ) {}
  async createImport(input: CreateImportInput) {
    const id = `imp_${nanoid(12)}`

    const result = await this.db.transaction().execute(async (trx) => {
      const repo = new PostgresImportRepository(trx)
      const imp = await repo.create({ ...input, id })

      await trx
        .insertInto('outbox_events')
        .values({
          id: `ob_${nanoid(12)}`,
          organization_id: input.organizationId,
          type: 'IMPORT_CREATED',
          payload: { importId: id, type: input.type },
          created_at: new Date(),
        })
        .execute()

      return imp
    })

    return result
  }

  async getImport(id: string, organizationId: string) {
    const imp = await this.repo.findById(id, organizationId)
    if (!imp) {
      throw new NotFoundError('Import', id)
    }
    return imp
  }
}
