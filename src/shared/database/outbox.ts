import type { Transaction } from 'kysely'
import type { Database } from './types.js'
import { newId } from '@/shared/utils/id.js'

export async function publishOutboxEvent(
  trx: Transaction<Database>,
  input: {
    organizationId: string
    type: string
    payload: Record<string, unknown>
  },
): Promise<void> {
  await trx
    .insertInto('outbox_events')
    .values({
      id: newId('ob'),
      organization_id: input.organizationId,
      type: input.type,
      payload: input.payload,
      created_at: new Date(),
    })
    .execute()
}
