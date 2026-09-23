import type { Kysely } from 'kysely'
import type { ExportsTable, Database } from '@/shared/database/types.js'

export type ExportRow = ExportsTable

export interface ExportRepository {
  findById(id: string, organizationId: string): Promise<ExportRow | undefined>
  create(data: {
    id: string
    organizationId: string
    actorId: string
    type: string
  }): Promise<ExportRow>
  updateStatus(
    id: string,
    status: ExportRow['status'],
    data?: { filePath?: string; downloadUrl?: string; errorMessage?: string },
  ): Promise<void>
}

export class PostgresExportRepository implements ExportRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<ExportRow | undefined> {
    const row = await this.db
      .selectFrom('exports')
      .selectAll()
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .executeTakeFirst()
    return row as ExportRow | undefined
  }

  async create(data: {
    id: string
    organizationId: string
    actorId: string
    type: string
  }): Promise<ExportRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('exports')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        actor_id: data.actorId,
        type: data.type,
        status: 'PENDING',
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as ExportRow
  }

  async updateStatus(
    id: string,
    status: ExportRow['status'],
    data?: { filePath?: string; downloadUrl?: string; errorMessage?: string },
  ): Promise<void> {
    await this.db
      .updateTable('exports')
      .set({
        status,
        file_path: data?.filePath ?? undefined,
        download_url: data?.downloadUrl ?? undefined,
        error_message: data?.errorMessage ?? undefined,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute()
  }
}
