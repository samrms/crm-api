import type { Kysely } from 'kysely'
import type { ImportsTable, Database } from '@/shared/database/types.js'

export type ImportRow = ImportsTable

export interface ImportRepository {
  findById(id: string, organizationId: string): Promise<ImportRow | undefined>
  create(data: {
    id: string
    organizationId: string
    actorId: string
    type: string
    filePath: string
  }): Promise<ImportRow>
  updateProgress(
    id: string,
    data: {
      total?: number
      processed: number
      successful: number
      failed: number
    },
  ): Promise<void>
  updateStatus(
    id: string,
    status: ImportRow['status'],
    errorMessage?: string,
  ): Promise<void>
}

export class PostgresImportRepository implements ImportRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<ImportRow | undefined> {
    const row = await this.db
      .selectFrom('imports')
      .selectAll()
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .executeTakeFirst()
    return row as ImportRow | undefined
  }

  async create(data: {
    id: string
    organizationId: string
    actorId: string
    type: string
    filePath: string
  }): Promise<ImportRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('imports')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        actor_id: data.actorId,
        type: data.type,
        status: 'PENDING',
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        file_path: data.filePath,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as ImportRow
  }

  async updateProgress(
    id: string,
    data: {
      total?: number
      processed: number
      successful: number
      failed: number
    },
  ): Promise<void> {
    await this.db
      .updateTable('imports')
      .set({
        ...(data.total !== undefined ? { total: data.total } : {}),
        processed: data.processed,
        successful: data.successful,
        failed: data.failed,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute()
  }

  async updateStatus(
    id: string,
    status: ImportRow['status'],
    errorMessage?: string,
  ): Promise<void> {
    await this.db
      .updateTable('imports')
      .set({
        status,
        error_message: errorMessage ?? null,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute()
  }
}
