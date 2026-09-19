import { nanoid } from 'nanoid'
import { getDb } from '../../../shared/database/connection.js'
import { PostgresImportRepository } from '../infrastructure/PostgresImportRepository.js'
import { writeOutboxEvent } from '../../../shared/outbox/OutboxDispatcher.js'

const repo = new PostgresImportRepository()

export interface CreateImportInput {
  organizationId: string
  actorId: string
  type: string
  filePath: string
}

export async function createImport(input: CreateImportInput) {
  const id = `imp_${nanoid(12)}`

  const result = await getDb()
    .transaction()
    .execute(async () => {
      const imp = await repo.create({ ...input, id })

      await writeOutboxEvent({
        organizationId: input.organizationId,
        type: 'IMPORT_CREATED',
        payload: { importId: id, type: input.type },
      })

      return imp
    })

  return result
}

export async function getImport(id: string, organizationId: string) {
  const imp = await repo.findById(id, organizationId)
  if (!imp) {
    throw new Error('Import not found')
  }
  return imp
}
