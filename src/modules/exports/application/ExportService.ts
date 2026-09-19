import { nanoid } from 'nanoid'
import { getDb } from '../../../shared/database/connection.js'
import { writeOutboxEvent } from '../../../shared/outbox/OutboxDispatcher.js'

export interface CreateExportInput {
  organizationId: string
  actorId: string
  type: string
}

export async function createExport(input: CreateExportInput) {
  const id = `exp_${nanoid(12)}`
  const now = new Date()

  await getDb()
    .transaction()
    .execute(async (trx) => {
      await trx
        .insertInto('exports')
        .values({
          id,
          organization_id: input.organizationId,
          actor_id: input.actorId,
          type: input.type,
          status: 'PENDING',
          created_at: now,
          updated_at: now,
        })
        .execute()

      await writeOutboxEvent({
        organizationId: input.organizationId,
        type: 'EXPORT_CREATED',
        payload: { exportId: id, type: input.type },
      })
    })

  return { id, status: 'PENDING' }
}

export async function getExport(id: string, organizationId: string) {
  const row = await getDb()
    .selectFrom('exports')
    .where('id', '=', id)
    .where('organization_id', '=', organizationId)
    .executeTakeFirst()
  if (!row) throw new Error('Export not found')
  return row
}
